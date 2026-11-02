import { ServiceUnavailableException } from '@nestjs/common';
import type { SupabaseService } from '../supabase/supabase.service';
import { MovimientosService } from './movimientos.service';
import type { FilaMovimiento } from './movimientos.tipos';

interface Resultado {
  data: FilaMovimiento[] | null;
  error: { message: string } | null;
}

interface Llamada {
  metodo: string;
  args: unknown[];
}

interface Consulta {
  select: (columnas: string) => Consulta;
  order: (columna: string, opciones: unknown) => Consulta;
  limit: (n: number) => Consulta;
  eq: (columna: string, valor: unknown) => Consulta;
  gte: (columna: string, valor: unknown) => Consulta;
  lte: (columna: string, valor: unknown) => Consulta;
  returns: () => Promise<Resultado>;
}

const FILA: FilaMovimiento = {
  id: 'm-1',
  insumo_id: 'i-1',
  tipo: 'venta',
  cantidad_g: -250,
  referencia_tipo: 'pedido',
  referencia_id: 'p-1',
  motivo: null,
  created_at: '2026-10-30T10:00:00Z',
  insumos: { nombre: 'Harina', unidad_medida: 'g' },
};

function crearServicio(resultado: Resultado) {
  const llamadas: Llamada[] = [];
  const registrar =
    (metodo: string) =>
    (...args: unknown[]): Consulta => {
      llamadas.push({ metodo, args });
      return consulta;
    };
  const consulta: Consulta = {
    select: registrar('select'),
    order: registrar('order'),
    limit: registrar('limit'),
    eq: registrar('eq'),
    gte: registrar('gte'),
    lte: registrar('lte'),
    returns: () => Promise.resolve(resultado),
  };
  const servicio = new MovimientosService({
    getClient: () => ({ from: () => consulta }),
  } as unknown as SupabaseService);
  return { servicio, llamadas };
}

const OK: Resultado = { data: [FILA], error: null };

describe('MovimientosService.listar', () => {
  it('sin filtros pide los últimos 100 y mapea las filas', async () => {
    const { servicio, llamadas } = crearServicio(OK);

    const movimientos = await servicio.listar({});

    expect(llamadas.find((l) => l.metodo === 'limit')?.args).toEqual([100]);
    expect(llamadas.map((l) => l.metodo)).not.toContain('eq');
    expect(movimientos).toEqual([
      expect.objectContaining({ id: 'm-1', insumo_nombre: 'Harina' }),
    ]);
  });

  it('el límite nunca pasa del máximo', async () => {
    const { servicio, llamadas } = crearServicio(OK);

    await servicio.listar({ limit: 5000 });

    expect(llamadas.find((l) => l.metodo === 'limit')?.args).toEqual([200]);
  });

  it('aplica insumo y tipo, y acota las fechas al día de Bogotá', async () => {
    const { servicio, llamadas } = crearServicio(OK);

    await servicio.listar({
      insumoId: 'i-1',
      tipo: 'venta',
      desde: '2026-10-01',
      hasta: '2026-10-31',
    });

    expect(llamadas).toEqual(
      expect.arrayContaining([
        { metodo: 'eq', args: ['insumo_id', 'i-1'] },
        { metodo: 'eq', args: ['tipo', 'venta'] },
        {
          metodo: 'gte',
          args: ['created_at', '2026-10-01T00:00:00.000-05:00'],
        },
        {
          metodo: 'lte',
          args: ['created_at', '2026-10-31T23:59:59.999-05:00'],
        },
      ]),
    );
  });

  it('sin filas devuelve una lista vacía', async () => {
    const { servicio } = crearServicio({ data: null, error: null });

    await expect(servicio.listar({})).resolves.toEqual([]);
  });

  it('un error de base sale por errorDeBase', async () => {
    const { servicio } = crearServicio({
      data: null,
      error: { message: 'caído' },
    });

    await expect(servicio.listar({})).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
