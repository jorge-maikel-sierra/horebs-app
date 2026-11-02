import { BadRequestException } from '@nestjs/common';
import {
  UNIDADES_MEDIDA,
  type AjusteStockInput,
  type AlertasPorEnviar,
  type CrearInsumoInput,
  type EditarInsumoInput,
  type FilaStockInsumo,
  type InsumoDto,
  type UnidadMedida,
} from './insumos.tipos';

// Si ya se avisó por un insumo, no se vuelve a mandar el mismo correo
// hasta que pase este tiempo — evita mandar un mail por cada venta
// mientras el stock siga por debajo del mínimo.
export const COOLDOWN_ALERTA_MS = 86_400_000;

function validarUnidad(unidad: UnidadMedida | undefined): void {
  if (unidad !== undefined && !UNIDADES_MEDIDA.includes(unidad)) {
    throw new BadRequestException('Unidad de medida inválida.');
  }
}

function validarStockMinimo(stockMinimo: number | undefined): void {
  if (stockMinimo !== undefined && stockMinimo < 0) {
    throw new BadRequestException('El stock mínimo no puede ser negativo.');
  }
}

export function validarCrearInsumo(input: CrearInsumoInput): void {
  if (!input.nombre?.trim()) {
    throw new BadRequestException('Falta el nombre del insumo.');
  }
  if (!input.categoria?.trim()) {
    throw new BadRequestException('Falta la categoría del insumo.');
  }
  validarUnidad(input.unidad_medida);
  validarStockMinimo(input.stock_minimo_g);
}

export function filaNuevoInsumo(
  input: CrearInsumoInput,
): Record<string, unknown> {
  return {
    nombre: input.nombre.trim(),
    categoria: input.categoria.trim(),
    unidad_medida: input.unidad_medida ?? 'g',
    stock_minimo_g: input.stock_minimo_g ?? 0,
    proveedor_principal: input.proveedor_principal?.trim() || null,
  };
}

export function validarEdicionInsumo(cambios: EditarInsumoInput): void {
  if (cambios.nombre !== undefined && !cambios.nombre.trim()) {
    throw new BadRequestException('El nombre no puede quedar vacío.');
  }
  validarUnidad(cambios.unidad_medida);
  validarStockMinimo(cambios.stock_minimo_g);
}

/** Solo las columnas que el cambio trae: lo ausente no se toca. */
export function cambiosDeInsumo(
  cambios: EditarInsumoInput,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (cambios.nombre !== undefined) payload.nombre = cambios.nombre.trim();
  if (cambios.categoria !== undefined) {
    payload.categoria = cambios.categoria.trim();
  }
  if (cambios.unidad_medida !== undefined) {
    payload.unidad_medida = cambios.unidad_medida;
  }
  if (cambios.stock_minimo_g !== undefined) {
    payload.stock_minimo_g = cambios.stock_minimo_g;
  }
  if (cambios.proveedor_principal !== undefined) {
    payload.proveedor_principal = cambios.proveedor_principal.trim() || null;
  }
  if (cambios.activo !== undefined) payload.activo = cambios.activo;
  return payload;
}

export function filtrarStockBajo(insumos: InsumoDto[]): InsumoDto[] {
  return insumos.filter((i) => i.stock_actual_g <= i.stock_minimo_g);
}

export function validarAjuste(ajuste: AjusteStockInput): void {
  if (!Number.isFinite(ajuste.cantidad_g) || ajuste.cantidad_g === 0) {
    throw new BadRequestException('La cantidad del ajuste no puede ser cero.');
  }
  if (!ajuste.motivo?.trim()) {
    throw new BadRequestException('Falta el motivo del ajuste.');
  }
}

/**
 * La merma siempre resta stock — si alguien pone un número positivo por
 * error, se interpreta igual como salida en vez de fallar en silencio.
 */
export function cantidadFirmada(ajuste: AjusteStockInput): number {
  return ajuste.tipo === 'merma'
    ? -Math.abs(ajuste.cantidad_g)
    : ajuste.cantidad_g;
}

/** Argumentos de `aplicar_movimientos_stock` para un ajuste manual. */
export function paramsAjusteStock(
  insumoId: string,
  ajuste: AjusteStockInput,
  usuarioId: string,
): Record<string, unknown> {
  return {
    p_movimientos: [
      { insumo_id: insumoId, cantidad_g: cantidadFirmada(ajuste) },
    ],
    p_referencia_tipo: 'ajuste_manual',
    p_referencia_id: null,
    p_tipo: ajuste.tipo,
    p_created_by: usuarioId,
    p_motivo: ajuste.motivo.trim(),
  };
}

type DecisionAlerta = 'alertar' | 'resetear' | 'nada';

function decidirAlerta(fila: FilaStockInsumo, ahora: number): DecisionAlerta {
  const bajoMinimo = fila.stock_actual_g <= fila.stock_minimo_g;
  if (!bajoMinimo) return fila.alerta_stock_enviada_en ? 'resetear' : 'nada';

  const ultimaAlerta = fila.alerta_stock_enviada_en
    ? new Date(fila.alerta_stock_enviada_en).getTime()
    : null;
  const dentroDelCooldown =
    ultimaAlerta !== null && ahora - ultimaAlerta < COOLDOWN_ALERTA_MS;
  return dentroDelCooldown ? 'nada' : 'alertar';
}

/**
 * Qué insumos avisar (bajo el mínimo y fuera del cooldown) y a cuáles se les
 * apaga la marca (ya se recuperaron y todavía tenían un aviso registrado).
 */
export function alertasPorEnviar(
  filas: FilaStockInsumo[],
  ahora: number,
): AlertasPorEnviar {
  const resultado: AlertasPorEnviar = { paraAlertar: [], paraResetear: [] };
  for (const fila of filas) {
    const decision = decidirAlerta(fila, ahora);
    if (decision === 'alertar') {
      resultado.paraAlertar.push({
        id: fila.id,
        nombre: fila.nombre,
        unidad: fila.unidad_medida,
        stockActual: fila.stock_actual_g,
        stockMinimo: fila.stock_minimo_g,
      });
    } else if (decision === 'resetear') {
      resultado.paraResetear.push(fila.id);
    }
  }
  return resultado;
}
