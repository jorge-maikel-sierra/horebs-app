import type { PedidosService } from '../pedidos/pedidos.service';
import type { AvisoEquipoService } from './aviso-equipo.service';
import type { CheckoutEnviosService } from './checkout-envios.service';
import {
  CheckoutPedidoService,
  datosPedidoWhatsapp,
  textoConfirmacionPedido,
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
      items: [{ variante_id: 'v-1', cantidad: 2 }],
      idempotency_key: 'wa:wamid.9',
    });
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

  it('una reserva dice para qué hora quedó', () => {
    const texto = textoConfirmacionPedido({
      ...base,
      programadoPara: RESERVA.programadoPara,
      metodo: 'efectivo',
    });
    expect(texto).toContain('Quedó reservado para las');
  });
});

describe('CheckoutPedidoService.crear', () => {
  function crearServicio(crearDesdeWhatsapp: jest.Mock) {
    const pedidos = { crearDesdeWhatsapp };
    const conversaciones = {
      obtenerCarrito: jest.fn().mockResolvedValue(CARRITO),
      derivarAHumano: jest.fn().mockResolvedValue(undefined),
    };
    const avisoEquipo = { notificar: jest.fn() };
    const envios = {
      texto: jest.fn().mockResolvedValue(undefined),
      limpiar: jest.fn().mockResolvedValue(undefined),
    };
    const servicio = new CheckoutPedidoService(
      pedidos as unknown as PedidosService,
      conversaciones as unknown as ConversacionesService,
      avisoEquipo as unknown as AvisoEquipoService,
      envios as unknown as CheckoutEnviosService,
    );
    return { servicio, conversaciones, avisoEquipo, envios };
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
