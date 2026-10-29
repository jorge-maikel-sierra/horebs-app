import type {
  ProductoDto,
  VarianteProductoDto,
} from '../catalog/catalog.service';

// Tamaños y conectores no distinguen un producto de otro — se ignoran al
// comparar NOMBRES DE PRODUCTO. "pizza personal hawaiana" tiene que
// matchear "Pizza Hawaiana" aunque la palabra de tamaño se meta en el
// medio. Para elegir la variante (el tamaño) se usa normalizar() sin esta
// lista: ahí "mediana" es justo la palabra que importa.
const PALABRAS_IGNORADAS = new Set([
  'pizza',
  'de',
  'y',
  'la',
  'el',
  'con',
  'una',
  'un',
  'personal',
  'mediana',
  'grande',
]);

/** Minúsculas, sin tildes, partido en palabras de más de una letra. */
function normalizar(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1);
}

export function palabrasSignificativas(texto: string): string[] {
  return normalizar(texto).filter((w) => !PALABRAS_IGNORADAS.has(w));
}

export interface BusquedaProducto {
  encontrado?: ProductoDto;
  /** Solo cuando lo buscado nombraba una variante ("Jugo Hit 400ml"). */
  variante?: VarianteProductoDto;
  error?: string;
}

function mejorUnico<T>(candidatos: { item: T; puntaje: number }[]): {
  unico?: T;
  empatados: T[];
} {
  const conPuntaje = candidatos
    .filter((c) => c.puntaje > 0)
    .sort((a, b) => b.puntaje - a.puntaje);
  if (conPuntaje.length === 0) return { empatados: [] };
  const empatados = conPuntaje
    .filter((c) => c.puntaje === conPuntaje[0].puntaje)
    .map((c) => c.item);
  return {
    unico: empatados.length === 1 ? empatados[0] : undefined,
    empatados,
  };
}

/**
 * Busca un producto por nombre. Si ningún nombre de producto coincide,
 * busca entre los nombres de variante — en el catálogo, las bebidas son el
 * producto "Bebidas" y cada bebida es una variante, así que "Jugo Hit
 * 400ml" o "Coca-Cola" solo aparecen como variante.
 */
export function buscarProductoUnico(
  nombreBuscado: string,
  productos: ProductoDto[],
): BusquedaProducto {
  const buscadas = palabrasSignificativas(nombreBuscado);
  if (buscadas.length === 0) {
    return { error: `No se pudo identificar el producto "${nombreBuscado}".` };
  }
  const coincidencias = (texto: string) =>
    palabrasSignificativas(texto).filter((w) => buscadas.includes(w)).length;

  const porProducto = mejorUnico(
    productos.map((p) => ({ item: p, puntaje: coincidencias(p.nombre) })),
  );
  if (porProducto.unico) return { encontrado: porProducto.unico };
  if (porProducto.empatados.length > 1) {
    const nombres = porProducto.empatados.map((p) => p.nombre).join(', ');
    return {
      error: `"${nombreBuscado}" es ambiguo — podría ser: ${nombres}. Hay que preguntarle al cliente cuál de esos quiere.`,
    };
  }

  const porVariante = mejorUnico(
    productos.flatMap((p) =>
      p.variantes.map((v) => ({
        item: { producto: p, variante: v },
        puntaje: coincidencias(v.nombre),
      })),
    ),
  );
  if (porVariante.unico) {
    return {
      encontrado: porVariante.unico.producto,
      variante: porVariante.unico.variante,
    };
  }
  if (porVariante.empatados.length > 1) {
    const nombres = porVariante.empatados
      .map((c) => `${c.producto.nombre} (${c.variante.nombre})`)
      .join(', ');
    return {
      error: `"${nombreBuscado}" es ambiguo — podría ser: ${nombres}. Hay que preguntarle al cliente cuál de esos quiere.`,
    };
  }
  return {
    error: `No se encontró ningún producto que coincida con "${nombreBuscado}" en el catálogo.`,
  };
}

/**
 * Variante de un producto según el tamaño o sabor que dijo el cliente
 * ("mediana", "Jugo Hit 400ml"). Con una sola variante no hay nada que
 * elegir. Devuelve undefined si no se puede decidir sin preguntar.
 */
export function elegirVariante(
  producto: ProductoDto,
  tamano: string | null,
): VarianteProductoDto | undefined {
  if (producto.variantes.length === 1) return producto.variantes[0];
  const pedidas = normalizar(tamano ?? '');
  if (pedidas.length === 0) return undefined;
  const { unico } = mejorUnico(
    producto.variantes.map((v) => ({
      item: v,
      puntaje: normalizar(v.nombre).filter((w) => pedidas.includes(w)).length,
    })),
  );
  return unico;
}

/** true si el nombre de la variante nombra el tamaño pedido ("mediana"). */
export function nombraTamano(
  variante: VarianteProductoDto,
  tamano: string,
): boolean {
  const pedidas = normalizar(tamano);
  return normalizar(variante.nombre).some((w) => pedidas.includes(w));
}

// Corrida de 7 o más dígitos seguidos: un número de cuenta, Nequi o
// teléfono. Los precios salen con puntos de miles ($39.000) y las
// direcciones con guiones y numerales, así que no entran acá.
const NUMERO_LARGO = /\d{7,}/;

/**
 * Barrera determinística contra datos de pago inventados: en producción el
 * modelo llegó a inventar una cuenta "Nequi/Daviplata 3001234567" cuando
 * calcular_pedido falló. El bot nunca tiene por qué escribir un número
 * largo que no le haya devuelto una herramienta en este mismo turno.
 */
export function contieneNumeroNoVerificado(
  texto: string,
  resultadosHerramientas: string[],
): boolean {
  const numeros = texto.match(new RegExp(NUMERO_LARGO, 'g')) ?? [];
  return numeros.some(
    (n) => !resultadosHerramientas.some((r) => r.includes(n)),
  );
}
