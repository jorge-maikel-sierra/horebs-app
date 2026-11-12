/**
 * Atribución del checkout web: lo que la API de conversiones necesita para
 * ligar la venta al clic del anuncio (cookies de Meta, UTM, URL, IP y
 * navegador). Nunca bloquea un pedido: un dato raro o de más se descarta en
 * silencio, porque es medición y no parte de la compra.
 */

const MAX_LARGO = 500;
const SITIO_URL = 'https://pizzeriahorebs.shop';
// fb.<subdominio>.<timestamp>.<valor> — formato de las cookies _fbp y _fbc.
const FORMATO_COOKIE_META = /^fb\.\d\.\d{10,13}\.[\w.-]+$/;
const CAMPOS_UTM = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const;

export interface AtribucionWebInput {
  fbp?: string;
  fbc?: string;
  url?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

export interface ContextoHttp {
  ip: string | null;
  userAgent: string | null;
}

export type AtribucionWeb = Partial<
  Record<(typeof CAMPOS_UTM)[number], string>
> & {
  fbp?: string;
  fbc?: string;
  url?: string;
  ip?: string;
  user_agent?: string;
};

function texto(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const limpio = valor.trim();
  return limpio ? limpio.slice(0, MAX_LARGO) : null;
}

function cookieMeta(valor: unknown): string | null {
  const limpio = texto(valor);
  return limpio && FORMATO_COOKIE_META.test(limpio) ? limpio : null;
}

/** Solo URLs del propio sitio y sin query (puede traer datos personales). */
function urlDelSitio(valor: unknown): string | null {
  const limpio = texto(valor);
  if (!limpio?.startsWith(SITIO_URL)) return null;
  return limpio.split(/[?#]/)[0];
}

export function normalizarAtribucion(
  entrada: unknown,
  http: ContextoHttp | undefined,
): AtribucionWeb | null {
  const datos = new Map(
    Object.entries(entrada && typeof entrada === 'object' ? entrada : {}),
  );
  const candidatos: [string, string | null][] = [
    ...CAMPOS_UTM.map((c): [string, string | null] => [c, texto(datos.get(c))]),
    ['fbp', cookieMeta(datos.get('fbp'))],
    ['fbc', cookieMeta(datos.get('fbc'))],
    ['url', urlDelSitio(datos.get('url'))],
    ['ip', texto(http?.ip)],
    ['user_agent', texto(http?.userAgent)],
  ];
  const presentes = candidatos.filter(([, valor]) => valor !== null);
  return presentes.length > 0 ? Object.fromEntries(presentes) : null;
}

/**
 * IP real del cliente: detrás del proxy de Railway llega en
 * `x-forwarded-for` (la primera de la lista es la del cliente).
 */
export function contextoHttp(req: {
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}): ContextoHttp {
  const reenviada = req.headers['x-forwarded-for'];
  const lista = Array.isArray(reenviada) ? reenviada[0] : reenviada;
  const ip = lista?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;
  const agente = req.headers['user-agent'];
  return {
    ip,
    userAgent: (Array.isArray(agente) ? agente[0] : agente) ?? null,
  };
}
