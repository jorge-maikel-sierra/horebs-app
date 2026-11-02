import { ConflictException, NotFoundException } from '@nestjs/common';
import type { SupabaseService } from '../supabase/supabase.service';
import type { ClientesDirectorioService } from './clientes-directorio.service';
import { ClientesService } from './clientes.service';

interface Resultado {
  data?: unknown;
  count?: number | null;
  error: { message: string; code?: string } | null;
}

interface Llamada {
  tabla: string;
  metodo: string;
  args: unknown[];
}

interface Consulta {
  select: (...args: unknown[]) => Consulta;
  or: (...args: unknown[]) => Consulta;
  eq: (...args: unknown[]) => Consulta;
  order: (...args: unknown[]) => Consulta;
  limit: (...args: unknown[]) => Consulta;
  update: (...args: unknown[]) => Consulta;
  delete: (...args: unknown[]) => Consulta;
  returns: () => Consulta;
  single: () => Promise<Resultado>;
  then: (resolver: (v: Resultado) => unknown) => unknown;
}

const CLIENTE = {
  id: 'c-1',
  nombre: 'Ana',
  apellido: null,
  telefono: '3157861208',
  direccion: null,
  correo: null,
  cedula: null,
};

function crearServicio(porTabla: Record<string, Resultado> = {}) {
  const llamadas: Llamada[] = [];
  const resultados = new Map(Object.entries(porTabla));
  const from = (tabla: string): Consulta => {
    const resultado = resultados.get(tabla) ?? { data: [], error: null };
    const registrar =
      (metodo: string) =>
      (...args: unknown[]): Consulta => {
        llamadas.push({ tabla, metodo, args });
        return b;
      };
    const b: Consulta = {
      select: registrar('select'),
      or: registrar('or'),
      eq: registrar('eq'),
      order: registrar('order'),
      limit: registrar('limit'),
      update: registrar('update'),
      delete: registrar('delete'),
      returns: () => b,
      single: () => Promise.resolve(resultado),
      then: (resolver) => resolver(resultado),
    };
    return b;
  };
  let invalidaciones = 0;
  const directorio = {
    invalidar: (): number => ++invalidaciones,
  };
  const servicio = new ClientesService(
    { getClient: () => ({ from }) } as unknown as SupabaseService,
    directorio as unknown as ClientesDirectorioService,
  );
  return { servicio, llamadas, invalidaciones: () => invalidaciones };
}

describe('ClientesService.buscar y listar', () => {
  it('un texto vacío no consulta la base', async () => {
    const { servicio, llamadas } = crearServicio();

    await expect(servicio.buscar(' (,) ')).resolves.toEqual([]);
    expect(llamadas).toEqual([]);
  });

  it('busca con el texto limpio y un tope de 10', async () => {
    const { servicio, llamadas } = crearServicio({
      clientes: { data: [CLIENTE], error: null },
    });

    await expect(servicio.buscar(' ana% ')).resolves.toEqual([CLIENTE]);
    expect(llamadas).toEqual(
      expect.arrayContaining([
        {
          tabla: 'clientes',
          metodo: 'or',
          args: [
            'nombre.ilike.%ana%,apellido.ilike.%ana%,telefono.ilike.%ana%',
          ],
        },
        { tabla: 'clientes', metodo: 'limit', args: [10] },
      ]),
    );
  });

  it('listar trae los 100 más recientes', async () => {
    const { servicio, llamadas } = crearServicio({
      clientes: { data: [CLIENTE], error: null },
    });

    await servicio.listar();

    expect(llamadas).toContainEqual({
      tabla: 'clientes',
      metodo: 'limit',
      args: [100],
    });
  });

  it('un error de base se traduce con errorDeBase', async () => {
    const { servicio } = crearServicio({
      clientes: { data: null, error: { message: 'caído' } },
    });

    await expect(servicio.listar()).rejects.toThrow();
  });
});

describe('ClientesService.obtenerDetalle y listarPedidos', () => {
  it('el detalle suma los pedidos del cliente', async () => {
    const { servicio } = crearServicio({
      clientes: { data: { ...CLIENTE, puntos_actuales: 40 }, error: null },
      pedidos: {
        data: [
          { total: 30000, created_at: '2026-10-30T10:00:00Z' },
          { total: 20000, created_at: '2026-10-01T10:00:00Z' },
        ],
        error: null,
      },
    });

    await expect(servicio.obtenerDetalle('c-1')).resolves.toMatchObject({
      puntos_actuales: 40,
      total_pedidos: 2,
      total_gastado: 50000,
      ultimo_pedido: '2026-10-30T10:00:00Z',
    });
  });

  it('si fallan los pedidos, el detalle falla', async () => {
    const { servicio } = crearServicio({
      clientes: { data: CLIENTE, error: null },
      pedidos: { data: null, error: { message: 'caído' } },
    });

    await expect(servicio.obtenerDetalle('c-1')).rejects.toThrow();
  });

  it('listarPedidos devuelve el historial con tope de 200', async () => {
    const { servicio, llamadas } = crearServicio({
      pedidos: { data: [], error: null },
    });

    await expect(servicio.listarPedidos('c-1')).resolves.toEqual([]);
    expect(llamadas).toContainEqual({
      tabla: 'pedidos',
      metodo: 'limit',
      args: [200],
    });
  });
});

describe('ClientesService.editar', () => {
  it('un nombre vacío se rechaza antes de tocar la base', async () => {
    const { servicio, llamadas } = crearServicio();

    await expect(servicio.editar('c-1', { nombre: ' ' })).rejects.toThrow(
      'El nombre no puede quedar vacío.',
    );
    expect(llamadas).toEqual([]);
  });

  it('actualiza lo recibido e invalida el caché del directorio', async () => {
    const { servicio, llamadas, invalidaciones } = crearServicio({
      clientes: { data: CLIENTE, error: null },
    });

    await servicio.editar('c-1', { correo: '' });

    expect(llamadas).toContainEqual({
      tabla: 'clientes',
      metodo: 'update',
      args: [{ correo: null }],
    });
    expect(invalidaciones()).toBe(1);
  });

  it('un teléfono repetido es un conflicto 409 y no invalida', async () => {
    const { servicio, invalidaciones } = crearServicio({
      clientes: {
        data: null,
        error: { message: 'duplicate', code: '23505' },
      },
    });

    await expect(
      servicio.editar('c-1', { telefono: '3157861208' }),
    ).rejects.toThrow(ConflictException);
    expect(invalidaciones()).toBe(0);
  });
});

describe('ClientesService.eliminar', () => {
  it('borra e invalida el caché del directorio', async () => {
    const { servicio, invalidaciones } = crearServicio({
      clientes: { count: 1, error: null },
    });

    await expect(servicio.eliminar('c-1')).resolves.toBeUndefined();
    expect(invalidaciones()).toBe(1);
  });

  it('un cliente que no existe es 404', async () => {
    const { servicio, invalidaciones } = crearServicio({
      clientes: { count: 0, error: null },
    });

    await expect(servicio.eliminar('c-9')).rejects.toThrow(NotFoundException);
    expect(invalidaciones()).toBe(0);
  });
});
