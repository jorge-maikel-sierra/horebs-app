import type { ConfigService } from '@nestjs/config';
import type { SupabaseService } from '../supabase/supabase.service';
import type { VentaCajaParaEvento } from './conversiones-caja';
import { ConversionesCajaService } from './conversiones-caja.service';
import type { ConversionesMetaService } from './conversiones-meta.service';

const VENTA: VentaCajaParaEvento = {
  pedidoId: 'ped-1',
  total: 40000,
  modalidad: 'local',
  origen: 'mostrador',
  creadoEn: new Date('2026-11-16T20:00:00Z'),
  cliente: {
    id: 'c-1',
    nombre: 'Ana',
    apellido: null,
    telefono: '3157861208',
    correo: null,
  },
  items: [{ varianteId: 'v-1', cantidad: 1 }],
};
const AHORA = new Date('2026-11-16T21:00:00Z');

function crearServicio(
  opciones: {
    configurado?: boolean;
    porAnuncio?: boolean;
    yaEnviado?: boolean;
  } = {},
) {
  const {
    configurado = true,
    porAnuncio = false,
    yaEnviado = false,
  } = opciones;
  const claves: Record<string, unknown>[] = [];
  const client = {
    from: () => ({
      insert: (fila: Record<string, unknown>) => {
        claves.push(fila);
        return Promise.resolve({
          error: yaEnviado ? { code: '23505', message: 'duplicate' } : null,
        });
      },
      delete: () => ({ eq: () => ({ eq: () => Promise.resolve({}) }) }),
    }),
  };
  const valores = new Map([
    ['META_EVENTS_ACCESS_TOKEN', 't'],
    ['META_DATASET_ID_SOCIAL', 'd'],
  ]);
  const config = {
    get: (clave: string) => (configurado ? valores.get(clave) : undefined),
  };
  const whatsapp = { notificarCompra: jest.fn().mockResolvedValue(porAnuncio) };
  const servicio = new ConversionesCajaService(
    config as unknown as ConfigService,
    { getClient: () => client } as unknown as SupabaseService,
    whatsapp as unknown as ConversionesMetaService,
  );
  return { servicio, claves, whatsapp };
}

describe('ConversionesCajaService.enviarVenta', () => {
  const fetchOriginal = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;
  });
  afterEach(() => {
    global.fetch = fetchOriginal;
  });

  it('manda el Purchase al dataset con valor y datos cifrados', async () => {
    const { servicio, claves } = crearServicio();

    await expect(servicio.enviarVenta(VENTA, AHORA)).resolves.toBe('enviada');

    expect(claves).toEqual([{ evento: 'Purchase', referencia_id: 'ped-1' }]);
    const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(url).toContain('/d/events');
    const evento = (
      JSON.parse(init.body) as { data: Record<string, unknown>[] }
    ).data[0];
    expect(evento).toEqual(
      expect.objectContaining({
        event_id: 'ped-1',
        action_source: 'physical_store',
      }),
    );
    expect(init.body).not.toContain('3157861208');
  });

  it('si el cliente llegó por un anuncio de WhatsApp no manda el de caja', async () => {
    const { servicio } = crearServicio({ porAnuncio: true });

    await expect(servicio.enviarVenta(VENTA, AHORA)).resolves.toBe(
      'por_anuncio',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('un pedido ya enviado no se repite', async () => {
    const { servicio } = crearServicio({ yaEnviado: true });

    await expect(servicio.enviarVenta(VENTA, AHORA)).resolves.toBe('repetida');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('la venta a "Consumidor Final" no va a Meta ni se cruza con anuncios', async () => {
    const { servicio, whatsapp } = crearServicio({ porAnuncio: true });
    const generica = {
      ...VENTA,
      cliente: { ...VENTA.cliente, nombre: 'Consumidor', apellido: 'Final' },
    };

    await expect(servicio.enviarVenta(generica, AHORA)).resolves.toBe(
      'sin_datos',
    );
    expect(whatsapp.notificarCompra).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sin teléfono ni correo no manda nada', async () => {
    const { servicio } = crearServicio();
    const sinDatos = {
      ...VENTA,
      cliente: { ...VENTA.cliente, telefono: null },
    };

    await expect(servicio.enviarVenta(sinDatos, AHORA)).resolves.toBe(
      'sin_datos',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('un domicilio viejo que Meta ya no acepta se salta', async () => {
    const { servicio } = crearServicio();
    const viejo = {
      ...VENTA,
      origen: 'llamada' as const,
      creadoEn: new Date('2026-11-01T20:00:00Z'),
    };

    await expect(servicio.enviarVenta(viejo, AHORA)).resolves.toBe('vencida');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sin configuración queda apagado', async () => {
    const { servicio, whatsapp } = crearServicio({ configurado: false });

    await expect(servicio.enviarVenta(VENTA, AHORA)).resolves.toBe('apagado');
    expect(whatsapp.notificarCompra).not.toHaveBeenCalled();
  });
});

describe('ConversionesCajaService.avisarVenta', () => {
  it('si Meta falla no lanza: la venta no se cae', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('caído'));
    const { servicio } = crearServicio();

    expect(() => servicio.avisarVenta(VENTA)).not.toThrow();
    await new Promise((r) => setImmediate(r));
  });
});
