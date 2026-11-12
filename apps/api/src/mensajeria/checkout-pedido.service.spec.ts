import type { PedidosService } from '../pedidos/pedidos.service';
import type { AvisoEquipoService } from './aviso-equipo.service';
import type { CheckoutEnviosService } from './checkout-envios.service';
import { textoConfirmacionPedido } from './confirmacion-pedido';
import { ConfirmacionPedidoService } from './confirmacion-pedido.service';
import type { ConversionesSocialService } from './conversiones-social.service';
import type { OrigenConversacionService } from './origen-conversacion.service';
import type { PagoBoldService } from './pago-bold.service';
import {
  CheckoutPedidoService,
  datosPedidoWhatsapp,
  type FranjaElegida,
} from './checkout-pedido.service';
import type { ContextoCheckout } from './checkout-whatsapp';
import type {
  CheckoutWhatsapp,
  ConversacionesService,
} from './conversaciones.service';

const CTX: ContextoCheckout = {
  identificadorExterno: '573157861208',
  conversacionId: 'conv-1',
  mensajeId: 'wamid.9',
};
const CHECKOUT: CheckoutWhatsapp = {
  paso: 'pago',
  modalidad: 'domicilio',
  direccion: 'Carrera 7 # 17B - 66',
  nombre: 'Ana',
  apellido: 'Pérez',
  nota: 'sin cebolla',
  entrega: 'ya',
};
const YA: FranjaElegida = {
  id: 'ya',
  titulo: 'Lo antes posible',
  programadoPara: null,
};
const RESERVA: FranjaElegida = {
  id: '18:30',
  titulo: '6:30 p.m.',
  programadoPara: '2026-10-31T18:30:00-05:00',
};
const CARRITO = [{ varianteId: 'v-1', cantidad: 2 }];

