import type {
  FilaGastoCompra,
  FilaInsumoReporte,
  InsumoAlertaDto,
  RangoMeses,
} from './reportes.tipos';

const MESES_POR_ANIO = 12;
const DIGITOS_MES = 2;

export function valorizacionTotal(insumos: FilaInsumoReporte[]): number {
  return insumos.reduce(
    (acc, i) => acc + i.stock_actual_g * i.costo_unitario_g,
    0,
  );
}

function aAlerta(i: FilaInsumoReporte): InsumoAlertaDto {
  return {
    id: i.id,
    nombre: i.nombre,
    unidad_medida: i.unidad_medida,
    stock_actual_g: i.stock_actual_g,
    stock_minimo_g: i.stock_minimo_g,
  };
}

/** Negativo es un descuadre del inventario; bajo es estar en o bajo el mínimo sin pasar de cero. */
export function insumosEnStockNegativo(
  insumos: FilaInsumoReporte[],
): InsumoAlertaDto[] {
  return insumos.filter((i) => i.stock_actual_g < 0).map(aAlerta);
}

export function insumosEnStockBajo(
  insumos: FilaInsumoReporte[],
): InsumoAlertaDto[] {
  return insumos
    .filter(
      (i) => i.stock_actual_g >= 0 && i.stock_actual_g <= i.stock_minimo_g,
    )
    .map(aAlerta);
}

export function gastoDeCompras(compras: FilaGastoCompra[]): number {
  return compras.reduce((acc, c) => acc + c.subtotal + c.otros_cargos, 0);
}

function primerDiaDeMes(anio: number, mes: number): string {
  return `${anio}-${String(mes).padStart(DIGITOS_MES, '0')}-01`;
}

/** Primer día del mes de `hoy` (AAAA-MM-DD en Bogotá) y del mes anterior. */
export function rangoDeMeses(hoy: string): RangoMeses {
  const [anio, mes] = hoy.split('-').map(Number);
  const [anioAnterior, mesAnterior] =
    mes === 1 ? [anio - 1, MESES_POR_ANIO] : [anio, mes - 1];
  return {
    inicioMesActual: primerDiaDeMes(anio, mes),
    inicioMesAnterior: primerDiaDeMes(anioAnterior, mesAnterior),
  };
}
