import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import type {
  AjustePuntosInput,
  CanjeCalculado,
  ConfiguracionPuntos,
  FilaConfiguracion,
  MovimientoPuntosInput,
} from './puntos.tipos';

const CLAVE_PUNTOS_POR_1000 = 'puntos_por_1000_pesos';
const CLAVE_VALOR_PUNTO = 'valor_punto_pesos';
const CLAVE_MINIMO_CANJE = 'puntos_minimo_canje';
const CLAVE_VENCIMIENTO_MESES = 'puntos_vencimiento_meses';

/** Cada campo de la configuración y la clave de `configuracion` donde vive. */
const CLAVES_CONFIGURACION: [keyof ConfiguracionPuntos, string][] = [
  ['puntosPor1000Pesos', CLAVE_PUNTOS_POR_1000],
  ['valorPuntoPesos', CLAVE_VALOR_PUNTO],
  ['puntosMinimoCanje', CLAVE_MINIMO_CANJE],
  ['puntosVencimientoMeses', CLAVE_VENCIMIENTO_MESES],
];

export const CLAVES_PUNTOS = CLAVES_CONFIGURACION.map(([, clave]) => clave);

// Mismos valores que trae la migración — solo entran en juego si por algún
// motivo las filas de configuracion no existen.
export const DEFECTOS: ConfiguracionPuntos = {
  puntosPor1000Pesos: 1,
  valorPuntoPesos: 50,
  puntosMinimoCanje: 100,
  puntosVencimientoMeses: 12,
};

const MILES_DE_PESOS = 1000;

/**
 * Puntos que gana una compra — la misma fórmula que se otorga al registrar
 * el pedido; el bot la usa para anticiparlos en el resumen.
 */
export function puntosPorMonto(
  montoPagado: number,
  config: Pick<ConfiguracionPuntos, 'puntosPor1000Pesos'>,
): number {
  return Math.floor(montoPagado / MILES_DE_PESOS) * config.puntosPor1000Pesos;
}

/** La configuración guardada; un valor ausente o no numérico cae al defecto. */
export function configuracionDeFilas(
  filas: FilaConfiguracion[],
): ConfiguracionPuntos {
  const mapa = new Map(filas.map((f) => [f.clave, f.valor]));
  const numero = (clave: string, defecto: number): number => {
    const valor = Number(mapa.get(clave));
    return Number.isFinite(valor) && valor >= 0 ? valor : defecto;
  };
  return {
    puntosPor1000Pesos: numero(
      CLAVE_PUNTOS_POR_1000,
      DEFECTOS.puntosPor1000Pesos,
    ),
    valorPuntoPesos: numero(CLAVE_VALOR_PUNTO, DEFECTOS.valorPuntoPesos),
    puntosMinimoCanje: numero(CLAVE_MINIMO_CANJE, DEFECTOS.puntosMinimoCanje),
    puntosVencimientoMeses: numero(
      CLAVE_VENCIMIENTO_MESES,
      DEFECTOS.puntosVencimientoMeses,
    ),
  };
}

/** Las filas de `configuracion` a escribir: solo lo que el cambio trae. */
export function filasDeConfiguracion(
  cambios: Partial<ConfiguracionPuntos>,
): FilaConfiguracion[] {
  const traidos = new Map(Object.entries(cambios));
  const filas: FilaConfiguracion[] = [];
  for (const [campo, clave] of CLAVES_CONFIGURACION) {
    const valor = traidos.get(campo);
    if (typeof valor !== 'number') continue;
    if (valor < 0) throw new BadRequestException('Valor inválido.');
    filas.push({ clave, valor: String(valor) });
  }
  return filas;
}

/**
 * Cuántos puntos se pueden usar sin pasarse del saldo ni del monto
 * disponible del pedido; por debajo del mínimo de canje no se puede usar
 * ninguno.
 */
export function canjeMaximo(
  saldo: number,
  montoDisponible: number,
  config: ConfiguracionPuntos,
): CanjeCalculado {
  if (saldo < config.puntosMinimoCanje) return { puntos: 0, descuento: 0 };
  const maxPorMonto = Math.floor(montoDisponible / config.valorPuntoPesos);
  const puntos = Math.max(0, Math.min(saldo, maxPorMonto));
  return { puntos, descuento: puntos * config.valorPuntoPesos };
}

export function validarAjustePuntos(ajuste: AjustePuntosInput): void {
  if (!Number.isFinite(ajuste.puntos) || ajuste.puntos === 0) {
    throw new BadRequestException('La cantidad del ajuste no puede ser cero.');
  }
  if (!ajuste.motivo?.trim()) {
    throw new BadRequestException('Falta el motivo del ajuste.');
  }
}

/**
 * Traduce el mensaje de la RPC de puntos: un cliente que no existe es 404 y
 * un ajuste que dejaría el saldo negativo es un conflicto con el estado
 * actual (409). `null` si el error no es uno de esos.
 */
export function errorDeAjuste(
  mensaje: string | undefined,
): HttpException | null {
  if (mensaje?.includes('no existe')) {
    return new NotFoundException('Cliente no encontrado.');
  }
  if (mensaje?.includes('negativo')) {
    return new ConflictException(
      'El ajuste dejaría el saldo de puntos en negativo.',
    );
  }
  return null;
}

/** Argumentos de `aplicar_movimiento_puntos`. */
export function paramsMovimientoPuntos(
  mov: MovimientoPuntosInput,
): Record<string, unknown> {
  return {
    p_cliente_id: mov.clienteId,
    p_tipo: mov.tipo,
    p_puntos: mov.puntos,
    p_referencia_tipo: mov.referenciaTipo,
    p_referencia_id: mov.referenciaId,
    p_motivo: mov.motivo,
    p_created_by: mov.creadoPor,
    p_actualizar_actividad: mov.actualizarActividad,
  };
}

/** Fecha desde la que un cliente sin compras que den puntos ya venció. */
export function limiteDeVencimiento(ahora: Date, meses: number): Date {
  const limite = new Date(ahora);
  limite.setMonth(limite.getMonth() - meses);
  return limite;
}
