import type { CatalogService } from '../catalog/catalog.service';
import { entraEnCatalogoMeta } from '../catalog/catalog.service';
import { esAdicional } from './adicionales';
import { palabrasSignificativas } from './busqueda-productos';
import type { TarjetaProducto } from './mensajes-interactivos';

export type Producto = Awaited<
  ReturnType<CatalogService['getProductos']>
>[number];

export interface CategoriaCatalogo {
  id: string;
  nombre: string;
}

/** Cuántas tarjetas con botón se mandan cuando no hay lista nativa. */
const MAX_TARJETAS = 3;
// Raíz de 5 letras para comparar categorías: "pizzas" → "pizza", "bebida" → "bebid".
const LARGO_RAIZ = 5;
// Las palabras de 3 letras o menos no sirven para reconocer una categoría.
const MIN_LARGO_PALABRA_CATEGORIA = 3;

/**
 * Orden de prioridad: un producto nombrado ("pizza hawaiana personal")
 * gana sobre su categoría; después la categoría ("pizzas", "bebidas");
 * después palabras de la descripción; y si nada matchea, todo el menú.
 */
export function elegirProductos(
  productos: Producto[],
  categorias: CategoriaCatalogo[],
  consulta: string,
): Producto[] {
  const buscadas = palabrasSignificativas(consulta);
  const puntuar = (texto: (p: Producto) => string): Producto[] =>
    productos
      .map((p) => ({
        producto: p,
        puntaje: palabrasSignificativas(texto(p)).filter((w) =>
          buscadas.includes(w),
        ).length,
      }))
      .filter((r) => r.puntaje > 0)
      .sort((a, b) => b.puntaje - a.puntaje)
      .map((r) => r.producto);

  const porNombre = puntuar((p) => p.nombre);
  if (porNombre.length > 0) return porNombre;

  // Raíz de 5 letras: "pizzas" → "pizza", "bebida" → "bebid". "pizza"
  // está entre las palabras ignoradas de arriba, por eso la categoría se
  // compara aparte.
  const raiz = (palabra: string): string =>
    palabra
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .slice(0, LARGO_RAIZ);
  const raicesConsulta = consulta
    .split(/[^\p{L}0-9]+/u)
    .filter((w) => w.length > MIN_LARGO_PALABRA_CATEGORIA)
    .map(raiz);
  const categoriasPedidas = new Set(
    categorias
      .filter((c) => raicesConsulta.includes(raiz(c.nombre)))
      .map((c) => c.id),
  );
  if (categoriasPedidas.size > 0) {
    return productos.filter((p) => categoriasPedidas.has(p.categoria_id));
  }

  const porDescripcion = puntuar((p) => `${p.nombre} ${p.descripcion ?? ''}`);
  return porDescripcion.length > 0 ? porDescripcion : productos;
}

/**
 * Hasta `maximo` productos como tarjetas (3 en WhatsApp; Messenger e Instagram
 * admiten más), con el precio más bajo de sus variantes. Los adicionales no
 * van como tarjeta: se ofrecen al armar el pedido.
 */
export function tarjetasDe(
  elegidos: Producto[],
  maximo = MAX_TARJETAS,
): TarjetaProducto[] {
  return elegidos
    .filter((p) => !esAdicional(p.nombre))
    .slice(0, maximo)
    .map((p) => ({
      nombre: p.nombre,
      descripcion: p.descripcion,
      imagenUrl: p.imagen_url,
      precioDesde: Math.min(
        ...p.variantes.map((v) => v.precio_oferta ?? v.precio),
      ),
    }));
}

/** Lo que entra al catálogo de Meta, agrupado por categoría (sin secciones vacías). */
export function seccionesPorCategoria(
  elegidos: Producto[],
  categorias: CategoriaCatalogo[],
): { titulo: string; productos: Producto[] }[] {
  const enCatalogo = elegidos.filter(entraEnCatalogoMeta);
  return categorias
    .map((c) => ({
      titulo: c.nombre,
      productos: enCatalogo.filter((p) => p.categoria_id === c.id),
    }))
    .filter((s) => s.productos.length > 0);
}

/** Texto del detalle de un producto para el modelo: descripción y precio de cada variante. */
export function textoDetalleProducto(producto: Producto): string {
  const variantes = producto.variantes
    .map(
      (v) =>
        `${v.nombre}: $${(v.precio_oferta ?? v.precio).toLocaleString('es-CO')}`,
    )
    .join(', ');
  return `${producto.nombre}${producto.descripcion ? ` — ${producto.descripcion}` : ''}. Precios: ${variantes}`;
}
