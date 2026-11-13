import { ENLACE_WHATSAPP_NEGOCIO } from '../common/contacto';
import { COSTO_DOMICILIO_DEFAULT } from '../common/costos';
import { estadoAtencion } from '../common/horario';
import {
  PROMO_PORCENTAJE,
  diaSemanaBogota,
  promocionActiva,
} from '../common/promocion';
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
  | 'whatsapp'
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

const LUNES = 1;
const MARTES = 2;
const MIERCOLES = 3;
const JUEVES = 4;
const NOMBRES_DIA = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];
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

function proximoDiaConDescuento(dia: number): string {
  if (dia === MIERCOLES) return 'mañana jueves';
  if (dia === MARTES) return 'mañana miércoles';
  if (dia === LUNES) return 'este miércoles';
  return 'el próximo miércoles';
}

/** Respuesta al "¿cómo aplico el 20% de descuento?": cambia con el día y la hora. */
export function textoDescuento(ahora: Date): string {
  const dia = diaSemanaBogota(ahora);
  const hoy = NOMBRES_DIA.at(dia) ?? '';
  const alcance = `Es sobre el valor de tus pizzas (el domicilio no tiene descuento) y se aplica solo, al armar tu pedido por aquí.`;
  if (promocionActiva(ahora)) {
    return `¡Sí! 🎉 Hoy ${hoy} tienes ${PROMO_PORCENTAJE}% de descuento, hasta las 8:00 p.m.\n${alcance}\n¿Quieres hacer tu pedido ahora?`;
  }
  const regla = `El descuento del ${PROMO_PORCENTAJE}% aplica solo los miércoles y jueves, hasta las 8:00 p.m.`;
  const sufijo =
    dia === JUEVES || dia === MIERCOLES
      ? 'Hoy ya terminó.'
      : `Hoy ${hoy} no está activo.`;
  return `${regla}\n${sufijo} Vuelve ${proximoDiaConDescuento(dia)} y aprovéchalo 🍕`;
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

export function textoWhatsapp(): string {
  return `Claro 👇 Toca este enlace y se te abre nuestro chat de WhatsApp:\n${ENLACE_WHATSAPP_NEGOCIO}\nSi prefieres, aquí mismo también te tomo el pedido 🍕`;
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
  ['whatsapp', textoWhatsapp],
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

const PALABRA_WHATSAPP = /\b(whatsapp|whatsap|wasap|wsp|wpp|watsap)\b/;
const PALABRA_NUMERO = /\b(numero|telefono|celular|contacto)\b/;
const PIDE_EL_DATO =
  /\b(su|sus|tu|el|cual|cuales|tienen|dame|deme|regalame|regala|pasame|pasa|deseo|quiero|necesito|da|das|envia|enviame|manda|mandame)\b/;
// "mi número es…", "300 839 2278" o "el número de mi pedido": no piden el contacto del negocio.
const NO_ES_CONTACTO =
  /\bmi (numero|telefono|celular|whatsapp)\b|\d{7,}|\bnumero de (mi |su |tu |el )?(pedido|orden|cuenta|guia)\b/;

/** "¿Cuál es el número de WhatsApp?", "deseo su número de contacto": pide el contacto del negocio. */
function pideWhatsapp(t: string): boolean {
  if (NO_ES_CONTACTO.test(t)) return false;
  return (
    PALABRA_WHATSAPP.test(t) || (PALABRA_NUMERO.test(t) && PIDE_EL_DATO.test(t))
  );
}

const REGLAS: [IntencionFija, (t: string) => boolean][] = [
  [
    'humano',
    dice(
      /\b(humano|asesor|agente|una persona|alguien del equipo|hablar con (alguien|una persona|un humano))\b/,
    ),
  ],
  ['whatsapp', pideWhatsapp],
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
        /\b(cuanto|costo|valor|sale|cuesta|barrios?|zonas?|cubren|cobertura|cobran|casa)\b/.test(
          t,
        )) ||
      (/\b(cuanto|costo|valor)\b/.test(t) && /\b(domicilio|envio)\b/.test(t)) ||
      /\b(que|cuales) (zonas|barrios|sectores) (cubren|llegan|reparten)\b/.test(
        t,
      ),
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

// Estas se contestan aunque el mensaje sea largo: pasan primero.
const SIEMPRE: IntencionFija[] = ['humano', 'whatsapp', 'descuento'];

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
