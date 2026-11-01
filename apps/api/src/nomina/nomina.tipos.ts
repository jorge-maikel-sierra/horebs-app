import type { EmpleadoDto } from './empleados.service';

export interface AsistenciaDiaDto {
  fecha: string;
  trabajo: boolean;
  motivo: string | null;
}

export interface AdelantoDto {
  id: string;
  empleado_id: string;
  nomina_semana_id: string;
  monto: number;
  fecha: string;
  motivo: string | null;
}

export interface SemanaNominaDto {
  id: string;
  empleado_id: string;
  semana_inicio: string;
  semana_fin: string;
  monto_base: number;
  dias_esperados: number;
  dias_trabajados: number;
  total_adelantos: number;
  neto_pagar: number;
  saldo_pendiente: number;
  estado: 'en_curso' | 'liquidada';
  liquidada_en: string | null;
  notas: string | null;
  asistencia: AsistenciaDiaDto[];
  adelantos: AdelantoDto[];
}

export interface TableroFilaDto {
  empleado: EmpleadoDto;
  semana: SemanaNominaDto;
}

export interface RegistrarAdelantoInput {
  empleado_id: string;
  monto: number;
  fecha: string;
  motivo?: string;
}

/** Un día de asistencia de una semana: quién lo marca y qué marca. */
export interface MarcarAsistenciaInput {
  semanaId: string;
  fecha: string;
  trabajo: boolean;
  motivo: string | undefined;
  usuarioId: string;
}

/** Body de `PUT /nomina/semanas/:id/asistencia/:fecha`. */
export interface AsistenciaBody {
  trabajo: boolean;
  motivo?: string;
}

/** Body de `PUT /nomina/semanas/:id/liquidacion`. */
export interface LiquidarSemanaBody {
  notas?: string;
}

/** La fila de `nomina_semanas` tal como sale de `SEMANA_SELECT`. */
export interface SemanaRaw {
  id: string;
  empleado_id: string;
  semana_inicio: string;
  semana_fin: string;
  monto_base: number;
  dias_esperados: number;
  dias_trabajados: number | null;
  total_adelantos: number | null;
  neto_pagar: number | null;
  estado: 'en_curso' | 'liquidada';
  liquidada_en: string | null;
  notas: string | null;
}

/** Lo que `eliminarAdelanto` lee del adelanto antes de borrarlo. */
export interface FilaAdelantoSemana {
  id: string;
  nomina_semana_id: string;
}

export const SEMANA_SELECT =
  'id, empleado_id, semana_inicio, semana_fin, monto_base, dias_esperados, dias_trabajados, total_adelantos, neto_pagar, estado, liquidada_en, notas';