describe('datosPedidoWhatsapp', () => {
  const armar = (checkout: CheckoutWhatsapp, franja = YA, ctx = CTX) =>
    datosPedidoWhatsapp({
      ctx,
      checkout,
      metodo: 'efectivo',
      franja,
      carrito: CARRITO,
    });

  it('un domicilio lleva la dirección en el cliente y en la entrega', () => {
    expect(armar(CHECKOUT)).toEqual({
      cliente: {
        nombre: 'Ana',
        apellido: 'Pérez',
        telefono: '573157861208',
        direccion: 'Carrera 7 # 17B - 66',
      },
      modalidad: 'domicilio',
      direccion_entrega: 'Carrera 7 # 17B - 66',
      metodo_pago: 'efectivo',
      notas: 'sin cebolla',
      programado_para: null,
      aplicar_promocion: false,
      oferta_seguimiento: false,
      items: [{ variante_id: 'v-1', cantidad: 2 }],
      idempotency_key: 'wa:wamid.9',
    });
  });

  it('pide el descuento solo si el resumen con descuento se mostró hace poco', () => {
    jest.useFakeTimers({ now: new Date('2026-11-04T20:00:00Z') });
    try {
      const hace = (min: number) =>
        new Date(Date.now() - min * 60_000).toISOString();
      const conPromo = (promocionCotizadaEn?: string) =>
        armar({ ...CHECKOUT, promocionCotizadaEn }).aplicar_promocion;

      expect(conPromo(hace(30))).toBe(true);
      expect(conPromo(hace(121))).toBe(false);
      expect(conPromo(undefined)).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('retirar no lleva dirección aunque haya una guardada', () => {
    const datos = armar({ ...CHECKOUT, modalidad: 'retiro' });
    expect(datos.cliente).not.toHaveProperty('direccion');
    expect(datos.direccion_entrega).toBeUndefined();
    expect(datos.modalidad).toBe('retiro');
  });

  it('una reserva lleva su hora y sin mensaje no hay llave de idempotencia', () => {
    const datos = armar(CHECKOUT, RESERVA, { ...CTX, mensajeId: null });
    expect(datos.programado_para).toBe('2026-10-31T18:30:00-05:00');
    expect(datos.idempotency_key).toBeUndefined();
  });

  it('en Instagram usa prefijo ig para idempotency_key y toma el teléfono del contexto', () => {
    const ctxInstagram: ContextoCheckout = {
      identificadorExterno: 'igsid-456',
      conversacionId: 'conv-2',
      mensajeId: 'mid.123',
      canal: 'instagram',
      telefono: '3157861208',
    };
    const datos = datosPedidoWhatsapp({
      ctx: ctxInstagram,
      checkout: CHECKOUT,
      metodo: 'efectivo',
      franja: YA,
      carrito: CARRITO,
    });
    expect(datos.cliente.telefono).toBe('3157861208');
    expect(datos.idempotency_key).toBe('ig:mid.123');
  });
});

describe('textoConfirmacionPedido', () => {
  const base = {
    nombre: 'Ana',
    pedido: { id: 'abcdef12-3456', total: 33000 },
    programadoPara: null,
  };

  it('confirma el pedido con su código corto y el total', () => {
    const texto = textoConfirmacionPedido({ ...base, metodo: 'efectivo' });
    expect(texto).toContain('Ana!');
    expect(texto).toContain('*#abcdef12*');
    expect(texto).toContain(`*$${(33000).toLocaleString('es-CO')}*`);
    expect(texto).not.toContain('Para transferir');
  });

  it('con transferencia incluye el banco y la llave confirmados', () => {
    const texto = textoConfirmacionPedido({ ...base, metodo: 'transferencia' });
    expect(texto).toContain('*Banco Nu*');
    expect(texto).toContain('*1118843420*');
  });

  it('con tarjeta y link de Bold manda el enlace de pago', () => {
    const texto = textoConfirmacionPedido({
      ...base,
      metodo: 'tarjeta',
      enlacePago: 'https://checkout.bold.co/LNK_1',
    });
    expect(texto).toContain('https://checkout.bold.co/LNK_1');
    expect(texto).toContain('paga con tarjeta');
    expect(texto).not.toContain('Te aviso por acá cuando lo confirmemos');
  });

  it('con tarjeta y sin link avisa que el equipo enviará el enlace', () => {
    const texto = textoConfirmacionPedido({ ...base, metodo: 'tarjeta' });
    expect(texto).toContain('con el enlace para pagar con tarjeta');
    expect(texto).not.toContain('http');
  });

  it('una reserva dice para qué hora quedó', () => {
    const texto = textoConfirmacionPedido({
      ...base,
      programadoPara: RESERVA.programadoPara,
      metodo: 'efectivo',
    });
    expect(texto).toContain('Quedó reservado para las');
  });
});

/** El `metodoPago` con el que se avisó al equipo en la primera llamada. */
function metodoDelAviso(notificar: jest.Mock): string {
  const [aviso] = notificar.mock.calls[0] as [
    { pedido: { metodoPago: string } },
  ];
  return aviso.pedido.metodoPago;
}

describe('CheckoutPedidoService.crear', () => {
  function crearServicio(
    crearDesdeWhatsapp: jest.Mock,
    enlacePago: string | null = null,
  ) {
    const pedidos = {
      crearDesdeBot: crearDesdeWhatsapp,
      crearDesdeWhatsapp,
    };
    const conversaciones = {
      obtenerCarrito: jest.fn().mockResolvedValue(CARRITO),
      derivarAHumano: jest.fn().mockResolvedValue(undefined),
      guardarTelefono: jest.fn().mockResolvedValue(undefined),
    };
    const avisoEquipo = { notificar: jest.fn() };
    const envios = {
      texto: jest.fn().mockResolvedValue(undefined),
      limpiar: jest.fn().mockResolvedValue(undefined),
    };
    const pagoBold = { iniciarCobro: jest.fn().mockResolvedValue(enlacePago) };
    const servicio = new CheckoutPedidoService(
      pedidos as unknown as PedidosService,
      conversaciones as unknown as ConversacionesService,
      avisoEquipo as unknown as AvisoEquipoService,
      new ConfirmacionPedidoService(
        envios as unknown as CheckoutEnviosService,
        pagoBold as unknown as PagoBoldService,
        {
          vincularPedido: () => Promise.resolve(),
        } as unknown as OrigenConversacionService,
        {
          avisarPedido: () => undefined,
        } as unknown as ConversionesSocialService,
      ),
    );
    return { servicio, conversaciones, avisoEquipo, envios, pagoBold };
  }

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('crea el pedido, limpia el checkout, confirma y avisa al equipo', async () => {
    const crear = jest
      .fn()
      .mockResolvedValue({ id: 'abcdef12-3456', total: 33000 });
    const { servicio, avisoEquipo, envios } = crearServicio(crear);

    await servicio.crear(CTX, CHECKOUT, 'transferencia', YA);

    expect(crear).toHaveBeenCalledWith(
      expect.objectContaining({
        metodo_pago: 'transferencia',
        idempotency_key: 'wa:wamid.9',
      }),
      'whatsapp',
    );
    expect(envios.limpiar).toHaveBeenCalledWith(CTX);
    expect(envios.texto).toHaveBeenCalledWith(
      CTX,
      expect.stringContaining('*Banco Nu*'),
    );
    expect(avisoEquipo.notificar).toHaveBeenCalledWith(
      expect.objectContaining({
        pedido: {
          id: 'abcdef12-3456',
          total: 33000,
          metodoPago: 'transferencia',
        },
      }),
    );
  });

  it('con tarjeta genera el cobro, manda el enlace y avisa al equipo que el pago está pendiente', async () => {
    const crear = jest
      .fn()
      .mockResolvedValue({ id: 'abcdef12-3456', total: 33000 });
    const { servicio, avisoEquipo, envios, pagoBold } = crearServicio(
      crear,
      'https://checkout.bold.co/LNK_1',
    );

    await servicio.crear(CTX, CHECKOUT, 'tarjeta', YA);

    expect(pagoBold.iniciarCobro).toHaveBeenCalledWith(
      {
        id: 'abcdef12-3456',
        total: 33000,
      },
      'whatsapp',
    );
    expect(envios.texto).toHaveBeenCalledWith(
      CTX,
      expect.stringContaining('https://checkout.bold.co/LNK_1'),
    );
    expect(metodoDelAviso(avisoEquipo.notificar)).toBe(
      'tarjeta (pago pendiente)',
    );
  });

  it('en canales sociales guarda el teléfono en la conversación al crear el pedido', async () => {
    const crear = jest
      .fn()
      .mockResolvedValue({ id: 'abcdef12-3456', total: 33000 });
    const { servicio, conversaciones } = crearServicio(crear);

    const ctxSocial: ContextoCheckout = {
      canal: 'messenger',
      identificadorExterno: 'psid-99',
      conversacionId: 'conv-99',
      mensajeId: 'mid.99',
    };
    const checkoutConTel: CheckoutWhatsapp = {
      ...CHECKOUT,
      telefono: '3157861208',
    };

    await servicio.crear(ctxSocial, checkoutConTel, 'efectivo', YA);

    expect(conversaciones.guardarTelefono).toHaveBeenCalledWith(
      'messenger',
      'psid-99',
      '3157861208',
    );
  });

  it('con efectivo o transferencia no se toca Bold', async () => {
    const crear = jest
      .fn()
      .mockResolvedValue({ id: 'abcdef12-3456', total: 33000 });
    const { servicio, pagoBold } = crearServicio(crear);

    await servicio.crear(CTX, CHECKOUT, 'efectivo', YA);
    await servicio.crear(CTX, CHECKOUT, 'transferencia', YA);

    expect(pagoBold.iniciarCobro).not.toHaveBeenCalled();
  });

  it('con tarjeta y Bold apagado, confirma igual y el aviso no dice pendiente', async () => {
    const crear = jest
      .fn()
      .mockResolvedValue({ id: 'abcdef12-3456', total: 33000 });
    const { servicio, avisoEquipo, envios } = crearServicio(crear, null);

    await servicio.crear(CTX, CHECKOUT, 'tarjeta', YA);

    expect(envios.texto).toHaveBeenCalledWith(
      CTX,
      expect.stringContaining('te escribe por acá con el enlace'),
    );
    expect(metodoDelAviso(avisoEquipo.notificar)).toBe('tarjeta');
  });

  it('si no se puede registrar, deriva a una persona y no deja al cliente sin respuesta', async () => {
    const crear = jest.fn().mockRejectedValue(new Error('base caída'));
    const { servicio, conversaciones, avisoEquipo, envios } =
      crearServicio(crear);

    await servicio.crear(CTX, CHECKOUT, 'efectivo', YA);

    expect(conversaciones.derivarAHumano).toHaveBeenCalledWith(
      'whatsapp',
      '573157861208',
    );
    expect(envios.texto).toHaveBeenCalledWith(
      CTX,
      expect.stringContaining('No pude registrar tu pedido'),
    );
    expect(envios.limpiar).not.toHaveBeenCalled();
    // Sin pedido: el aviso al equipo es solo "esta conversación necesita una persona".
    expect(avisoEquipo.notificar).toHaveBeenCalledWith({
      canal: 'whatsapp',
      identificadorExterno: '573157861208',
      telefono: '573157861208',
      conversacionId: 'conv-1',
    });
  });
});
