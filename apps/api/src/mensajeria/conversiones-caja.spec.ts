import {
  actionSourceDeVenta,
  eventoVigente,
  payloadPurchaseCaja,
  userDataCaja,
  type VentaCajaParaEvento,
} from './conversiones-caja';
import { sha256 } from './conversiones-web';

const VENTA: VentaCajaParaEvento = {
  pedidoId: 'ped-1',
  total: 47000,
  modalidad: 'domicilio',
  origen: 'whatsapp',
  creadoEn: new Date('2026-11-10T23:00:00Z'),
  cliente: {
    id: 'c-1',
    nombre: 'Ana María',
    apellido: 'Pérez',
    telefono: '3157861208',
    correo: ' Ana@Correo.com ',
  },
  items: [
    { varianteId: 'v-1', cantidad: 2 },
    { varianteId: null, cantidad: 1 },
  ],
};

describe('actionSourceDeVenta', () => {
  it.each([
    ['mostrador', 'domicilio', 'physical_store'],
    ['llamada', 'local', 'phone_call'],
    ['whatsapp', 'domicilio', 'chat'],
    ['messenger', 'local', 'chat'],
    ['instagram', 'local', 'chat'],
    [null, 'local', 'physical_store'],
    [null, 'retiro', 'physical_store'],
    [null, 'domicilio', 'phone_call'],
  ] as const)(
    'origen %s y modalidad %s → %s',
    (origen, modalidad, esperado) => {
      expect(actionSourceDeVenta(origen, modalidad)).toBe(esperado);
    },
  );
});

describe('userDataCaja', () => {
  it('cifra teléfono con indicativo, correo y nombre; nada va en claro', () => {
    const datos = userDataCaja(VENTA.cliente);

    expect(datos).toEqual({
      ph: [sha256('573157861208')],
      em: [sha256('ana@correo.com')],
      fn: [sha256('anamaría')],
      ln: [sha256('pérez')],
      ct: [sha256('riohacha')],
      st: [sha256('laguajira')],
      country: [sha256('co')],
      external_id: [sha256('c-1')],
    });
    expect(JSON.stringify(datos)).not.toContain('3157861208');
  });

  it('con solo el teléfono alcanza y omite lo que falta', () => {
    const datos = userDataCaja({
      id: 'c-2',
      nombre: null,
      apellido: null,
      telefono: '3157861208',
      correo: null,
    });

    expect(datos).toEqual(
      expect.objectContaining({ ph: [sha256('573157861208')] }),
    );
    expect(datos).not.toHaveProperty('em');
    expect(datos).not.toHaveProperty('fn');
  });

  it('sin teléfono ni correo no hay con qué emparejar: null', () => {
    expect(
      userDataCaja({
        id: 'c-3',
        nombre: 'Luis',
        apellido: null,
        telefono: null,
        correo: null,
      }),
    ).toBeNull();
  });
});

describe('payloadPurchaseCaja', () => {
  it('lleva valor, COP, id del pedido, la hora de la venta y solo variantes reales', () => {
    const payload = payloadPurchaseCaja(VENTA, { ph: ['x'] });

    expect(payload).toEqual({
      event_name: 'Purchase',
      event_time: Math.floor(Date.parse('2026-11-10T23:00:00Z') / 1000),
      event_id: 'ped-1',
      action_source: 'chat',
      user_data: { ph: ['x'] },
      custom_data: {
        currency: 'COP',
        value: 47000,
        order_id: 'ped-1',
        content_type: 'product',
        content_ids: ['v-1'],
        contents: [{ id: 'v-1', quantity: 2 }],
      },
    });
  });
});

describe('eventoVigente', () => {
  const ahora = new Date('2026-11-16T12:00:00Z');

  it('un evento de hace 3 días lo acepta Meta en cualquier fuente', () => {
    const hace3 = new Date('2026-11-13T12:00:00Z');
    expect(eventoVigente('phone_call', hace3, ahora)).toBe(true);
  });

  it('a los 15 días solo vale el de tienda física', () => {
    const hace15 = new Date('2026-11-01T12:00:00Z');
    expect(eventoVigente('phone_call', hace15, ahora)).toBe(false);
    expect(eventoVigente('chat', hace15, ahora)).toBe(false);
    expect(eventoVigente('physical_store', hace15, ahora)).toBe(true);
  });
});
