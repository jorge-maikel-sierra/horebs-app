import { HttpException, HttpStatus } from '@nestjs/common';
import type { SupabaseService } from '../supabase/supabase.service';
import { ClientesDirectorioService } from './clientes-directorio.service';

interface Resultado {
  data: unknown[] | null;
  error: { message: string; code?: string } | null;
}

interface Pagina {
  tabla: string;
  desde: number;
  hasta: number;
}

const LOTE = 1000;
const TTL_MS = 30_000;

const CLIENTE = {
  id: 'c-1',
  nombre: 'Ana',
  apellido: 'Pérez',
  telefono: '315',
  direccion: null,
  correo: null,
  cedula: null,
  created_at: '2026-01-01T00:00:00.000Z',
  puntos_actuales: 40,
};

/** Cada tabla trae sus lotes en orden; el último se repite. */
function crearServicio(porTabla: Record<string, Resultado[]>) {
  const paginas: Pagina[] = [];
  const colas = new Map(
    Object.entries(porTabla).map(([tabla, rs]) => [tabla, [...rs]]),
  );
  const from = (tabla: string) => {
    const b = {
      select: () => b,
      order: () => b,
      range: (d: number, h: number) => {
        paginas.push({ tabla, desde: d, hasta: h });
        return b;
      },
      returns: () => {
        const cola = colas.get(tabla) ?? [];
        const resultado = (cola.length > 1 ? cola.shift() : cola[0]) ?? {
          data: [],
          error: null,
        };
        return Promise.resolve(resultado);
      },
    };
    return b;
  };
  const servicio = new ClientesDirectorioService({
    getClient: () => ({ from }),
  } as unknown as SupabaseService);
  return { servicio, paginas };
}

const OK = (...filas: unknown[]): Resultado => ({ data: filas, error: null });

describe('ClientesDirectorioService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('arma el directorio con las métricas de los pedidos del cliente', async () => {
    const { servicio } = crearServicio({
      clientes: [OK(CLIENTE)],
      pedidos: [
        OK(
          {
            cliente_id: 'c-1',
            total: 10_000,
            created_at: '2026-10-01T00:00:00.000Z',
          },
          {
            cliente_id: 'c-1',
            total: 5_000,
            created_at: '2026-10-09T00:00:00.000Z',
          },
        ),
      ],
    });

    const dto = await servicio.consultar({});

    expect(dto.items[0]).toMatchObject({
      id: 'c-1',
      total_pedidos: 2,
      total_gastado: 15_000,
      ultimo_pedido: '2026-10-09T00:00:00.000Z',
      puntos_actuales: 40,
    });
    expect(dto.resumen).toMatchObject({ clientes: 1, con_pedidos: 1 });
  });

  it('pagina de 1.000 en 1.000 hasta traer todas las filas', async () => {
    const lleno = Array.from({ length: LOTE }, (_, i) => ({
      ...CLIENTE,
      id: `c-${i}`,
    }));
    const { servicio, paginas } = crearServicio({
      clientes: [OK(...lleno), OK(CLIENTE)],
      pedidos: [OK()],
    });

    const dto = await servicio.consultar({ por_pagina: 60 });

    expect(dto.total).toBe(LOTE + 1);
    expect(paginas.filter((p) => p.tabla === 'clientes')).toEqual([
      { tabla: 'clientes', desde: 0, hasta: LOTE - 1 },
      { tabla: 'clientes', desde: LOTE, hasta: 2 * LOTE - 1 },
    ]);
  });

  it('un error de base se traduce con errorDeBase', async () => {
    const { servicio } = crearServicio({
      clientes: [{ data: null, error: { message: 'caído' } }],
      pedidos: [OK()],
    });

    const error: unknown = await servicio
      .consultar({})
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  });

  it('varias consultas a la vez comparten una sola carga', async () => {
    const { servicio, paginas } = crearServicio({
      clientes: [OK(CLIENTE)],
      pedidos: [OK()],
    });

    await Promise.all([servicio.consultar({}), servicio.consultar({})]);

    expect(paginas).toHaveLength(2); // una página de clientes y una de pedidos
  });

  it('usa el caché durante 30 s y vuelve a cargar al vencer', async () => {
    const ahora = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const { servicio, paginas } = crearServicio({
      clientes: [OK(CLIENTE)],
      pedidos: [OK()],
    });

    await servicio.consultar({});
    ahora.mockReturnValue(1_000_000 + TTL_MS - 1);
    await servicio.consultar({});
    expect(paginas).toHaveLength(2);

    ahora.mockReturnValue(1_000_000 + TTL_MS + 1);
    await servicio.consultar({});
    expect(paginas).toHaveLength(4);
  });

  it('invalidar fuerza una carga nueva', async () => {
    const { servicio, paginas } = crearServicio({
      clientes: [OK(CLIENTE)],
      pedidos: [OK()],
    });

    await servicio.consultar({});
    servicio.invalidar();
    await servicio.consultar({});

    expect(paginas).toHaveLength(4);
  });
});
