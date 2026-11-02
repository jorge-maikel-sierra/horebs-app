import { ServiceUnavailableException } from '@nestjs/common';
import type { SupabaseService } from '../supabase/supabase.service';
import { ReportesService } from './reportes.service';

interface Resultado {
  data?: unknown;
  count?: number | null;
  error: { message: string } | null;
}

interface Filtro {
  tabla: string;
  metodo: string;
  args: unknown[];
}

interface Consulta {
  select: () => Consulta;
  eq: (...args: unknown[]) => Consulta;
  gte: (...args: unknown[]) => Consulta;
  lt: (...args: unknown[]) => Consulta;
  returns: () => Consulta;
  then: (resolver: (v: Resultado) => unknown) => unknown;
}

const INSUMOS = [
  {
    id: 'a',
    nombre: 'Harina',
    unidad_medida: 'g',
    stock_actual_g: -10,
    stock_minimo_g: 100,
    costo_unitario_g: 3,
  },
  {
    id: 'b',
    nombre: 'Queso',
    unidad_medida: 'g',
    stock_actual_g: 50,
    stock_minimo_g: 100,
    costo_unitario_g: 4,
  },
];

function crearServicio(porTabla: Record<string, Resultado[]>) {
  const filtros: Filtro[] = [];
  const colas = new Map(
    Object.entries(porTabla).map(([tabla, rs]) => [tabla, [...rs]]),
  );
  const from = (tabla: string): Consulta => {
    const resultado = colas.get(tabla)?.shift() ?? {
      data: [],
      error: null,
    };
    const registrar =
      (metodo: string) =>
      (...args: unknown[]): Consulta => {
        filtros.push({ tabla, metodo, args });
        return b;
      };
    const b: Consulta = {
      select: () => b,
      eq: registrar('eq'),
      gte: registrar('gte'),
      lt: registrar('lt'),
      returns: () => b,
      then: (resolver) => resolver(resultado),
    };
    return b;
  };
  const servicio = new ReportesService({
    getClient: () => ({ from }),
  } as unknown as SupabaseService);
  return { servicio, filtros };
}

const OK = {
  insumos: [{ data: INSUMOS, error: null }],
  compras: [
    { data: [{ subtotal: 1000, otros_cargos: 100 }], error: null },
    { data: [{ subtotal: 400, otros_cargos: 0 }], error: null },
  ],
  recetas: [{ count: 3, error: null }],
};

describe('ReportesService.obtenerReporte', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-01T02:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('arma el reporte con valorización, alertas, gasto de dos meses y recetas sin costear', async () => {
    const { servicio } = crearServicio(OK);

    await expect(servicio.obtenerReporte()).resolves.toEqual({
      valorizacionTotal: -10 * 3 + 50 * 4,
      insumosStockNegativo: [expect.objectContaining({ id: 'a' })],
      insumosStockBajo: [expect.objectContaining({ id: 'b' })],
      gastoComprasMesActual: 1100,
      gastoComprasMesAnterior: 400,
      recetasSinCostear: 3,
    });
  });

  it('a las 9pm de Bogotá del 31 de octubre todavía es octubre', async () => {
    const { servicio, filtros } = crearServicio(OK);

    await servicio.obtenerReporte();

    const fechas = filtros.filter((f) => f.tabla === 'compras');
    expect(fechas).toEqual([
      { tabla: 'compras', metodo: 'gte', args: ['fecha', '2026-10-01'] },
      { tabla: 'compras', metodo: 'gte', args: ['fecha', '2026-09-01'] },
      { tabla: 'compras', metodo: 'lt', args: ['fecha', '2026-10-01'] },
    ]);
  });

  it('sin recetas contadas devuelve cero', async () => {
    const { servicio } = crearServicio({
      ...OK,
      recetas: [{ count: null, error: null }],
    });

    await expect(servicio.obtenerReporte()).resolves.toMatchObject({
      recetasSinCostear: 0,
    });
  });

  it.each(['insumos', 'compras', 'recetas'])(
    'un error leyendo %s se traduce con errorDeBase',
    async (tabla) => {
      const { servicio } = crearServicio({
        ...OK,
        [tabla]: [{ data: null, error: { message: 'caído' } }],
      });

      await expect(servicio.obtenerReporte()).rejects.toThrow(
        ServiceUnavailableException,
      );
    },
  );
});
