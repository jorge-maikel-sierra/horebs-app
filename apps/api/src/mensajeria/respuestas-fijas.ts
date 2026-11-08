import { COSTO_DOMICILIO_DEFAULT } from '../common/costos';
import { estadoAtencion, minutosBogota } from '../common/horario';
import { MINUTOS_POR_HORA } from '../common/tiempo';
import {
  DIRECCION,
  ESTADO_ATENCION_TEXTO,
  HORARIO,
  TAMANOS_PIZZA,
} from './gemini-prompt';
import { pesos } from './resumen-pedido';

/**
 * Lo que más preguntan los clientes de Messenger e Instagram, contestado con
 * texto fijo: el dato sale de las constantes del negocio (CLAUDE.md) y no del
 * modelo, así que no hay precios ni reglas inventadas.
 */

export type IntencionFija =
  | 'saludo'
  | 'humano'
  | 'descuento'
  | 'pedir'
  | 'menu'
  | 'domicilio'
  | 'precios'
  | 'horarioUbicacion'
  | 'horario'
  | 'ubicacion'
  | 'tamanos'
  | 'pagos'
  | 'mitad';

// Descuento confirmado por el dueño (nov 2026): solo miércoles y jueves, y
// solo hasta las 8:00 p.m. (hora de Bogotá).
export const DESCUENTO_PORCENTAJE = 20;
const HORA_LIMITE_DESCUENTO = 20;
const LUNES = 1;
const MARTES = 2;
const MIERCOLES = 3;
const JUEVES = 4;
const DIAS_CON_DESCUENTO = [MIERCOLES, JUEVES];
const NOMBRES_DIA = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];
const DIA_BOGOTA = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Bogota',
  weekday: 'short',
});
const INDICE_DIA = new Map(
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => [d, i]),
);
const MAX_LARGO_SALUDO = 30;
// Un mensaje largo trae los datos de un pedido (nombre, dirección, teléfono):
// no es una pregunta y lo atiende el flujo de pedido, no una respuesta fija.
const MAX_LARGO_PREGUNTA = 90;
const MAX_LARGO_PREGUNTA_MITAD = 140;

export const MENSAJE_HUMANO =
  'Listo, ya avisé al equipo: en breve una persona te escribe por aquí mismo 🙏';

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}%?!.,#\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 0 = domingo … 6 = sábado, en hora de Bogotá. */
export function diaSemanaBogota(ahora: Date): number {
  return INDICE_DIA.get(DIA_BOGOTA.format(ahora)) ?? 0;
}

function proximoDiaConDescuento(dia: number): string {
  if (dia === MIERCOLES) return 'mañana jueves';
  if (dia === MARTES) return 'mañana miércoles';
  if (dia === LUNES) return 'este miércoles';
  return 'el próximo miércoles';
}

