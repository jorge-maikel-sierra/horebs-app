import type { CheckoutEnviosService } from './checkout-envios.service';
import type { CheckoutHistorialService } from './checkout-historial.service';
import type { CheckoutPedidoService } from './checkout-pedido.service';
import type { CheckoutPreguntasService } from './checkout-preguntas.service';
import {
  CheckoutWhatsappService,
  TEXTO_PIDE_ESCRITA,
} from './checkout-whatsapp.service';
import {
  BOTON,
  MENSAJE_CERRADO,
  type ContextoCheckout,
  type EntradaCheckout,
} from './checkout-whatsapp';
import type { CheckoutWhatsapp } from './conversaciones.service';

const CTX: ContextoCheckout = {
  identificadorExterno: '573157861208',
  conversacionId: 'conv-1',
  mensajeId: 'wamid.1',
};

// Sábado 31 oct 2026, 8:00 p.m. en Bogotá: el bot y el local están abiertos.
const ABIERTO = new Date('2026-11-01T01:00:00.000Z');
// 3:00 a.m. en Bogotá: cerrado.
const CERRADO = new Date('2026-10-31T08:00:00.000Z');

const boton = (id: string): EntradaCheckout => ({ tipo: 'boton', id });
const texto = (t: string): EntradaCheckout => ({ tipo: 'texto', texto: t });

function crearServicio(checkout: CheckoutWhatsapp | null) {
  const historial = {
    cliente: jest.fn().mockResolvedValue(null),
    ultimoPedidoRepetible: jest
      .fn()
      .mockResolvedValue({ disponibles: [], noDisponibles: 0 }),
  };
  const envios = {
    obtener: jest.fn().mockResolvedValue(checkout),
    guardarCarrito: jest.fn().mockResolvedValue(undefined),
    texto: jest.fn().mockResolvedValue(undefined),
    botones: jest.fn().mockResolvedValue(undefined),
    guardar: jest.fn().mockResolvedValue(undefined),
    limpiar: jest.fn().mockResolvedValue(undefined),
    catalogo: jest.fn().mockResolvedValue(undefined),
    guardarTelefono: jest.fn().mockResolvedValue(undefined),
  };
  const pedido = { crear: jest.fn().mockResolvedValue(undefined) };
  const preguntas = {
    hora: jest.fn().mockResolvedValue(undefined),
    direccion: jest.fn().mockResolvedValue(undefined),
    pedirDireccion: jest.fn().mockResolvedValue(undefined),
    pedirTelefono: jest.fn().mockResolvedValue(undefined),
    pago: jest.fn().mockResolvedValue('resumen'),
    ofrecerAdicionales: jest.fn().mockResolvedValue(false),
    infoAdicionales: jest.fn().mockResolvedValue(true),
    adicionalEscrito: jest.fn().mockResolvedValue(false),
    responderAdicionales: jest.fn().mockResolvedValue('esperando'),
  };
  const servicio = new CheckoutWhatsappService(
    historial as unknown as CheckoutHistorialService,
    envios as unknown as CheckoutEnviosService,
    pedido as unknown as CheckoutPedidoService,
    preguntas as unknown as CheckoutPreguntasService,
  );
  return {
    servicio,
    historial,
    envios,
    pedido,
    preguntas,
  };
}

