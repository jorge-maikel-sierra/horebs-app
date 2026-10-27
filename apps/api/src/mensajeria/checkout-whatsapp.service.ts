import { Injectable, Logger } from '@nestjs/common';
import {
  CatalogService,
  type ItemCarritoResuelto,
} from '../catalog/catalog.service';
import { COSTO_DOMICILIO_DEFAULT } from '../common/costos';
import {
  estadoAtencion,
  etiquetaHora,
  franjaVigente,
  franjasEntrega,
} from '../common/horario';
import { PedidosService } from '../pedidos/pedidos.service';
import {
  AvisoEquipoService,
  INICIO_CONFIRMACION_PEDIDO,
} from './aviso-equipo.service';
import {
  BOTON,
  BOTONES_MODALIDAD,
  BOTONES_PAGO,
  direccionDeUbicacion,
  direccionEscritaValida,
  esBotonCheckout,
  esCancelar,
  horaDe,
  metodoPagoDe,
  modalidadDe,
  PREFIJO_HORA,
  separarNombre,
  siguientePaso,
  type EntradaCheckout,
  type MetodoPagoBot,
} from './checkout-whatsapp';
import {
  ConversacionesService,
  type CheckoutWhatsapp,
  type ItemCarritoPendiente,
} from './conversaciones.service';
import { MetaGraphService, type BotonRespuesta } from './meta-graph.service';
import { armarResumenPedido, type LineaPedido } from './resumen-pedido';

const URL_CATALOGO = 'https://pizzeriahorebs.shop/catalogo';
// Dato confirmado en CLAUDE.md — el mismo que muestra el sitio web en la
// confirmación de un pedido con transferencia (apps/web/src/lib/negocio.ts).
const TRANSFERENCIA = { banco: 'Nu', llave: '1118843420' };

// Horario del bot: 11:00 a.m. a 11:00 p.m. (ver common/horario.ts).
export const MENSAJE_CERRADO =
  'Estamos cerrados 😴 Tomamos pedidos de 11:00 a.m. a 11:00 p.m. (el local abre a las 4:00 p.m.). Escribinos desde las 11 y te lo dejamos reservado 🍕';

export interface ContextoCheckout {
  /** wa_id del cliente — en WhatsApp es también su teléfono. */
  identificadorExterno: string;
  conversacionId: string;
  /** wamid del mensaje que disparó el paso — idempotencia del pedido. */
  mensajeId: string | null;
}

function pesos(valor: number): string {
  return `$${valor.toLocaleString('es-CO')}`;
}

function lineasDeCarrito(items: ItemCarritoResuelto[]): LineaPedido[] {
  return items.map((i) => ({
    cantidad: i.cantidad,
    productoNombre: i.productoNombre,
    varianteNombre: i.conTamanos ? i.varianteNombre : null,
    precioUnitario: i.precio,
  }));
}

/** 'ya' → "lo antes posible"; 'HH:MM' → "6:30 p.m. (reserva)". */
function textoEntrega(entrega: string | undefined): string | undefined {
  if (!entrega) return undefined;
  if (entrega === 'ya') return 'lo antes posible';
  const [h, m] = entrega.split(':').map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a.m.' : 'p.m.'} (reserva)`;
}

