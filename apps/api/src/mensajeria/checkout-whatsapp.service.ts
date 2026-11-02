import { Injectable } from '@nestjs/common';
import type { ItemCarritoResuelto } from '../catalog/catalog.service';
import { estadoAtencion, franjaVigente } from '../common/horario';
import { esPreguntaDeAdicionales } from './adicionales';
import { CheckoutEnviosService } from './checkout-envios.service';
import { CheckoutHistorialService } from './checkout-historial.service';
import { CheckoutPedidoService } from './checkout-pedido.service';
import { CheckoutPreguntasService } from './checkout-preguntas.service';
import {
  BOTON,
  BOTONES_MODALIDAD,
  direccionEscritaValida,
  esBotonCheckout,
  esCancelar,
  horaDe,
  listaItems,
  MENSAJE_CERRADO,
  metodoPagoDe,
  modalidadDe,
  separarNombre,
  siguientePaso,
  type ContextoCheckout,
  type EntradaCheckout,
  type MetodoPagoBot,
} from './checkout-whatsapp';
import type {
  CheckoutWhatsapp,
  ItemCarritoPendiente,
} from './conversaciones.service';
import { pesos } from './resumen-pedido';

const URL_CATALOGO = 'https://pizzeriahorebs.shop/catalogo';
export const TEXTO_PIDE_ESCRITA =
  'Para que el domiciliario llegue exacto, escribime la dirección con barrio y una referencia. La ubicación del teléfono suele quedar a unas cuadras 📍';

/**
 * Checkout del bot por botones: modalidad → dirección → nombre → hora de
 * entrega → pago → pedido creado. Solo de 11:00 a.m. a 11:00 p.m.; antes de
 * las 4:00 p.m. el pedido queda como reserva. Determinístico de punta a punta — ningún paso pasa por
 * Gemini, así que nada de lo que ve el cliente acá lo escribe el modelo.
 * Si el cliente escribe algo que no corresponde al paso (una pregunta),
 * `manejar` devuelve false y responde Gemini; el checkout queda donde
 * estaba y los botones siguen sirviendo.
 */
@Injectable()
export class CheckoutWhatsappService {
  constructor(
    private readonly historial: CheckoutHistorialService,
    private readonly envios: CheckoutEnviosService,
    private readonly pedido: CheckoutPedidoService,
    private readonly preguntas: CheckoutPreguntasService,
  ) {}

  /** Arranca el checkout con un carrito ya validado (catálogo o "lo mismo"). */
  async iniciar(
    ctx: ContextoCheckout,
    disponibles: ItemCarritoResuelto[],
    noDisponibles: number,
    nota: string | null,
  ): Promise<void> {
    if (estadoAtencion(new Date()) === 'cerrado') {
      await this.envios.limpiar(ctx);
      await this.envios.texto(ctx, MENSAJE_CERRADO);
      return;
    }
    if (disponibles.length === 0) {
      await this.envios.limpiar(ctx);
      await this.envios.texto(
        ctx,
        'Ninguno de esos productos está disponible en este momento 😕 ¿Querés que te mande el menú?',
      );
      return;
    }
    await this.envios.guardarCarrito(
      ctx,
      disponibles.map((i) => ({
        varianteId: i.varianteId,
        cantidad: i.cantidad,
      })),
    );
    const checkout: CheckoutWhatsapp = {
      paso: 'modalidad',
      ...(nota ? { nota } : {}),
    };
    await this.envios.guardar(ctx, checkout);
    const aviso =
      noDisponibles > 0
        ? `\n(${noDisponibles} producto(s) ya no están disponibles y los saqué.)`
        : '';
    const anotado = `¡Anotado! 🍕\n${listaItems(disponibles)}${aviso}`;
    if (await this.preguntas.ofrecerAdicionales(ctx, checkout, anotado)) return;
    await this.envios.botones(
      ctx,
      `${anotado}\n\n¿Cómo lo querés?`,
      BOTONES_MODALIDAD,
    );
  }

  /** true si el checkout se hizo cargo del mensaje; false → responde Gemini. */
  async manejar(
    ctx: ContextoCheckout,
    entrada: EntradaCheckout,
  ): Promise<boolean> {
    if (await this.respuestaSinPaso(ctx, entrada)) return true;

    const checkout = await this.envios.obtener(ctx);
    if (!checkout) {
      // Un botón viejo (de un pedido ya creado o cancelado).
      if (entrada.tipo === 'boton' && esBotonCheckout(entrada.id)) {
        await this.envios.texto(
          ctx,
          'Ese pedido ya no está en curso. Si querés armar uno nuevo, pedime el menú 🍕',
        );
        return true;
      }
      return false;
    }

    if (
      entrada.tipo === 'texto' &&
      (await this.textoLibre(ctx, checkout, entrada.texto))
    ) {
      return true;
    }
    return this.manejarPaso(ctx, checkout, entrada);
  }

