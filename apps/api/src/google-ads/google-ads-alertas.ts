import { MS_POR_HORA } from '../common/tiempo';
import type {
  FilaAnuncio,
  FilaCampanaDia,
  FilaEstadoCampana,
} from './google-ads.tipos';

/**
 * Alertas de estado y configuración del tablero (puras). Las de rendimiento
 * viven en `google-ads-alertas-rendimiento.ts`. Cada alerta dice qué pasó, el
 * dato y la acción sugerida; ninguna se dispara sin muestra suficiente.
 */

export type Severidad = 'critica' | 'alta' | 'media' | 'baja';

export interface AlertaDto {
  codigo: string;
  severidad: Severidad;
  titulo: string;
  detalle: string;
  accion: string;
}

export const HORAS_SINCRONIZACION_VIEJA = 36;

const ESTADOS_SIN_SERVIR = new Set([
  'NOT_ELIGIBLE',
  'MISCONFIGURED',
  'ENDED',
  'PENDING',
]);
const APROBACIONES_MALAS = new Set([
  'DISAPPROVED',
  'APPROVED_LIMITED',
  'AREA_OF_INTEREST_ONLY',
]);
const FUERZAS_BAJAS = new Set(['POOR', 'AVERAGE']);
const DOMINIOS_PERMITIDOS = ['pizzeriahorebs.shop', 'wa.me', 'whatsapp.com'];

const SEVERIDADES: Severidad[] = ['critica', 'alta', 'media', 'baja'];

export function ordenarAlertas(alertas: AlertaDto[]): AlertaDto[] {
  const orden = (a: AlertaDto): number => SEVERIDADES.indexOf(a.severidad);
  return [...alertas].sort((a, b) => orden(a) - orden(b));
}

export function alertaSincronizacion(
  ultimoEnvio: string | null,
  ahora: Date,
): AlertaDto | null {
  if (!ultimoEnvio) {
    return {
      codigo: 'SINCRONIZACION_VIEJA',
      severidad: 'alta',
      titulo: 'Google Ads aún no ha enviado datos',
      detalle: 'El script de la cuenta no ha corrido o el API lo rechazó.',
      accion:
        'Instalar y programar el script (apps/api/docs/google-ads/README.md).',
    };
  }
  const horas = (ahora.getTime() - Date.parse(ultimoEnvio)) / MS_POR_HORA;
  if (horas <= HORAS_SINCRONIZACION_VIEJA) return null;
  return {
    codigo: 'SINCRONIZACION_VIEJA',
    severidad: 'alta',
    titulo: 'Los datos de Google Ads están viejos',
    detalle: `El último envío llegó hace ${Math.round(horas)} horas.`,
    accion:
      'Revisar el registro del script en Google Ads (403 = secreto distinto).',
  };
}

/** Última fila de cada campaña: su estado más reciente. */
export function ultimaPorCampana(filas: FilaCampanaDia[]): FilaCampanaDia[] {
  const ultima = new Map<string, FilaCampanaDia>();
  for (const f of filas) {
    const previa = ultima.get(f.campana_id);
    if (!previa || f.fecha > previa.fecha) ultima.set(f.campana_id, f);
  }
  return [...ultima.values()];
}

/**
 * Estado actual de cada campaña: la foto `estado_campanas` si llegó; si no,
 * la última fila diaria (que falta justo los días en que no sirve).
 */
export function estadosVigentes(
  estados: FilaEstadoCampana[],
  dias: FilaCampanaDia[],
): FilaEstadoCampana[] {
  return estados.length > 0 ? estados : ultimaPorCampana(dias);
}

function sinServir(c: FilaEstadoCampana, detalle: string): AlertaDto {
  return {
    codigo: 'SIN_SERVIR',
    severidad: 'critica',
    titulo: `«${c.campana_nombre}» no está mostrando anuncios`,
    detalle,
    accion: 'Abrir la campaña en Google Ads y resolver el motivo.',
  };
}

/**
 * Campaña activa no apta, o sin impresiones en `dia` (el último día que el
 * script ya mandó; null = aún no se sabe y no se revisa).
 */
export function alertasSinServir(
  estados: FilaEstadoCampana[],
  dias: FilaCampanaDia[],
  dia: string | null,
): AlertaDto[] {
  const conImpresiones = new Set(
    dias
      .filter((d) => d.fecha === dia && Number(d.impresiones) > 0)
      .map((d) => d.campana_id),
  );
  const alertas: AlertaDto[] = [];
  for (const c of estadosVigentes(estados, dias)) {
    if (c.estado !== 'ENABLED') continue;
    if (ESTADOS_SIN_SERVIR.has(c.estado_principal ?? '')) {
      const motivos = c.motivos_estado.length
        ? `: ${c.motivos_estado.join(', ')}`
        : '';
      alertas.push(sinServir(c, `Estado ${c.estado_principal}${motivos}.`));
    } else if (dia && !conImpresiones.has(c.campana_id)) {
      alertas.push(sinServir(c, `Activa pero sin impresiones el ${dia}.`));
    }
  }
  return alertas;
}

function dominioPermitido(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return DOMINIOS_PERMITIDOS.some(
      (d) => host === d || host.endsWith(`.${d}`),
    );
  } catch {
    return false;
  }
}

export function alertasAnuncios(anuncios: FilaAnuncio[]): AlertaDto[] {
  const activos = anuncios.filter((a) => a.estado === 'ENABLED');
  const alertas: AlertaDto[] = [];
  const rechazados = activos.filter((a) =>
    APROBACIONES_MALAS.has(a.aprobacion ?? ''),
  );
  if (rechazados.length > 0) {
    alertas.push({
      codigo: 'ANUNCIO_RECHAZADO',
      severidad: 'critica',
      titulo: `${rechazados.length} anuncio(s) rechazado(s) o limitado(s)`,
      detalle: rechazados
        .map((a) => `Anuncio ${a.anuncio_id}: ${a.aprobacion}`)
        .join(' · '),
      accion: 'Ver el motivo de política en Google Ads y corregir el texto.',
    });
  }
  const urlsMalas = activos.flatMap((a) =>
    a.urls_finales.filter((u) => !dominioPermitido(u)),
  );
  if (urlsMalas.length > 0) {
    alertas.push({
      codigo: 'URL_PROHIBIDA',
      severidad: 'critica',
      titulo: 'Un anuncio lleva a una página que no es del negocio',
      detalle: [...new Set(urlsMalas)].join(' · '),
      accion: 'Cambiar la URL final a https://pizzeriahorebs.shop.',
    });
  }
  const debiles = activos.filter((a) => FUERZAS_BAJAS.has(a.fuerza ?? ''));
  if (debiles.length > 0) {
    alertas.push({
      codigo: 'FUERZA_ANUNCIO',
      severidad: 'baja',
      titulo: `${debiles.length} anuncio(s) con fuerza baja`,
      detalle: debiles
        .map((a) => `Anuncio ${a.anuncio_id}: ${a.fuerza}`)
        .join(' · '),
      accion:
        'Agregar títulos distintos (producto, domicilio, Riohacha, precio) hasta llegar a "Buena".',
    });
  }
  return alertas;
}