function listaItems(items: ItemCarritoResuelto[]): string {
  return items
    .map(
      (i) =>
        `• ${i.cantidad}x ${i.productoNombre}${i.conTamanos ? ` (${i.varianteNombre})` : ''}`,
    )
    .join('\n');
}

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
  private readonly logger = new Logger(CheckoutWhatsappService.name);

  constructor(
    private readonly conversaciones: ConversacionesService,
    private readonly catalog: CatalogService,
    private readonly pedidos: PedidosService,
    private readonly metaGraph: MetaGraphService,
    private readonly avisoEquipo: AvisoEquipoService,
  ) {}

  /** Arranca el checkout con un carrito ya validado (catálogo o "lo mismo"). */
  async iniciar(
    ctx: ContextoCheckout,
    disponibles: ItemCarritoResuelto[],
    noDisponibles: number,
    nota: string | null,
  ): Promise<void> {
    if (estadoAtencion(new Date()) === 'cerrado') {
      await this.limpiar(ctx);
      await this.enviarTexto(ctx, MENSAJE_CERRADO);
      return;
    }
    if (disponibles.length === 0) {
      await this.limpiar(ctx);
      await this.enviarTexto(
        ctx,
        'Ninguno de esos productos está disponible en este momento 😕 ¿Querés que te mande el menú?',
      );
      return;
    }
    await this.conversaciones.guardarCarrito(
      'whatsapp',
      ctx.identificadorExterno,
      disponibles.map((i) => ({
        varianteId: i.varianteId,
        cantidad: i.cantidad,
      })),
    );
    await this.conversaciones.guardarCheckout(
      'whatsapp',
      ctx.identificadorExterno,
      { paso: 'modalidad', ...(nota ? { nota } : {}) },
    );
    const aviso =
      noDisponibles > 0
        ? `\n(${noDisponibles} producto(s) ya no están disponibles y los saqué.)`
        : '';
    await this.enviarBotones(
      ctx,
      `¡Anotado! 🍕\n${listaItems(disponibles)}${aviso}\n\n¿Cómo lo querés?`,
      BOTONES_MODALIDAD,
    );
  }

  /** true si el checkout se hizo cargo del mensaje; false → responde Gemini. */
  async manejar(
    ctx: ContextoCheckout,
    entrada: EntradaCheckout,
  ): Promise<boolean> {
    if (entrada.tipo === 'boton') {
      if (entrada.id === BOTON.loMismo) {
        await this.repetirUltimoPedido(ctx);
        return true;
      }
      if (entrada.id === BOTON.verMenu) {
        await this.metaGraph.enviarCatalogo(
          'whatsapp',
          ctx.identificadorExterno,
          URL_CATALOGO,
        );
        await this.conversaciones.registrarMensaje(
          ctx.conversacionId,
          'saliente_bot',
          'Menú enviado como catálogo de WhatsApp.',
        );
        return true;
      }
      if (entrada.id === BOTON.otraCosa) {
        await this.enviarTexto(ctx, '¡Dale! Contame qué se te antoja hoy 🍕');
        return true;
      }
    }

    const checkout = await this.conversaciones.obtenerCheckout(
      'whatsapp',
      ctx.identificadorExterno,
    );
    if (!checkout) {
      // Un botón viejo (de un pedido ya creado o cancelado).
      if (entrada.tipo === 'boton' && esBotonCheckout(entrada.id)) {
        await this.enviarTexto(
          ctx,
          'Ese pedido ya no está en curso. Si querés armar uno nuevo, pedime el menú 🍕',
        );
        return true;
      }
      return false;
    }

    if (entrada.tipo === 'texto' && esCancelar(entrada.texto)) {
      await this.limpiar(ctx);
      await this.enviarTexto(
        ctx,
        'Listo, cancelé el pedido en curso. Si querés arrancar de nuevo, pedime el menú 🍕',
      );
      return true;
    }

    switch (checkout.paso) {
      case 'modalidad': {
        const modalidad = modalidadDe(entrada);
        if (!modalidad) return false;
        checkout.modalidad = modalidad;
        await this.avanzar(ctx, checkout);
        return true;
      }
      case 'direccion': {
        if (entrada.tipo === 'boton' && entrada.id === BOTON.otraDireccion) {
          await this.pedirUbicacion(ctx, checkout);
          return true;
        }
        if (
          entrada.tipo === 'boton' &&
          entrada.id === BOTON.direccionAnterior &&
          checkout.direccionSugerida
        ) {
          checkout.direccion = checkout.direccionSugerida;
        } else if (entrada.tipo === 'ubicacion') {
          checkout.direccion = direccionDeUbicacion(entrada);
        } else if (
          entrada.tipo === 'texto' &&
          direccionEscritaValida(entrada.texto)
        ) {
          checkout.direccion = entrada.texto.trim();
        } else {
          return false;
        }
        await this.avanzar(ctx, checkout);
        return true;
      }
      case 'nombre': {
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
          await this.conversaciones.guardarCheckout(
            'whatsapp',
            ctx.identificadorExterno,
            checkout,
          );
          await this.enviarTexto(ctx, `Gracias, ${nombre}. ¿Y tu apellido?`);
          return true;
        }
        await this.avanzar(ctx, checkout);
        return true;
      }
      case 'hora': {
        const hora = horaDe(entrada);
        if (!hora) return false;
        checkout.entrega = hora;
        await this.avanzar(ctx, checkout);
        return true;
      }
      case 'pago': {
        const metodo = metodoPagoDe(entrada);
        if (!metodo) return false;
        await this.crearPedido(ctx, checkout, metodo);
        return true;
      }
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
    await this.conversaciones.guardarCarrito(
      'whatsapp',
      datos.identificadorExterno,
      datos.items,
    );
    // Falta la hora de entrega: primero la lista de franjas, el resumen
    // sale cuando la elige.
    if (!datos.checkout.entrega) {
      await this.pedirHora(ctx, datos.checkout);
      return 'Se le mandó al cliente la lista de horarios de entrega; el resumen y los botones de pago le llegan cuando elija la hora.';
    }
    return this.ofrecerPago(ctx, datos.checkout);
  }

  /**
   * "¿Lo mismo de la última vez?" con botones. false si el cliente nunca
   * compró o ninguno de esos productos sigue disponible.
   */
  async ofrecerLoMismo(ctx: ContextoCheckout): Promise<boolean> {
    // Fuera de horario responde Gemini (sabe el horario por obtener_horario).
    if (estadoAtencion(new Date()) === 'cerrado') return false;
    const ultimo = await this.pedidos.ultimoPedidoPorTelefono(
      ctx.identificadorExterno,
    );
    if (!ultimo) return false;
    const { disponibles } = await this.catalog.resolverCarrito(ultimo.items);
    if (disponibles.length === 0) return false;
    const cliente = await this.pedidos.clientePorTelefono(
      ctx.identificadorExterno,
    );
    const subtotal = disponibles.reduce((s, i) => s + i.precio * i.cantidad, 0);
    await this.enviarBotones(
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
    const ultimo = await this.pedidos.ultimoPedidoPorTelefono(
      ctx.identificadorExterno,
    );
    const { disponibles, noDisponibles } = await this.catalog.resolverCarrito(
      ultimo?.items ?? [],
    );
    await this.iniciar(ctx, disponibles, noDisponibles, null);
  }

  /** Completa lo que ya se sabe del cliente y pregunta lo que falta. */
  private async avanzar(
    ctx: ContextoCheckout,
    checkout: CheckoutWhatsapp,
  ): Promise<void> {
    if (!checkout.nombre || !checkout.apellido) {
      const cliente = await this.pedidos.clientePorTelefono(
        ctx.identificadorExterno,
      );
      if (cliente?.nombre && cliente.apellido) {
        checkout.nombre = cliente.nombre;
        checkout.apellido = cliente.apellido;
      }
    }
    checkout.paso = siguientePaso(checkout);
    switch (checkout.paso) {
      case 'modalidad':
        await this.guardar(ctx, checkout);
        await this.enviarBotones(ctx, '¿Cómo lo querés?', BOTONES_MODALIDAD);
        return;
      case 'direccion':
        await this.pedirDireccion(ctx, checkout);
        return;
      case 'nombre':
        await this.guardar(ctx, checkout);
        await this.enviarTexto(
          ctx,
          '¿A nombre de quién va el pedido? Escribime nombre y apellido 🙂',
        );
        return;
      case 'hora':
        await this.pedirHora(ctx, checkout);
        return;
      case 'pago':
        await this.ofrecerPago(ctx, checkout);
        return;
    }
  }

  /**
   * Lista de franjas: "Lo antes posible" con el local abierto, y reservas
   * cada 30 min desde las 4:00 p.m. Fuera del horario del bot, cierra.
   */
  private async pedirHora(
    ctx: ContextoCheckout,
    checkout: CheckoutWhatsapp,
  ): Promise<void> {
    const ahora = new Date();
    const franjas = franjasEntrega(ahora);
    if (franjas.length === 0) {
      await this.limpiar(ctx);
      await this.enviarTexto(ctx, MENSAJE_CERRADO);
      return;
    }
    checkout.paso = 'hora';
    checkout.entrega = undefined;
    await this.guardar(ctx, checkout);
    const cuerpo =
      estadoAtencion(ahora) === 'reservas'
        ? 'Abrimos a las 4:00 p.m. 🕓 ¿Para qué hora te lo reservamos?'
        : '¿Para cuándo lo querés?';
    await this.metaGraph.enviarLista(ctx.identificadorExterno, {
      cuerpo,
      boton: 'Elegir hora',
      filas: franjas.map((f) => ({
        id: `${PREFIJO_HORA}${f.id}`,
        titulo: f.titulo,
      })),
    });
    await this.conversaciones.registrarMensaje(
      ctx.conversacionId,
      'saliente_bot',
      `${cuerpo}\n[${franjas.map((f) => f.titulo).join(' · ')}]`,
    );
  }

  /** Ofrece la dirección del último pedido; si no hay, pide la ubicación. */
  private async pedirDireccion(
    ctx: ContextoCheckout,
    checkout: CheckoutWhatsapp,
  ): Promise<void> {
    const [ultimo, cliente] = await Promise.all([
      this.pedidos.ultimoPedidoPorTelefono(ctx.identificadorExterno),
      this.pedidos.clientePorTelefono(ctx.identificadorExterno),
    ]);
    const sugerida =
      (ultimo?.direccionEntrega ?? cliente?.direccion)?.trim() || null;
    if (!sugerida) {
      await this.pedirUbicacion(ctx, checkout);
      return;
    }
    checkout.paso = 'direccion';
    checkout.direccionSugerida = sugerida;
    await this.guardar(ctx, checkout);
    await this.enviarBotones(ctx, `¿Te lo llevamos a *${sugerida}*?`, [
      { id: BOTON.direccionAnterior, titulo: 'Sí, ahí' },
      { id: BOTON.otraDireccion, titulo: 'Otra dirección' },
    ]);
  }

  private async pedirUbicacion(
    ctx: ContextoCheckout,
    checkout: CheckoutWhatsapp,
  ): Promise<void> {
    checkout.paso = 'direccion';
    await this.guardar(ctx, checkout);
    const cuerpo =
      '¿A dónde te lo llevamos? Tocá *Enviar ubicación* o escribime la dirección con barrio y alguna referencia.';
    await this.metaGraph.pedirUbicacion(ctx.identificadorExterno, cuerpo);
    await this.conversaciones.registrarMensaje(
      ctx.conversacionId,
      'saliente_bot',
      cuerpo,
    );
  }

  /**
   * Resumen (precios desde la base) + botones de pago. Los puntos no van
   * acá a propósito: se cuentan al día siguiente, en la invitación a
   * repetir (avisos-pedido.ts), como excusa para una nueva compra.
   */
  private async ofrecerPago(
    ctx: ContextoCheckout,
    checkout: CheckoutWhatsapp,
  ): Promise<string> {
    const carrito = await this.conversaciones.obtenerCarrito(
      'whatsapp',
      ctx.identificadorExterno,
    );
    const { disponibles } = await this.catalog.resolverCarrito(carrito);
    if (disponibles.length === 0) {
      await this.limpiar(ctx);
      const texto =
        'Los productos de tu pedido ya no están disponibles 😕 ¿Te mando el menú?';
      await this.enviarTexto(ctx, texto);
      return texto;
    }

    const { texto } = armarResumenPedido({
      nombreCompleto: `${checkout.nombre} ${checkout.apellido}`,
      lineas: lineasDeCarrito(disponibles),
      modalidad: checkout.modalidad ?? 'retiro',
      direccion: checkout.direccion ?? null,
      costoDomicilio: COSTO_DOMICILIO_DEFAULT,
      entrega: textoEntrega(checkout.entrega),
    });

    checkout.paso = 'pago';
    await this.guardar(ctx, checkout);
    await this.enviarTexto(ctx, texto);
    await this.enviarBotones(ctx, '¿Cómo vas a pagar?', BOTONES_PAGO);
    return texto;
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
      await this.enviarTexto(
        ctx,
        'Esa hora ya no está disponible 🙏 Elegí otra, porfa.',
      );
      await this.pedirHora(ctx, checkout);
      return;
    }
    const carrito = await this.conversaciones.obtenerCarrito(
      'whatsapp',
      ctx.identificadorExterno,
    );
    const esDomicilio = checkout.modalidad === 'domicilio';
    let pedido: Awaited<ReturnType<PedidosService['crearDesdeWhatsapp']>>;
    try {
      pedido = await this.pedidos.crearDesdeWhatsapp({
        cliente: {
          nombre: checkout.nombre ?? '',
          apellido: checkout.apellido ?? '',
          telefono: ctx.identificadorExterno,
          ...(esDomicilio && checkout.direccion
            ? { direccion: checkout.direccion }
            : {}),
        },
        modalidad: checkout.modalidad ?? 'retiro',
        direccion_entrega: esDomicilio ? checkout.direccion : undefined,
        metodo_pago: metodo,
        notas: checkout.nota,
        programado_para: franja.programadoPara,
        items: carrito.map((i) => ({
          variante_id: i.varianteId,
          cantidad: i.cantidad,
        })),
        idempotency_key: ctx.mensajeId ? `wa:${ctx.mensajeId}` : undefined,
      });
    } catch (err) {
      // Nunca dejar al cliente sin respuesta: pasa a una persona.
      this.logger.error(
        `id=${ctx.identificadorExterno} no se pudo crear el pedido: ${(err as Error).message}`,
      );
      await this.conversaciones.derivarAHumano(
        'whatsapp',
        ctx.identificadorExterno,
      );
      await this.enviarTexto(
        ctx,
        'No pude registrar tu pedido 😕 Ya le avisé al equipo y una persona te escribe por acá en un momento.',
      );
      this.avisoEquipo.notificar({
        canal: 'whatsapp',
        identificadorExterno: ctx.identificadorExterno,
        telefono: ctx.identificadorExterno,
        conversacionId: ctx.conversacionId,
      });
      return;
    }

    await this.limpiar(ctx);
    const confirmacion = [
      `${INICIO_CONFIRMACION_PEDIDO} ${checkout.nombre}! Recibimos tu pedido *#${pedido.id.slice(0, 8)}* por *${pesos(pedido.total)}*.`,
      franja.programadoPara
        ? `🕒 Quedó reservado para las *${etiquetaHora(franja.programadoPara)}*.`
        : null,
      'Te aviso por acá cuando lo confirmemos y cuando vaya en camino 🍕',
      metodo === 'transferencia'
        ? `\nPara transferir: *Banco ${TRANSFERENCIA.banco}*, llave *${TRANSFERENCIA.llave}*. Mandanos el comprobante por acá.`
        : null,
    ]
      .filter((l) => l !== null)
      .join('\n');
    await this.enviarTexto(ctx, confirmacion);
    this.logger.log(
      `id=${ctx.identificadorExterno} pedido ${pedido.id} creado por el bot — total=${pedido.total} pago=${metodo}`,
    );
    this.avisoEquipo.notificar({
      canal: 'whatsapp',
      identificadorExterno: ctx.identificadorExterno,
      telefono: ctx.identificadorExterno,
      conversacionId: ctx.conversacionId,
      pedido: { id: pedido.id, total: pedido.total, metodoPago: metodo },
    });
  }

  private async guardar(
    ctx: ContextoCheckout,
    checkout: CheckoutWhatsapp,
  ): Promise<void> {
    await this.conversaciones.guardarCheckout(
      'whatsapp',
      ctx.identificadorExterno,
      checkout,
    );
  }

  private async limpiar(ctx: ContextoCheckout): Promise<void> {
    await this.conversaciones.guardarCheckout(
      'whatsapp',
      ctx.identificadorExterno,
      null,
    );
    await this.conversaciones.guardarCarrito(
      'whatsapp',
      ctx.identificadorExterno,
      null,
    );
  }

  private async enviarTexto(
    ctx: ContextoCheckout,
    texto: string,
  ): Promise<void> {
    await this.metaGraph.enviarMensajeSesion(
      'whatsapp',
      ctx.identificadorExterno,
      texto,
    );
    await this.conversaciones.registrarMensaje(
      ctx.conversacionId,
      'saliente_bot',
      texto,
    );
  }

  private async enviarBotones(
    ctx: ContextoCheckout,
    cuerpo: string,
    botones: BotonRespuesta[],
  ): Promise<void> {
    await this.metaGraph.enviarBotones(
      ctx.identificadorExterno,
      cuerpo,
      botones,
    );
    await this.conversaciones.registrarMensaje(
      ctx.conversacionId,
      'saliente_bot',
      `${cuerpo}\n[${botones.map((b) => b.titulo).join(' · ')}]`,
    );
  }
}
