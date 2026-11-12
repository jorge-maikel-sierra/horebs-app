/**
 * Atribución de anuncios para la API de conversiones de Meta.
 *
 * Al llegar al sitio desde un anuncio la URL trae `fbclid` y los `utm_*`. El
 * Pixel (cargado por GTM) arma la cookie `_fbc` solo si alcanza a cargar; por
 * eso también la armamos acá, con el formato documentado por Meta. Los UTM se
 * guardan en localStorage para que sigan disponibles cuando el cliente llegue
 * al checkout varias páginas después.
 */

const CLAVE_UTM = 'horebs_utm';
const CAMPOS_UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
const DIAS_COOKIE_FBC = 90;
const DIAS_UTM = 30;
const MS_POR_DIA = 86_400_000;
const SEGUNDOS_POR_DIA = 86_400;

type Utm = Partial<Record<(typeof CAMPOS_UTM)[number], string>>;

export type Atribucion = Utm & {
  fbp?: string;
  fbc?: string;
  url?: string;
};

function leerCookie(nombre: string): string | undefined {
  const par = document.cookie.split('; ').find((c) => c.startsWith(`${nombre}=`));
  return par ? decodeURIComponent(par.slice(nombre.length + 1)) : undefined;
}

/** Se llama una vez al cargar cualquier página. */
export function capturarAtribucion(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const fbclid = params.get('fbclid');
    const fbcActual = leerCookie('_fbc');
    if (fbclid && !fbcActual?.endsWith(`.${fbclid}`)) {
      const valor = `fb.1.${Date.now()}.${fbclid}`;
      document.cookie = `_fbc=${encodeURIComponent(valor)}; path=/; max-age=${DIAS_COOKIE_FBC * SEGUNDOS_POR_DIA}; SameSite=Lax`;
    }
    const utm: Utm = {};
    for (const campo of CAMPOS_UTM) {
      const valor = params.get(campo);
      if (valor) utm[campo] = valor;
    }
    if (Object.keys(utm).length > 0) {
      localStorage.setItem(CLAVE_UTM, JSON.stringify({ utm, en: Date.now() }));
    }
  } catch {
    // Sin cookies o sin localStorage (modo privado): la compra sigue igual.
  }
}

function utmGuardados(): Utm {
  try {
    const crudo = localStorage.getItem(CLAVE_UTM);
    if (!crudo) return {};
    const { utm, en } = JSON.parse(crudo) as { utm: Utm; en: number };
    return Date.now() - en < DIAS_UTM * MS_POR_DIA ? utm : {};
  } catch {
    return {};
  }
}

/** Lo que viaja con el pedido. La URL va sin query: puede traer datos personales. */
export function leerAtribucion(): Atribucion {
  try {
    return {
      ...utmGuardados(),
      fbp: leerCookie('_fbp'),
      fbc: leerCookie('_fbc'),
      url: `${window.location.origin}${window.location.pathname}`,
    };
  } catch {
    return {};
  }
}
