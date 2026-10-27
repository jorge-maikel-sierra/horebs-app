import type {
  CheckoutWhatsapp,
  ModalidadPedido,
  PasoCheckout,
} from './conversaciones.service';

export type MetodoPagoBot = 'efectivo' | 'transferencia' | 'tarjeta';

/** Lo que mandó el cliente, ya parseado del webhook. */
export type EntradaCheckout =
  | { tipo: 'boton'; id: string }
  | {
      tipo: 'ubicacion';
      latitud: number;
      longitud: number;
      direccion?: string;
      nombre?: string;
    }
  | { tipo: 'texto'; texto: string };

// Ids de botón: el prefijo `ck:` marca que lo maneja el checkout y no Gemini.
export const BOTON = {
  domicilio: 'ck:mod:domicilio',
  retiro: 'ck:mod:retiro',
  local: 'ck:mod:local',
  direccionAnterior: 'ck:dir:anterior',
  otraDireccion: 'ck:dir:otra',
  efectivo: 'ck:pago:efectivo',
  transferencia: 'ck:pago:transferencia',
  tarjeta: 'ck:pago:tarjeta',
  loMismo: 'ck:lomismo:si',
  verMenu: 'ck:lomismo:menu',
  otraCosa: 'ck:lomismo:otro',
} as const;

export const BOTONES_MODALIDAD = [
  { id: BOTON.domicilio, titulo: '🛵 Domicilio' },
  { id: BOTON.retiro, titulo: '🏃 Retiro' },
  { id: BOTON.local, titulo: '🍽️ En el local' },
];

export const BOTONES_PAGO = [
  { id: BOTON.efectivo, titulo: '💵 Efectivo' },
  { id: BOTON.transferencia, titulo: '🏦 Transferencia' },
  { id: BOTON.tarjeta, titulo: '💳 Tarjeta' },
];

function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

export function esBotonCheckout(id: string): boolean {
  return id.startsWith('ck:');
}

export function esCancelar(texto: string): boolean {
  return /^cancel(ar|a|o)?\b/.test(normalizar(texto));
}

/** Modalidad por botón o escrita ("a domicilio", "paso a recoger", "en el local"). */
export function modalidadDe(entrada: EntradaCheckout): ModalidadPedido | null {
  if (entrada.tipo === 'boton') {
    if (entrada.id === BOTON.domicilio) return 'domicilio';
    if (entrada.id === BOTON.retiro) return 'retiro';
    if (entrada.id === BOTON.local) return 'local';
    return null;
  }
  if (entrada.tipo !== 'texto') return null;
  const t = normalizar(entrada.texto);
  // Sin "envíame"/"mandame": en este paso también pueden pedir el menú.
  if (
    /\b(domicilio|envio|envi(an|en|ar|arla|arlo|amela|amelo)|llev(an|en|ar|enla|enlo|amela|amelo)|a (la|mi) casa)\b/.test(
      t,
    )
  )
    return 'domicilio';
  if (/\b(retir\w*|recog\w*|paso por|lo busco|para llevar)\b/.test(t))
    return 'retiro';
  if (/\b(local|comer (alla|ahi|aqui)|en la mesa)\b/.test(t)) return 'local';
  return null;
}

/** Método de pago por botón o escrito. */
export function metodoPagoDe(entrada: EntradaCheckout): MetodoPagoBot | null {
  if (entrada.tipo === 'boton') {
    if (entrada.id === BOTON.efectivo) return 'efectivo';
    if (entrada.id === BOTON.transferencia) return 'transferencia';
    if (entrada.id === BOTON.tarjeta) return 'tarjeta';
    return null;
  }
  if (entrada.tipo !== 'texto') return null;
  const t = normalizar(entrada.texto);
  if (/\b(efectivo|cash|billete)\b/.test(t)) return 'efectivo';
  if (/\b(transfer\w*|nequi|nu|bancolombia|daviplata)\b/.test(t))
    return 'transferencia';
  if (/\b(tarjeta|datafono|debito|credito)\b/.test(t)) return 'tarjeta';
  return null;
}

/** "📍 Calle 1 # 2-3 — https://maps.google.com/?q=11.5,-72.9" */
export function direccionDeUbicacion(
  entrada: Extract<EntradaCheckout, { tipo: 'ubicacion' }>,
): string {
  const mapa = `https://maps.google.com/?q=${entrada.latitud},${entrada.longitud}`;
  const texto = [entrada.nombre, entrada.direccion]
    .filter((t) => t?.trim())
    .join(', ');
  return texto ? `${texto} — ${mapa}` : `📍 ${mapa}`;
}

/** Misma cota que el checkout web (300 máx.); menos de 5 no es una dirección. */
export function direccionEscritaValida(texto: string): boolean {
  const largo = texto.trim().length;
  return largo >= 5 && largo <= 200;
}

/**
 * "Soy Jorge Sierra" → { nombre: 'Jorge', apellido: 'Sierra' }. Con una
 * sola palabra el apellido queda null y el bot lo pide aparte.
 */
export function separarNombre(texto: string): {
  nombre: string | null;
  apellido: string | null;
} {
  const limpio = texto
    .trim()
    .replace(/^(soy|me llamo|mi nombre es|a nombre de|es)\s+/i, '')
    .replace(/[^\p{L}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const palabras = limpio.split(' ').filter(Boolean);
  if (palabras.length === 0) return { nombre: null, apellido: null };
  const capital = (p: string) =>
    p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
  return {
    nombre: capital(palabras[0]),
    apellido:
      palabras.length > 1 ? palabras.slice(1).map(capital).join(' ') : null,
  };
}

/** Qué falta para poder cobrar, en orden. */
export function siguientePaso(checkout: CheckoutWhatsapp): PasoCheckout {
  if (!checkout.modalidad) return 'modalidad';
  if (checkout.modalidad === 'domicilio' && !checkout.direccion)
    return 'direccion';
  if (!checkout.nombre || !checkout.apellido) return 'nombre';
  return 'pago';
}

/**
 * Saludo o intención de pedir, corto: ahí tiene sentido ofrecer "lo mismo
 * de la última vez". Una pregunta concreta ("¿a qué hora abren?") va a
 * Gemini.
 */
export function esSaludoOIntencionDePedir(texto: string): boolean {
  const t = normalizar(texto);
  return (
    t.length <= 40 &&
    /^(hola|buenas|buenos|buen dia|hey|ola|que mas|menu|quiero pedir|quiero|pedir|un pedido|hacer un pedido)\b/.test(
      t,
    )
  );
}
