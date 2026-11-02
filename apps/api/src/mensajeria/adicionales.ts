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
