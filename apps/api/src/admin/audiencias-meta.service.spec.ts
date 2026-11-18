/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await -- mocks de supabase y fetch */
import { AudienciasMetaService } from './audiencias-meta.service';

const AHORA = new Date('2026-11-17T12:00:00.000Z');
const MS_DIA = 86_400_000;
const haceDias = (n: number) =>
  new Date(AHORA.getTime() - n * MS_DIA).toISOString();

const CLIENTES = [
  {
    id: 'c1',
    nombre: 'Ana',
    apellido: 'Pérez',
    telefono: '3157861208',
    correo: null,
    ciudad: 'Riohacha',
    departamento: 'La Guajira',
  },
  {
    id: 'c2',
    nombre: 'Luis',
    apellido: null,
    telefono: '3001234567',
    correo: 'luis@correo.com',
    ciudad: 'Riohacha',
    departamento: 'La Guajira',
  },
];
const PEDIDOS = [
  {
    id: 'p1',
    cliente_id: 'c1',
    total: 50000,
    estado: 'entregado',
    created_at: haceDias(60),
  },
  {
    id: 'p2',
    cliente_id: 'c1',
    total: 40000,
    estado: 'entregado',
    created_at: haceDias(50),
  },
  {
    id: 'p3',
    cliente_id: 'c2',
    total: 20000,
    estado: 'entregado',
    created_at: haceDias(3),
  },
];

function crearServicio(
  opciones: { activo?: boolean; guardadas?: unknown[] } = {},
) {
  const { activo = true, guardadas = [] } = opciones;
  const tablas = new Map<string, unknown[]>([
    ['clientes', CLIENTES],
    ['pedidos', PEDIDOS],
    ['audiencias_meta', guardadas],
  ]);
  const filasGuardadas: Record<string, unknown>[] = [];
  const supabase = {
    getClient: () => ({
      from: (tabla: string) => {
        const consulta = {
          select: jest.fn(() => consulta),
          order: jest.fn(() => consulta),
          range: jest.fn(() => consulta),
          returns: jest.fn(() =>
            Promise.resolve({ data: tablas.get(tabla) ?? [], error: null }),
          ),
          upsert: jest.fn(async (fila: Record<string, unknown>) => {
            filasGuardadas.push(fila);
            return { error: null };
          }),
        };
        return consulta;
      },
    }),
  };
  const valores = new Map(
    Object.entries({
      META_AD_ACCOUNT_ID: '123',
      META_ADS_ACCESS_TOKEN: 'tok',
      ...(activo ? { META_AUDIENCIAS_ACTIVAS: 'true' } : {}),
    }),
  );
  const config = { get: (k: string) => valores.get(k) };
  const servicio = new AudienciasMetaService(
    config as never,
    supabase as never,
  );
  return { servicio, filasGuardadas };
}

describe('AudienciasMetaService', () => {
  let fetchMock: jest.Mock;
  let contador: number;

  beforeEach(() => {
    contador = 0;
    fetchMock = jest.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        url.endsWith('/customaudiences')
          ? { id: `aud-${(contador += 1)}` }
          : {},
    }));
    global.fetch = fetchMock as never;
  });

  it('apagado por defecto: no llama a Meta aunque haya cuenta y token', async () => {
    const { servicio } = crearServicio({ activo: false });
    const r = await servicio.sincronizar(AHORA);
    expect(r.estado).toBe('apagado');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('previsualizar cuenta personas por segmento sin enviar nada', async () => {
    const { servicio } = crearServicio({ activo: false });
    const vista = await servicio.previsualizar(AHORA);
    expect(fetchMock).not.toHaveBeenCalled();
    const porClave = new Map(vista.map((s) => [s.clave, s.personas]));
    expect(porClave.get('recurrentes')).toBe(1);
    expect(porClave.get('recientes')).toBe(1);
  });

  it('crea cada público una vez y reemplaza sus miembros con datos cifrados', async () => {
    const { servicio, filasGuardadas } = crearServicio();
    const r = await servicio.sincronizar(AHORA);

    expect(r.estado).toBe('sincronizado');
    const creaciones = fetchMock.mock.calls.filter(([u]) =>
      u.endsWith('/customaudiences'),
    );
    const reemplazos = fetchMock.mock.calls.filter(([u]) =>
      u.endsWith('/usersreplace'),
    );
    expect(creaciones.length).toBe(r.enviadas.length);
    expect(reemplazos.length).toBe(r.enviadas.length);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
    const cuerpos = reemplazos.map(([, init]) => init.body as string).join('');
    expect(cuerpos).not.toContain('3157861208');
    expect(cuerpos).not.toContain('luis@correo.com');
    expect(filasGuardadas.length).toBe(r.enviadas.length);
  });

  it('un público que ya existe se refresca sin crearlo de nuevo', async () => {
    const guardadas = [
      'recurrentes',
      'inactivos',
      'nuevos',
      'mejores',
      'recientes',
    ].map((clave) => ({
      clave,
      nombre: clave,
      audiencia_id: `ya-${clave}`,
      ultimo_envio: 1,
      sincronizado_en: null,
    }));
    const { servicio } = crearServicio({ guardadas });
    await servicio.sincronizar(AHORA);
    expect(
      fetchMock.mock.calls.some(([u]) => u.endsWith('/customaudiences')),
    ).toBe(false);
    expect(
      fetchMock.mock.calls.some(([u]) =>
        u.includes('ya-recurrentes/usersreplace'),
      ),
    ).toBe(true);
  });

  it('si Meta rechaza un segmento, los demás siguen y el error se informa', async () => {
    fetchMock.mockImplementationOnce(async () => ({
      ok: false,
      status: 400,
      text: async () => 'bad',
    }));
    const { servicio } = crearServicio();
    const r = await servicio.sincronizar(AHORA);
    expect(r.errores).toHaveLength(1);
    expect(r.errores[0]).toContain('Marketing API 400');
    expect(r.enviadas.length).toBeGreaterThan(0);
  });

  it('el público parecido espera a que la semilla llegue a 100 personas', async () => {
    const { servicio } = crearServicio();
    const r = await servicio.sincronizar(AHORA);
    expect(r.parecido).toBe('pendiente');
  });

  it('el cron nunca lanza aunque Meta falle', async () => {
    fetchMock.mockRejectedValue(new Error('red caída'));
    const { servicio } = crearServicio();
    await expect(servicio.sincronizarCadaDia()).resolves.toBeUndefined();
  });
});
