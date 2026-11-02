export interface ConfiguracionPuntos {
  puntosPor1000Pesos: number;
  valorPuntoPesos: number;
  puntosMinimoCanje: number;
  puntosVencimientoMeses: number;
}

/** Body de `POST /admin/clientes/:id/movimientos-puntos`. */
export interface AjustePuntosInput {
  puntos: number;
  motivo: string;
}

export interface CanjeCalculado {
  puntos: number;
  descuento: number;
}

export type TipoMovimientoPuntos = 'ganado' | 'canjeado' | 'vencido' | 'ajuste';

export interface MovimientoPuntosDto {
  id: string;
  tipo: TipoMovimientoPuntos;
  puntos: number;
  referencia_tipo: string | null;
  referencia_id: string | null;
  motivo: string | null;
  created_at: string;
}

export interface SaldoPuntosDto {
  nombre: string;
  puntos: number;
  valorPuntoPesos: number;
  puntosMinimoCanje: number;
}

/** Un movimiento por aplicar con `aplicar_movimiento_puntos`. */
export interface MovimientoPuntosInput {
  clienteId: string;
  tipo: TipoMovimientoPuntos;
  puntos: number;
  referenciaTipo: string;
  referenciaId: string | null;
  motivo: string | null;
  creadoPor: string | null;
  actualizarActividad: boolean;
}

export interface FilaConfiguracion {
  clave: string;
  valor: string;
}

export interface FilaSaldoCliente {
  nombre: string;
  puntos_actuales: number;
}

export interface FilaPuntosCliente {
  id: string;
  puntos_actuales: number;
}

export const MOVIMIENTO_PUNTOS_SELECT =
  'id, tipo, puntos, referencia_tipo, referencia_id, motivo, created_at';

export const LIMITE_MOVIMIENTOS_DEFECTO = 50;