  /** Lo que vale en cualquier paso si el cliente lo escribe: cancelar o un adicional. */
  private async textoLibre(
    ctx: ContextoCheckout,
    checkout: CheckoutWhatsapp,
    texto: string,
  ): Promise<boolean> {
    if (esCancelar(texto)) {
      await this.envios.limpiar(ctx);
      await this.envios.texto(
        ctx,
        'Listo, cancelé el pedido en curso. Si querés arrancar de nuevo, pedime el menú 🍕',
      );
      return true;
    }
    return (
      checkout.paso !== 'adicionales' &&
      (await this.preguntas.adicionalEscrito(ctx, checkout, texto))
    );
  }

  /** Lo que se contesta aunque no haya checkout: botones del saludo y precios de adicionales. */
  private async respuestaSinPaso(
    ctx: ContextoCheckout,
    entrada: EntradaCheckout,
  ): Promise<boolean> {
    if (entrada.tipo === 'boton') return this.botonSinPaso(ctx, entrada.id);
    return (
      entrada.tipo === 'texto' &&
      esPreguntaDeAdicionales(entrada.texto) &&
      (await this.preguntas.infoAdicionales(ctx))
    );
  }

  /**
   * Los botones del saludo ("lo mismo", "ver el menú", "otra cosa") valen
   * sin un checkout en curso. true si el botón era uno de esos.
   */
  private async botonSinPaso(
    ctx: ContextoCheckout,
    id: string,
  ): Promise<boolean> {
    if (id === BOTON.loMismo) {
      await this.repetirUltimoPedido(ctx);
    } else if (id === BOTON.verMenu) {
      await this.envios.catalogo(ctx, URL_CATALOGO);
    } else if (id === BOTON.otraCosa) {
      await this.envios.texto(ctx, '¡Dale! Contame qué se te antoja hoy 🍕');
    } else {
      return false;
    }
    return true;
  }

  private async manejarPaso(
    ctx: ContextoCheckout,
    checkout: CheckoutWhatsapp,
    entrada: EntradaCheckout,
  ): Promise<boolean> {
    switch (checkout.paso) {
      case 'adicionales':
        return this.manejarAdicionales(ctx, checkout, entrada);
      case 'modalidad': {
        const modalidad = modalidadDe(entrada);
        if (!modalidad) return false;
        checkout.modalidad = modalidad;
        break;
      }
      case 'direccion':
        return this.manejarDireccion(ctx, checkout, entrada);
      case 'nombre':
        return this.manejarNombre(ctx, checkout, entrada);
      case 'hora': {
        const hora = horaDe(entrada);
        if (!hora) return false;
        checkout.entrega = hora;
        break;
      }
      case 'pago': {
        const metodo = metodoPagoDe(entrada);
        if (!metodo) return false;
        await this.crearPedido(ctx, checkout, metodo);
        return true;
      }
    }
    await this.avanzar(ctx, checkout);
    return true;
  }

  private async manejarAdicionales(
    ctx: ContextoCheckout,
    checkout: CheckoutWhatsapp,
    entrada: EntradaCheckout,
  ): Promise<boolean> {
    const respuesta = await this.preguntas.responderAdicionales(
      ctx,
      checkout,
      entrada,
    );
    if (respuesta === 'ignorar') return false;
    if (respuesta === 'listo') await this.avanzar(ctx, checkout);
    return true;
  }

  private async manejarDireccion(
    ctx: ContextoCheckout,
    checkout: CheckoutWhatsapp,
    entrada: EntradaCheckout,
  ): Promise<boolean> {
    if (entrada.tipo === 'boton' && entrada.id === BOTON.otraDireccion) {
      await this.preguntas.pedirDireccion(ctx, checkout);
      return true;
    }
    if (entrada.tipo === 'ubicacion') {
      // El pin no sirve para entregar (queda a cuadras de la casa).
      await this.envios.texto(ctx, TEXTO_PIDE_ESCRITA);
      return true;
    }
    if (!this.completarDireccion(checkout, entrada)) return false;
    await this.avanzar(ctx, checkout);
    return true;
  }

  /** Toma la dirección de lo que mandó el cliente; false si no sirve. */
  private completarDireccion(
    checkout: CheckoutWhatsapp,
    entrada: EntradaCheckout,
  ): boolean {
    if (
      entrada.tipo === 'boton' &&
      entrada.id === BOTON.direccionAnterior &&
      checkout.direccionSugerida
    ) {
      checkout.direccion = checkout.direccionSugerida;
    } else if (
      entrada.tipo === 'texto' &&
      direccionEscritaValida(entrada.texto)
    ) {
      checkout.direccion = entrada.texto.trim();
    } else {
      return false;
    }
    return true;
  }

  private async manejarNombre(
    ctx: ContextoCheckout,
    checkout: CheckoutWhatsapp,
    entrada: EntradaCheckout,
  ): Promise<boolean> {
    if (entrada.tipo !== 'texto') return false;
    const { nombre, apellido } = separarNombre(entrada.texto);
    if (!nombre) return false;
    if (checkout.nombre && !checkout.apellido) {
      // Ya teníamos el nombre: lo que escribe ahora es el apellido.
      checkout.apellido = [nombre, apellido].filter(Boolean).join(' ');
    } else {
      checkout.nombre = nombre;
      checkout.apellido = apellido ?? undefined;
    }
    if (!checkout.apellido) {
      await this.envios.guardar(ctx, checkout);
      await this.envios.texto(ctx, `Gracias, ${nombre}. ¿Y tu apellido?`);
      return true;
    }
    await this.avanzar(ctx, checkout);
    return true;
  }