/** Respuesta al "¿cómo aplico el 20% de descuento?": cambia con el día y la hora. */
export function textoDescuento(ahora: Date): string {
  const dia = diaSemanaBogota(ahora);
  const hayDescuentoHoy =
    DIAS_CON_DESCUENTO.includes(dia) &&
    minutosBogota(ahora) < HORA_LIMITE_DESCUENTO * MINUTOS_POR_HORA;
  const regla = `El descuento del ${DESCUENTO_PORCENTAJE}% aplica solo los miércoles y jueves, hasta las 8:00 p.m.`;
  if (hayDescuentoHoy) {
    const hoy = NOMBRES_DIA.at(dia) ?? '';
    return `¡Sí! 🎉 Hoy ${hoy} está activo el descuento del ${DESCUENTO_PORCENTAJE}%, hasta las 8:00 p.m.\n¿Quieres hacer tu pedido ahora?`;
  }
  const hoyDia = NOMBRES_DIA.at(dia) ?? '';
  const cuando = proximoDiaConDescuento(dia);
  const sufijo =
    dia === JUEVES || dia === MIERCOLES
      ? 'Hoy ya terminó.'
      : `Hoy ${hoyDia} no está activo.`;
  return `${regla}\n${sufijo} Vuelve ${cuando} y aprovéchalo 🍕`;
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function textoHorarioFijo(ahora: Date): string {
  const estado = capitalizar(ESTADO_ATENCION_TEXTO[estadoAtencion(ahora)]);
  return `Nuestro horario: ${HORARIO} 🕓\n${estado}`;
}

export function textoUbicacion(): string {
  return `Estamos en ${DIRECCION} 📍`;
}

export function textoDomicilio(): string {
  return `El domicilio cuesta ${pesos(COSTO_DOMICILIO_DEFAULT)} 🛵\nAl armar tu pedido me escribes tu dirección (calle o carrera, barrio y una referencia).`;
}

export function textoTamanos(): string {
  const lineas = TAMANOS_PIZZA.split('. ')
    .map((l) => l.replace(/\.$/, ''))
    .join('\n');
  return `Así son nuestras pizzas 🍕\n${lineas}`;
}

export function textoPagos(): string {
  return 'Recibimos efectivo, transferencia bancaria y tarjeta 💳\nAl terminar tu pedido eliges cómo pagar y ahí mismo te damos los datos.';
}

export function textoMitadYMitad(): string {
  return 'Sí, puedes pedir una pizza de dos sabores distintos en cualquier tamaño 🍕\nSe cobra el precio del sabor de mayor valor. Dime qué dos sabores y qué tamaño quieres y te confirmo el valor.';
}

export function textoSaludo(): string {
  return '¡Hola! 👋 Soy el asistente virtual de Pizzería Horebs 🍕\nEn cualquier momento puedes escribir "humano" para hablar con una persona del equipo.\n¿Qué quieres hacer?';
}

const TEXTOS = new Map<IntencionFija, (ahora: Date) => string>([
  ['saludo', textoSaludo],
  ['descuento', textoDescuento],
  ['horario', textoHorarioFijo],
  [
    'horarioUbicacion',
    (ahora) => `${textoHorarioFijo(ahora)}\n${textoUbicacion()}`,
  ],
  ['ubicacion', textoUbicacion],
  ['domicilio', textoDomicilio],
  ['tamanos', textoTamanos],
  ['pagos', textoPagos],
  ['mitad', textoMitadYMitad],
]);

/** El texto fijo de una intención; null en las que no son un texto (menú, pedir, precios, humano). */
export function textoDeIntencion(
  intencion: IntencionFija,
  ahora: Date,
): string | null {
  return TEXTOS.get(intencion)?.(ahora) ?? null;
}

const dice =
  (...reglas: RegExp[]) =>
  (t: string): boolean =>
    reglas.every((r) => r.test(t));

const REGLAS: [IntencionFija, (t: string) => boolean][] = [
  [
    'humano',
    dice(
      /\b(humano|asesor|agente|una persona|alguien del equipo|hablar con (alguien|una persona|un humano))\b/,
    ),
  ],
  [
    'descuento',
    dice(
      /\b(descuento|descuentos|promo\w*|cupon\w*|oferta\w*|rebaja\w*|20 ?%|20 por ?ciento)\b/,
    ),
  ],
  [
    'pedir',
    dice(/\b(hacer (un |mi )?pedido|quiero pedir|ordenar|encargar)\s*$/),
  ],
  [
    'menu',
    dice(
      /\b(menu|carta|catalogo|que (venden|tienen|manejan|hay para)|que pizzas (tienen|hay))\b/,
    ),
  ],
  [
    'domicilio',
    (t) =>
      (/\b(domicilio|envio|llegan|reparten)\b/.test(t) &&
        /\b(cuanto|costo|valor|sale|cuesta|barrio|zona|cobran|casa)\b/.test(
          t,
        )) ||
      (/\b(cuanto|costo|valor)\b/.test(t) && /\b(domicilio|envio)\b/.test(t)),
  ],
  ['precios', dice(/\b(precio|precios|cuanto (cuesta|vale|valen|sale|es))\b/)],
  [
    'horarioUbicacion',
    (t) => /\bhorario\b/.test(t) && /\b(ubicacion|direccion)\b/.test(t),
  ],
  [
    'horario',
    dice(
      /\b(horario|a que hora (abren|cierran|atienden|abre|cierra)|hasta que hora|abren|cierran|atienden)\b/,
    ),
  ],
  [
    'ubicacion',
    dice(
      /\b(direccion|direcion|ubicacion|ubicad\w*|hubicad\w*|donde (estan|quedan|se encuentran|queda|es)|en que parte|como llego)\b/,
    ),
  ],
  [
    'tamanos',
    dice(/\b(porcion\w*|tamanos?|centimetros?|cuanto mide|de cuanto es la)\b/),
  ],
  [
    'pagos',
    dice(
      /\b(como (pago|se paga|transfiero|puedo pagar)|medios? de pago|formas? de pago|metodos? de pago|aceptan|nequi|daviplata|brebe)\b/,
    ),
  ],
];

const PALABRAS_SALUDO = new Set([
  'hola',
  'holi',
  'ola',
  'hey',
  'buenas',
  'buenos',
  'buen',
  'saludos',
  'iniciar',
]);
const MAX_PALABRAS_SALUDO = 2;

/** "hola", "buenas tardes", "buen día": un saludo de una o dos palabras. */
function esSaludo(t: string): boolean {
  const palabras = t.replace(/[!.]/g, '').split(' ').filter(Boolean);
  return (
    palabras.length > 0 &&
    palabras.length <= MAX_PALABRAS_SALUDO &&
    PALABRAS_SALUDO.has(palabras.at(0) ?? '')
  );
}

function esPreguntaMitad(t: string): boolean {
  return (
    /\b(mitad|dos sabores)\b/.test(t) &&
    t.length <= MAX_LARGO_PREGUNTA_MITAD &&
    /\?|\b(se puede|puede|puedo|pueden|es posible)\b/.test(t)
  );
}

// Estas dos se contestan aunque el mensaje sea largo: pasan primero.
const SIEMPRE: IntencionFija[] = ['humano', 'descuento'];

/** La intención del mensaje, o null si no es de las que se contestan con texto fijo. */
export function detectarIntencion(texto: string): IntencionFija | null {
  const t = normalizar(texto);
  if (t.length <= MAX_LARGO_SALUDO && esSaludo(t)) return 'saludo';
  const corto = t.length <= MAX_LARGO_PREGUNTA;
  if (esPreguntaMitad(t)) return 'mitad';
  for (const [intencion, regla] of REGLAS) {
    if ((corto || SIEMPRE.includes(intencion)) && regla(t)) {
      return intencion;
    }
  }
  return null;
}