describe('CheckoutWhatsappService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(ABIERTO);
  });
  afterEach(() => jest.useRealTimers());

  describe('manejar sin un checkout en curso', () => {
    it('un texto cualquiera no es del checkout: responde Gemini', async () => {
      const { servicio, envios } = crearServicio(null);
      await expect(
        servicio.manejar(CTX, texto('¿tienen gaseosas?')),
      ).resolves.toBe(false);
      expect(envios.texto).not.toHaveBeenCalled();
    });

    it('la pregunta por el precio de un adicional se contesta fija, sin pasar por Gemini', async () => {
      const { servicio, preguntas } = crearServicio(null);

      await expect(
        servicio.manejar(CTX, texto('¿Cuánto cuesta el borde de queso?')),
      ).resolves.toBe(true);

      expect(preguntas.infoAdicionales).toHaveBeenCalledWith(CTX);
    });

    it('si no hay adicionales cargados deja que conteste Gemini', async () => {
      const { servicio, preguntas } = crearServicio(null);
      preguntas.infoAdicionales.mockResolvedValue(false);

      await expect(
        servicio.manejar(CTX, texto('¿Qué adicionales tienen?')),
      ).resolves.toBe(false);
    });

    it('un botón viejo avisa que ese pedido ya no está en curso', async () => {
      const { servicio, envios } = crearServicio(null);
      await expect(servicio.manejar(CTX, boton(BOTON.efectivo))).resolves.toBe(
        true,
      );
      expect(envios.texto).toHaveBeenCalledWith(
        CTX,
        expect.stringContaining('ya no está en curso'),
      );
    });

    it('"Ver el menú" manda el catálogo y "Otra cosa" invita a contar qué quiere', async () => {
      const { servicio, envios } = crearServicio(null);
      await servicio.manejar(CTX, boton(BOTON.verMenu));
      expect(envios.catalogo).toHaveBeenCalledWith(
        CTX,
        'https://pizzeriahorebs.shop/catalogo',
      );
      await servicio.manejar(CTX, boton(BOTON.otraCosa));
      expect(envios.texto).toHaveBeenCalledWith(
        CTX,
        expect.stringContaining('Contame'),
      );
    });
  });

  describe('iniciar', () => {
    const item = {
      varianteId: 'v-1',
      cantidad: 1,
      productoNombre: 'Pizza Hawaiana',
      varianteNombre: 'Personal',
      conTamanos: true,
      precio: 18000,
    };

    it('fuera del horario del bot cierra el checkout y avisa', async () => {
      jest.setSystemTime(CERRADO);
      const { servicio, envios } = crearServicio(null);
      await servicio.iniciar(CTX, [item], 0, null);
      expect(envios.limpiar).toHaveBeenCalledWith(CTX);
      expect(envios.texto).toHaveBeenCalledWith(CTX, MENSAJE_CERRADO);
      expect(envios.guardarCarrito).not.toHaveBeenCalled();
    });

    it('sin productos disponibles no arranca', async () => {
      const { servicio, envios } = crearServicio(null);
      await servicio.iniciar(CTX, [], 2, null);
      expect(envios.limpiar).toHaveBeenCalledWith(CTX);
      expect(envios.texto).toHaveBeenCalledWith(
        CTX,
        expect.stringContaining('Ninguno de esos productos'),
      );
    });

    it('si hay pizza y adicionales, ofrece los adicionales antes de la modalidad', async () => {
      const { servicio, preguntas, envios } = crearServicio(null);
      preguntas.ofrecerAdicionales.mockResolvedValue(true);

      await servicio.iniciar(CTX, [item], 0, null);

      expect(preguntas.ofrecerAdicionales).toHaveBeenCalledWith(
        CTX,
        { paso: 'modalidad' },
        expect.stringContaining('¡Anotado!'),
      );
      expect(envios.botones).not.toHaveBeenCalled();
    });

    it('guarda el carrito con ids exactos, el paso y la nota, y pregunta la modalidad', async () => {
      const { servicio, envios } = crearServicio(null);
      await servicio.iniciar(CTX, [item], 1, 'sin cebolla');
      expect(envios.guardarCarrito).toHaveBeenCalledWith(CTX, [
        { varianteId: 'v-1', cantidad: 1 },
      ]);
      expect(envios.guardar).toHaveBeenCalledWith(CTX, {
        paso: 'modalidad',
        nota: 'sin cebolla',
      });
      const [, cuerpo] = envios.botones.mock.calls[0] as [unknown, string];
      expect(cuerpo).toContain('1x Pizza Hawaiana (Personal)');
      expect(cuerpo).toContain('1 producto(s) ya no están disponibles');
    });
  });

  describe('con un checkout en curso', () => {
    it('cancelar limpia el checkout y lo confirma', async () => {
      const { servicio, envios } = crearServicio({ paso: 'direccion' });
      await expect(servicio.manejar(CTX, texto('cancelar'))).resolves.toBe(
        true,
      );
      expect(envios.limpiar).toHaveBeenCalledWith(CTX);
      expect(envios.texto).toHaveBeenCalledWith(
        CTX,
        expect.stringContaining('cancelé el pedido'),
      );
    });

    it('elegir domicilio pasa a pedir la dirección', async () => {
      const checkout: CheckoutWhatsapp = { paso: 'modalidad' };
      const { servicio, preguntas } = crearServicio(checkout);
      await expect(servicio.manejar(CTX, boton(BOTON.domicilio))).resolves.toBe(
        true,
      );
      expect(checkout.modalidad).toBe('domicilio');
      expect(preguntas.direccion).toHaveBeenCalledWith(CTX, checkout);
    });

    it('en el paso de modalidad algo que no es modalidad lo contesta Gemini', async () => {
      const { servicio, preguntas } = crearServicio({ paso: 'modalidad' });
      await expect(
        servicio.manejar(CTX, texto('¿cuánto cuesta la hawaiana?')),
      ).resolves.toBe(false);
      expect(preguntas.direccion).not.toHaveBeenCalled();
    });

    it('un adicional escrito en cualquier paso lo toma el checkout y no avanza el paso', async () => {
      const checkout: CheckoutWhatsapp = {
        paso: 'nombre',
        modalidad: 'retiro',
      };
      const { servicio, preguntas } = crearServicio(checkout);
      preguntas.adicionalEscrito.mockResolvedValue(true);

      await expect(
        servicio.manejar(CTX, texto('con borde de queso')),
      ).resolves.toBe(true);

      expect(preguntas.adicionalEscrito).toHaveBeenCalledWith(
        CTX,
        checkout,
        'con borde de queso',
      );
      expect(checkout.nombre).toBeUndefined();
    });

    it('en el paso de adicionales, "No, seguir" sigue con la modalidad', async () => {
      const checkout: CheckoutWhatsapp = { paso: 'adicionales' };
      const { servicio, preguntas, envios } = crearServicio(checkout);
      preguntas.responderAdicionales.mockResolvedValue('listo');

      await expect(
        servicio.manejar(CTX, boton(BOTON.adicionalesNo)),
      ).resolves.toBe(true);

      expect(checkout.paso).toBe('modalidad');
      expect(envios.botones).toHaveBeenCalledWith(
        CTX,
        '¿Cómo lo querés?',
        expect.any(Array),
      );
    });

    it('en el paso de adicionales, lo que no es del paso lo contesta Gemini', async () => {
      const { servicio, preguntas } = crearServicio({ paso: 'adicionales' });
      preguntas.responderAdicionales.mockResolvedValue('ignorar');

      await expect(
        servicio.manejar(CTX, texto('¿a qué hora abren?')),
      ).resolves.toBe(false);
    });

    it('"Otra dirección" pide la dirección escrita', async () => {
      const checkout: CheckoutWhatsapp = {
        paso: 'direccion',
        modalidad: 'domicilio',
      };
      const { servicio, preguntas } = crearServicio(checkout);
      await servicio.manejar(CTX, boton(BOTON.otraDireccion));
      expect(preguntas.pedirDireccion).toHaveBeenCalledWith(CTX, checkout);
    });

    it('un pin de ubicación no se acepta: se queda en la dirección y pide escribirla', async () => {
      const checkout: CheckoutWhatsapp = {
        paso: 'direccion',
        modalidad: 'domicilio',
      };
      const { servicio, envios, preguntas } = crearServicio(checkout);
      await expect(
        servicio.manejar(CTX, {
          tipo: 'ubicacion',
          latitud: 11.5298282,
          longitud: -72.904363,
        }),
      ).resolves.toBe(true);
      expect(checkout.direccion).toBeUndefined();
      expect(checkout.paso).toBe('direccion');
      expect(envios.texto).toHaveBeenCalledWith(CTX, TEXTO_PIDE_ESCRITA);
      expect(preguntas.hora).not.toHaveBeenCalled();
    });

    it('una dirección escrita pasa al siguiente paso (el nombre)', async () => {
      const checkout: CheckoutWhatsapp = {
        paso: 'direccion',
        modalidad: 'domicilio',
      };
      const { servicio, envios } = crearServicio(checkout);
      await servicio.manejar(CTX, texto('Calle 15 # 8-20, barrio Los Nogales'));
      expect(checkout.direccion).toBe('Calle 15 # 8-20, barrio Los Nogales');
      expect(envios.texto).toHaveBeenCalledWith(
        CTX,
        expect.stringContaining('¿A nombre de quién'),
      );
    });

    it('con solo el nombre pregunta el apellido; con el apellido avanza a la hora', async () => {
      const checkout: CheckoutWhatsapp = {
        paso: 'nombre',
        modalidad: 'retiro',
      };
      const { servicio, envios, preguntas } = crearServicio(checkout);

      await servicio.manejar(CTX, texto('Ana'));
      expect(envios.texto).toHaveBeenCalledWith(
        CTX,
        'Gracias, Ana. ¿Y tu apellido?',
      );
      expect(preguntas.hora).not.toHaveBeenCalled();

      await servicio.manejar(CTX, texto('Pérez'));
      expect(checkout).toMatchObject({ nombre: 'Ana', apellido: 'Pérez' });
      expect(preguntas.hora).toHaveBeenCalledWith(CTX, checkout);
    });

    it('en el paso de teléfono guarda el número y avanza', async () => {
      const checkout: CheckoutWhatsapp = {
        paso: 'telefono',
        modalidad: 'retiro',
        nombre: 'Ana',
        apellido: 'Pérez',
      };
      const { servicio, envios, preguntas } = crearServicio(checkout);
      const ctxSocial = { ...CTX, canal: 'messenger' as const };

      await expect(
        servicio.manejar(ctxSocial, texto('315 786 1208')),
      ).resolves.toBe(true);

      expect(checkout.telefono).toBe('3157861208');
      expect(envios.guardarTelefono).toHaveBeenCalledWith(
        ctxSocial,
        '3157861208',
      );
      expect(preguntas.hora).toHaveBeenCalledWith(ctxSocial, checkout);
    });

    it('en el paso de teléfono pide corregir si el número es inválido', async () => {
      const checkout: CheckoutWhatsapp = {
        paso: 'telefono',
        modalidad: 'retiro',
        nombre: 'Ana',
        apellido: 'Pérez',
      };
      const { servicio, envios } = crearServicio(checkout);
      const ctxSocial = { ...CTX, canal: 'instagram' as const };

      await expect(servicio.manejar(ctxSocial, texto('1234'))).resolves.toBe(
        true,
      );

      expect(envios.guardarTelefono).not.toHaveBeenCalled();
      expect(envios.texto).toHaveBeenCalledWith(
        ctxSocial,
        expect.stringContaining(
          'Porfa escribí un número de teléfono de 10 dígitos',
        ),
      );
    });

    it('elegir la hora pasa al resumen con los botones de pago', async () => {
      const checkout: CheckoutWhatsapp = {
        paso: 'hora',
        modalidad: 'retiro',
        nombre: 'Ana',
        apellido: 'Pérez',
      };
      const { servicio, preguntas } = crearServicio(checkout);
      await servicio.manejar(CTX, boton('ck:hora:ya'));
      expect(checkout.entrega).toBe('ya');
      expect(preguntas.pago).toHaveBeenCalledWith(CTX, checkout);
    });

    it('pagar con una franja vigente crea el pedido', async () => {
      const checkout: CheckoutWhatsapp = {
        paso: 'pago',
        modalidad: 'retiro',
        nombre: 'Ana',
        apellido: 'Pérez',
        entrega: 'ya',
      };
      const { servicio, pedido } = crearServicio(checkout);
      await expect(servicio.manejar(CTX, boton(BOTON.efectivo))).resolves.toBe(
        true,
      );
      expect(pedido.crear).toHaveBeenCalledWith(
        CTX,
        checkout,
        'efectivo',
        expect.objectContaining({ id: 'ya' }),
      );
    });

    it('si la franja venció mientras decidía, vuelve a ofrecer las horas sin crear el pedido', async () => {
      const checkout: CheckoutWhatsapp = {
        paso: 'pago',
        modalidad: 'retiro',
        nombre: 'Ana',
        apellido: 'Pérez',
        entrega: '16:00',
      };
      const { servicio, pedido, preguntas, envios } = crearServicio(checkout);
      await servicio.manejar(CTX, boton(BOTON.tarjeta));
      expect(pedido.crear).not.toHaveBeenCalled();
      expect(envios.texto).toHaveBeenCalledWith(
        CTX,
        expect.stringContaining('Esa hora ya no está disponible'),
      );
      expect(preguntas.hora).toHaveBeenCalledWith(CTX, checkout);
    });
  });

  describe('ofrecerPagoDesdeCalculo', () => {
    const datos = (entrega?: string) => ({
      identificadorExterno: '573157861208',
      conversacionId: 'conv-1',
      items: [{ varianteId: 'v-1', cantidad: 1 }],
      checkout: {
        paso: 'pago' as const,
        modalidad: 'retiro' as const,
        entrega,
      },
    });

    it('sin hora de entrega primero pregunta la hora', async () => {
      const { servicio, preguntas, envios } = crearServicio(null);
      const aviso = await servicio.ofrecerPagoDesdeCalculo(datos());
      expect(envios.guardarCarrito).toHaveBeenCalled();
      expect(preguntas.hora).toHaveBeenCalled();
      expect(preguntas.pago).not.toHaveBeenCalled();
      expect(aviso).toContain('lista de horarios');
    });

    it('con la hora ya elegida ofrece el pago y devuelve el resumen', async () => {
      const { servicio, preguntas } = crearServicio(null);
      await expect(servicio.ofrecerPagoDesdeCalculo(datos('ya'))).resolves.toBe(
        'resumen',
      );
      expect(preguntas.pago).toHaveBeenCalled();
    });
  });

  describe('ofrecerLoMismo', () => {
    it('fuera de horario no ofrece nada', async () => {
      jest.setSystemTime(CERRADO);
      const { servicio, historial } = crearServicio(null);
      await expect(servicio.ofrecerLoMismo(CTX)).resolves.toBe(false);
      expect(historial.ultimoPedidoRepetible).not.toHaveBeenCalled();
    });

    it('un cliente que nunca compró no tiene "lo mismo"', async () => {
      const { servicio, envios } = crearServicio(null);
      await expect(servicio.ofrecerLoMismo(CTX)).resolves.toBe(false);
      expect(envios.botones).not.toHaveBeenCalled();
    });

    it('ofrece repetir el último pedido con el subtotal desde la base', async () => {
      const { servicio, historial, envios } = crearServicio(null);
      historial.cliente.mockResolvedValue({ nombre: 'Ana' });
      historial.ultimoPedidoRepetible.mockResolvedValue({
        disponibles: [
          {
            varianteId: 'v-1',
            cantidad: 2,
            productoNombre: 'Pizza Hawaiana',
            varianteNombre: 'Personal',
            conTamanos: false,
            precio: 18000,
          },
        ],
        noDisponibles: 0,
      });
      await expect(servicio.ofrecerLoMismo(CTX)).resolves.toBe(true);
      const [, cuerpo] = envios.botones.mock.calls[0] as [unknown, string];
      expect(cuerpo).toContain('¡Hola Ana!');
      expect(cuerpo).toContain('2x Pizza Hawaiana');
      expect(cuerpo).toContain(`$${(36000).toLocaleString('es-CO')}`);
    });
  });
});
