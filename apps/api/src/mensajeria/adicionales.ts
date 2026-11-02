import type {
  ItemCarritoResuelto,
  ProductoDto,
  VarianteProductoDto,
} from '../catalog/catalog.service';
import type { ItemCarritoPendiente } from './conversaciones.tipos';

/**
 * Los adicionales (borde de queso, jamón, pimentón…) son productos normales
 * del catálogo, uno por adicional, con una variante por tamaño de pizza
 * (Personal $5.000, Mediana $9.000, Grande $12.000). Así el total, el pedido y
 * el comprobante los suman sin lógica aparte; el precio sale de la base.
 */
export const PREFIJO_ADICIONAL = 'Adicional: ';

const TAMANOS_PIZZA = new Set(['personal', 'mediana', 'grande']);

function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

export function esAdicional(productoNombre: string): boolean {
  return productoNombre.startsWith(PREFIJO_ADICIONAL);
}

/** "Adicional: Borde de queso" → "Borde de queso". */
export function nombreCortoAdicional(productoNombre: string): string {
  return esAdicional(productoNombre)
    ? productoNombre.slice(PREFIJO_ADICIONAL.length)
    : productoNombre;
}

/** Las pizzas del carrito (con su tamaño): a ellas se les pega el adicional. */
export function pizzasDelCarrito(
  items: ItemCarritoResuelto[],
): ItemCarritoResuelto[] {
  return items.filter(
    (i) =>
      i.conTamanos &&
      !esAdicional(i.productoNombre) &&
      TAMANOS_PIZZA.has(normalizar(i.varianteNombre)),
  );
}

export function adicionalesDeCatalogo(productos: ProductoDto[]): ProductoDto[] {
  return productos.filter(
    (p) => esAdicional(p.nombre) && p.variantes.length > 0,
  );
}

/** La variante del adicional con el mismo tamaño que la pizza; null si no hay. */
export function varianteParaTamano(
  adicional: ProductoDto,
  tamano: string,
): VarianteProductoDto | null {
  const buscado = normalizar(tamano);
  return (
    adicional.variantes.find((v) => normalizar(v.nombre) === buscado) ?? null
  );
}

/** Suma `cantidad` de la variante al carrito, juntándola si ya estaba. */
export function sumarAlCarrito(
  carrito: ItemCarritoPendiente[],
  varianteId: string,
  cantidad = 1,
): ItemCarritoPendiente[] {
  const existe = carrito.some((i) => i.varianteId === varianteId);
  if (!existe) return [...carrito, { varianteId, cantidad }];
  return carrito.map((i) =>
    i.varianteId === varianteId ? { ...i, cantidad: i.cantidad + cantidad } : i,
  );
}

const AGREGA_ANTES_DEL_NOMBRE =
  /\b(adicional(es)?|extra|con|agrega(r|me|le)?|anade|anadir|ponle|ponme)( (de|del|un|una|el|la|mas))?$/;

function nombreAparece(texto: string, nombre: string): boolean {
  const inicio = texto.indexOf(nombre);
  if (inicio < 0) return false;
  const siguiente = texto.charAt(inicio + nombre.length);
  const termina = !/[a-z0-9]/.test(siguiente);
  return termina && AGREGA_ANTES_DEL_NOMBRE.test(texto.slice(0, inicio).trim());
}

/**
 * El adicional que el cliente escribió ("con borde de queso", "agrégame
 * pepperoni"). Exige una palabra que agrega justo antes del nombre, y descarta
 * lo que nombra una pizza ("una pizza ranchera con piña" es otro pedido).
 */
export function adicionalMencionado(
  texto: string,
  adicionales: ProductoDto[],
): ProductoDto | null {
  const t = normalizar(texto);
  if (/\bpizza\b/.test(t)) return null;
  return (
    adicionales.find((a) =>
      nombreAparece(t, normalizar(nombreCortoAdicional(a.nombre))),
    ) ?? null
  );
}

export function respuestaEsNo(texto: string): boolean {
  return /^(no|nop|nada|listo|ya|seguir|continuar|eso es todo|asi esta bien)\b/.test(
    normalizar(texto),
  );
}

export function respuestaEsSi(texto: string): boolean {
  return /^(si|sii|claro|dale|ok|quiero|agregar)\b/.test(normalizar(texto));
}

const MENCIONA_ADICIONAL = /\b(adicional(es)?|extras?|borde)\b/;
const PIDE_PRECIO_O_LISTA =
  /\b(precio|precios|cuanto|cuesta|cuestan|vale|valen|valor|costo|cobran|cobra|que|cuales|tienen|manejan|hay|venden|ofrecen)\b/;

/**
 * El cliente pregunta por los adicionales o por lo que cuestan ("¿cuánto vale
 * el borde de queso?", "¿qué adicionales tienen?"). Se contesta con una
 * respuesta fija armada con los precios de la base: el modelo ya inventó un
 * rango ("entre $6.000 y $8.000") cuando se le dejó contestar. Con la palabra
 * "pizza" es un pedido y sigue su camino normal.
 */
export function esPreguntaDeAdicionales(texto: string): boolean {
  const t = normalizar(texto);
  return (
    !/\bpizza\b/.test(t) &&
    MENCIONA_ADICIONAL.test(t) &&
    PIDE_PRECIO_O_LISTA.test(t)
  );
}

function precioDe(variante: VarianteProductoDto): number {
  return variante.precio_oferta ?? variante.precio;
}

function pesosCO(valor: number): string {
  return `$${valor.toLocaleString('es-CO')}`;
}

/** Tamaño → precio, si todos los adicionales cuestan lo mismo en ese tamaño. */
function preciosPorTamano(
  adicionales: ProductoDto[],
): Map<string, number> | null {
  const porTamano = new Map<string, Set<number>>();
  for (const a of adicionales) {
    for (const v of a.variantes) {
      porTamano.set(
        v.nombre,
        (porTamano.get(v.nombre) ?? new Set<number>()).add(precioDe(v)),
      );
    }
  }
  if ([...porTamano.values()].some((precios) => precios.size > 1)) return null;
  return new Map(
    [...porTamano].map(([tamano, precios]) => [tamano, [...precios][0]]),
  );
}

/**
 * Qué adicionales hay y cuánto cuestan según el tamaño de la pizza, con los
 * precios de la base. null si no hay adicionales cargados.
 */
export function textoAdicionales(productos: ProductoDto[]): string | null {
  const adicionales = adicionalesDeCatalogo(productos);
  if (adicionales.length === 0) return null;
  const nombres = adicionales
    .map((a) => nombreCortoAdicional(a.nombre).toLowerCase())
    .join(', ');
  const unicos = preciosPorTamano(adicionales);
  const precios = unicos
    ? [...unicos]
        .sort(([, a], [, b]) => a - b)
        .map(([tamano, precio]) => `${tamano} ${pesosCO(precio)}`)
        .join(', ')
    : adicionales
        .map(
          (a) =>
            `${nombreCortoAdicional(a.nombre)}: ${a.variantes
              .map((v) => `${v.nombre} ${pesosCO(precioDe(v))}`)
              .join(', ')}`,
        )
        .join('. ');
  return `Los adicionales se cobran según el tamaño de la pizza: ${precios}. Tenemos: ${nombres}. Dime cuál quieres y se lo agrego a tu pizza 🍕`;
}
