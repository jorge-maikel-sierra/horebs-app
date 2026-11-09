import type {
  Conversacion,
  FiltroVista,
  Mensaje,
} from './tipos';

const ZONA = 'America/Bogota';
const MS_MINUTO = 60_000;
const MINUTOS_HORA = 60;
const HORAS_DIA = 24;
const MINUTOS_DIA = MINUTOS_HORA * HORAS_DIA;
/** Dos mensajes seguidos del mismo autor dentro de este margen se agrupan. */
const MINUTOS_AGRUPAR = 5;

const FORMATO_DIA = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA });
const FORMATO_HORA = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONA,
  hour: 'numeric',
  minute: '2-digit',
});
const FORMATO_FECHA_LARGA = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONA,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const FORMATO_FECHA_CORTA = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONA,
  day: 'numeric',
  month: 'short',
});

/** Día calendario en Bogotá (YYYY-MM-DD): nunca el de UTC, que cambia a las 7 p.m. */
export function diaBogota(fecha: Date | string | number): string {
  return FORMATO_DIA.format(new Date(fecha));
}

export function formatearHora(iso: string): string {
  return FORMATO_HORA.format(new Date(iso));
}

function diasEntre(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) /
      (MINUTOS_DIA * MS_MINUTO),
  );
}

/** "ahora", "hace 5 min", "hace 2 h", "ayer", "3 nov". */
export function tiempoRelativo(iso: string, ahora: number): string {
  const minutos = Math.max(0, Math.floor((ahora - Date.parse(iso)) / MS_MINUTO));
  if (minutos < 1) return 'ahora';
  if (minutos < MINUTOS_HORA) return `hace ${minutos} min`;
  if (minutos < MINUTOS_DIA && diaBogota(iso) === diaBogota(ahora)) {
    return `hace ${Math.floor(minutos / MINUTOS_HORA)} h`;
  }
  const dias = diasEntre(diaBogota(ahora), diaBogota(iso));
  if (dias === 1) return 'ayer';
  return FORMATO_FECHA_CORTA.format(new Date(iso)).replace('.', '');
}

/** Título del separador de día del hilo: "Hoy", "Ayer" o "lunes 3 de noviembre". */
export function tituloDia(dia: string, ahora: number): string {
  const dias = diasEntre(diaBogota(ahora), dia);
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  return FORMATO_FECHA_LARGA.format(new Date(`${dia}T12:00:00-05:00`));
}

/** "+57 318 759 2616" para un celular colombiano; cualquier otro valor queda igual. */
export function formatearTelefono(valor: string): string {
  const m = /^57(3\d{2})(\d{3})(\d{4})$/.exec(valor.replace(/\D/g, ''));
  return m ? `+57 ${m[1]} ${m[2]} ${m[3]}` : valor;
}

/** Cómo se muestra al cliente: su teléfono si lo hay; si no, el final de su id. */
export function nombreCliente(c: Conversacion): string {
  if (c.canal === 'whatsapp') return formatearTelefono(c.identificador_externo);
  if (c.telefono) return formatearTelefono(c.telefono);
  return `Cliente …${c.identificador_externo.slice(-4)}`;
}

/** Las que esperan al equipo primero, y dentro de cada grupo la más reciente arriba. */
export function ordenarConversaciones(lista: Conversacion[]): Conversacion[] {
  return [...lista].sort((a, b) => {
    if (a.estado !== b.estado) return a.estado === 'derivado' ? -1 : 1;
    return Date.parse(b.ultima_interaccion) - Date.parse(a.ultima_interaccion);
  });
}

export function filtrarConversaciones(
  lista: Conversacion[],
  vista: FiltroVista,
  canales: ReadonlySet<Conversacion['canal']>,
  busqueda: string,
): Conversacion[] {
  const texto = busqueda.trim().toLowerCase();
  return lista.filter((c) => {
    if (vista === 'por_atender' && c.estado !== 'derivado') return false;
    if (vista === 'bot' && c.estado !== 'bot') return false;
    if (canales.size > 0 && !canales.has(c.canal)) return false;
    if (!texto) return true;
    const pajar = `${c.identificador_externo} ${c.telefono ?? ''} ${nombreCliente(c)}`;
    return pajar.toLowerCase().includes(texto);
  });
}

export type ResumenConversaciones = {
  total: number;
  porAtender: number;
  conBot: number;
  recordatorios: number;
  ofertas: number;
};

export function resumir(lista: Conversacion[]): ResumenConversaciones {
  return {
    total: lista.length,
    porAtender: lista.filter((c) => c.estado === 'derivado').length,
    conBot: lista.filter((c) => c.estado === 'bot').length,
    recordatorios: lista.filter(
      (c) => c.seguimiento_etapa === 'recordatorio_enviado',
    ).length,
    ofertas: lista.filter((c) => c.seguimiento_etapa === 'oferta_enviada')
      .length,
  };
}

export type BloqueMensaje = {
  mensaje: Mensaje;
  /** El primero de una racha del mismo autor lleva etiqueta; el resto no. */
  inicioDeRacha: boolean;
};
export type GrupoDia = { dia: string; bloques: BloqueMensaje[] };

/** Mensajes agrupados por día de Bogotá y por rachas del mismo autor. */
export function agruparMensajes(mensajes: Mensaje[]): GrupoDia[] {
  const grupos: GrupoDia[] = [];
  let anterior: Mensaje | null = null;
  for (const mensaje of mensajes) {
    const dia = diaBogota(mensaje.created_at);
    let grupo = grupos[grupos.length - 1];
    if (!grupo || grupo.dia !== dia) {
      grupo = { dia, bloques: [] };
      grupos.push(grupo);
      anterior = null;
    }
    const mismaRacha =
      anterior !== null &&
      anterior.direccion === mensaje.direccion &&
      anterior.autor_usuario_id === mensaje.autor_usuario_id &&
      Date.parse(mensaje.created_at) - Date.parse(anterior.created_at) <
        MINUTOS_AGRUPAR * MS_MINUTO;
    grupo.bloques.push({ mensaje, inicioDeRacha: !mismaRacha });
    anterior = mensaje;
  }
  return grupos;
}

/** "3 h", "1 h 30 min", "45 min": los minutos de la configuración en palabras. */
export function minutosEnPalabras(minutos: number): string {
  if (!Number.isFinite(minutos) || minutos <= 0) return '—';
  if (minutos < MINUTOS_HORA) return `${minutos} min`;
  const horas = Math.floor(minutos / MINUTOS_HORA);
  const resto = minutos % MINUTOS_HORA;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}
