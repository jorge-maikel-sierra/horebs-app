import { BadRequestException, ConflictException } from '@nestjs/common';
import type {
  AdelantoDto,
  AsistenciaDiaDto,
  RegistrarAdelantoInput,
  SemanaNominaDto,
  SemanaRaw,
} from './nomina.tipos';

export type MontosSemana = Pick<
  SemanaNominaDto,
  'dias_trabajados' | 'total_adelantos' | 'neto_pagar' | 'saldo_pendiente'
>;

/** Lo ganado por los días trabajados: el monto base repartido entre los esperados. */
function brutoDe(semana: SemanaRaw, diasTrabajados: number): number {
  return Math.round(
    (semana.monto_base / semana.dias_esperados) * diasTrabajados,
  );
}

function saldoPendienteDe(
  semana: SemanaRaw,
  diasTrabajados: number,
  totalAdelantos: number,
): number {
  return Math.max(0, totalAdelantos - brutoDe(semana, diasTrabajados));
}

/**
 * Semana en curso: se calcula con la asistencia y los adelantos de hoy.
 * Semana liquidada: manda lo que quedó guardado al liquidar, aunque después
 * cambien los detalles.
 */
export function montosDeSemana(
  semana: SemanaRaw,
  asistencia: AsistenciaDiaDto[],
  adelantos: AdelantoDto[],
): MontosSemana {
  if (semana.estado === 'liquidada') {
    const diasTrabajados = semana.dias_trabajados ?? 0;
    const totalAdelantos = semana.total_adelantos ?? 0;
    return {
      dias_trabajados: diasTrabajados,
      total_adelantos: totalAdelantos,
      neto_pagar: semana.neto_pagar ?? 0,
      saldo_pendiente: saldoPendienteDe(semana, diasTrabajados, totalAdelantos),
    };
  }

  const diasTrabajados = asistencia.filter((a) => a.trabajo).length;
  const totalAdelantos = adelantos.reduce((acc, a) => acc + a.monto, 0);
  return {
    dias_trabajados: diasTrabajados,
    total_adelantos: totalAdelantos,
    neto_pagar: Math.max(0, brutoDe(semana, diasTrabajados) - totalAdelantos),
    saldo_pendiente: saldoPendienteDe(semana, diasTrabajados, totalAdelantos),
  };
}

/** Una semana liquidada es de solo lectura: `accion` completa el mensaje del 409. */
export function exigirSemanaEnCurso(
  semana: Pick<SemanaRaw, 'estado'>,
  accion: string,
): void {
  if (semana.estado === 'liquidada') {
    throw new ConflictException(
      `Esa semana ya está liquidada, no se puede ${accion}.`,
    );
  }
}

export function validarFechaEnSemana(
  semana: Pick<SemanaRaw, 'semana_inicio' | 'semana_fin'>,
  fecha: string,
): void {
  if (fecha < semana.semana_inicio || fecha > semana.semana_fin) {
    throw new BadRequestException('La fecha no pertenece a esa semana.');
  }
}

export function validarAdelanto(input: RegistrarAdelantoInput): void {
  if (typeof input.monto !== 'number' || input.monto <= 0) {
    throw new BadRequestException(
      'El monto del adelanto debe ser mayor a cero.',
    );
  }
  if (!input.fecha) {
    throw new BadRequestException('Falta la fecha del adelanto.');
  }
}