  private async completarConClienteConocido(
    ctx: ContextoCheckout,
    checkout: CheckoutWhatsapp,
  ): Promise<void> {
    if (checkout.nombre && checkout.apellido) return;
    const cliente = await this.historial.cliente(ctx.identificadorExterno);
    if (cliente?.nombre && cliente.apellido) {
      checkout.nombre = cliente.nombre;
      checkout.apellido = cliente.apellido;
    }
  }

  /**
   * Pedido calculado por calcular_pedido (escrito por texto): queda listo
   * para cobrar con los mismos botones de pago. Devuelve el resumen enviado.
   */
  async ofrecerPagoDesdeCalculo(datos: {
    identificadorExterno: string;
    conversacionId: string;
    items: ItemCarritoPendiente[];
    checkout: CheckoutWhatsapp;
  }): Promise<string> {
    const ctx = {
      identificadorExterno: datos.identificadorExterno,
      conversacionId: datos.conversacionId,
      mensajeId: null,
    };
    await this.envios.guardarCarrito(ctx, datos.items);
    // Falta la hora de entrega: primero la lista de franjas, el resumen
    // sale cuando la elige.
    if (!datos.checkout.entrega) {
      await this.preguntas.hora(ctx, datos.checkout);
      return 'Se le mandó al cliente la lista de horarios de entrega; el resumen y los botones de pago le llegan cuando elija la hora.';
    }
    return this.preguntas.pago(ctx, datos.checkout);
  }

  /**
   * "¿Lo mismo de la última vez?" con botones. false si el cliente nunca
   * compró o ninguno de esos productos sigue disponible.
   */
  async ofrecerLoMismo(ctx: ContextoCheckout): Promise<boolean> {
    // Fuera de horario responde Gemini (sabe el horario por obtener_horario).
    if (estadoAtencion(new Date()) === 'cerrado') return false;
    const { disponibles } = await this.historial.ultimoPedidoRepetible(
      ctx.identificadorExterno,
    );
    if (disponibles.length === 0) return false;
    const cliente = await this.historial.cliente(ctx.identificadorExterno);
    const subtotal = disponibles.reduce((s, i) => s + i.precio * i.cantidad, 0);
    await this.envios.botones(
      ctx,
      `¡Hola${cliente?.nombre ? ` ${cliente.nombre}` : ''}! 👋 ¿Te mando lo mismo de la última vez?\n${listaItems(disponibles)}\n*${pesos(subtotal)}*`,
      [
        { id: BOTON.loMismo, titulo: 'Sí, lo mismo' },
        { id: BOTON.verMenu, titulo: 'Ver el menú' },
        { id: BOTON.otraCosa, titulo: 'Otra cosa' },
      ],
    );
    return true;
  }

  private async repetirUltimoPedido(ctx: ContextoCheckout): Promise<void> {
    const { disponibles, noDisponibles } =
      await this.historial.ultimoPedidoRepetible(ctx.identificadorExterno);
    await this.iniciar(ctx, disponibles, noDisponibles, null);
  }

  /** Completa lo que ya se sabe del cliente y pregunta lo que falta. */
  private async avanzar(
    ctx: ContextoCheckout,
    checkout: CheckoutWhatsapp,
  ): Promise<void> {
    await this.completarConClienteConocido(ctx, checkout);
    checkout.paso = siguientePaso(checkout);
    switch (checkout.paso) {
      case 'modalidad':
        await this.envios.guardar(ctx, checkout);
        await this.envios.botones(ctx, '¿Cómo lo querés?', BOTONES_MODALIDAD);
        return;
      case 'direccion':
        await this.preguntas.direccion(ctx, checkout);
        return;
      case 'nombre':
        await this.envios.guardar(ctx, checkout);
        await this.envios.texto(
          ctx,
          '¿A nombre de quién va el pedido? Escribime nombre y apellido 🙂',
        );
        return;
      case 'hora':
        await this.preguntas.hora(ctx, checkout);
        return;
      case 'pago':
        await this.preguntas.pago(ctx, checkout);
        return;
    }
  }

  private async crearPedido(
    ctx: ContextoCheckout,
    checkout: CheckoutWhatsapp,
    metodo: MetodoPagoBot,
  ): Promise<void> {
    // La franja puede vencer mientras el cliente decide cómo pagar (o el
    // local puede haber cerrado): se vuelve a ofrecer la lista.
    const franja = franjaVigente(checkout.entrega ?? 'ya', new Date());
    if (!franja) {
      await this.envios.texto(
        ctx,
        'Esa hora ya no está disponible 🙏 Elegí otra, porfa.',
      );
      await this.preguntas.hora(ctx, checkout);
      return;
    }
    await this.pedido.crear(ctx, checkout, metodo, franja);
  }
}
