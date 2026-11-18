/**
 * Marketing API: públicos personalizados de clientes. Puro: arma las URLs y los
 * cuerpos de cada llamada; el servicio las ejecuta. Los datos personales llegan
 * aquí ya cifrados (ver `audiencias-reglas`).
 */
import { cuentaPublicitaria } from './anuncios-meta';
import { ESQUEMA_AUDIENCIA } from './audiencias-reglas';

const GRAPH_URL = 'https://graph.facebook.com/v21.0';
/** Meta recibe hasta 10.000 personas por llamada. */
export const MAX_POR_LLAMADA = 10000;
/** Meta pide al menos 100 personas en la semilla para crear un público parecido. */
export const MIN_SEMILLA_PARECIDO = 100;
const RATIO_PARECIDO = 0.01;
const PAIS_PARECIDO = 'CO';

export function urlCrearAudiencia(cuenta: string): string {
  return `${GRAPH_URL}/${cuentaPublicitaria(cuenta)}/customaudiences`;
}

export function urlReemplazarUsuarios(audienciaId: string): string {
  return `${GRAPH_URL}/${audienciaId}/usersreplace`;
}

/** Público de lista de clientes (los datos los aporta el negocio). */
export function cuerpoCrearAudiencia(
  nombre: string,
  descripcion: string,
): Record<string, unknown> {
  return {
    name: nombre,
    description: descripcion,
    subtype: 'CUSTOM',
    customer_file_source: 'USER_PROVIDED_ONLY',
  };
}

/** Público parecido al 1% de Colombia a partir de otro público. */
export function cuerpoCrearParecido(
  nombre: string,
  origenId: string,
): Record<string, unknown> {
  return {
    name: nombre,
    subtype: 'LOOKALIKE',
    origin_audience_id: origenId,
    lookalike_spec: JSON.stringify({
      type: 'similarity',
      country: PAIS_PARECIDO,
      ratio: RATIO_PARECIDO,
    }),
  };
}

/** Cuerpos de `usersreplace`: una sesión que reemplaza a todos los miembros, en lotes. */
export function cuerposReemplazo(
  filas: string[][],
  sesion: number,
): Record<string, unknown>[] {
  const lotes: string[][][] = [];
  for (let i = 0; i < filas.length; i += MAX_POR_LLAMADA) {
    lotes.push(filas.slice(i, i + MAX_POR_LLAMADA));
  }
  return lotes.map((data, indice) => ({
    session: {
      session_id: sesion,
      batch_seq: indice + 1,
      last_batch_flag: indice === lotes.length - 1,
      estimated_num_total: filas.length,
    },
    payload: { schema: ESQUEMA_AUDIENCIA, data },
  }));
}
