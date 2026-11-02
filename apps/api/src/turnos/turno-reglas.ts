import { fechaBogota } from '../common/horario';
import { MS_POR_DIA } from '../common/tiempo';

export interface EstadoVencimiento {
  vencido: boolean;
  dias_abierto: number;
}

/**
 * Un turno es de "hoy" si se abrió el mismo día calendario en Bogotá. Se
 * compara por fecha local y no por horas transcurridas: un turno abierto a
 * las 10:21 p. m. (03:21 UTC del día siguiente) sigue siendo de esa noche.
 */
export function estadoVencimiento(
  abiertoEn: string,
  ahora: Date,
): EstadoVencimiento {
  const hoy = Date.parse(fechaBogota(ahora));
  const apertura = Date.parse(fechaBogota(new Date(abiertoEn)));
  const dias = Math.max(0, Math.round((hoy - apertura) / MS_POR_DIA));
  return { vencido: dias > 0, dias_abierto: dias };
}
