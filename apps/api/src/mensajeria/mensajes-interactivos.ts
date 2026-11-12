export interface TarjetaProducto {
  nombre: string;
  descripcion: string | null;
  imagenUrl: string | null;
  precioDesde: number;
}

export interface SeccionListaProductos {
  titulo: string;
  /** `product_retailer_id` del catálogo de Meta = UUID de la variante. */
  retailerIds: string[];
}

export interface BotonRespuesta {
  id: string;
  titulo: string;
}

export interface ListaProductos {
  encabezado: string;
  cuerpo: string;
  secciones: SeccionListaProductos[];
}

/** Cuerpo del campo `interactive` de un mensaje de WhatsApp. */
export type Interactivo = Record<string, unknown>;

// Límites de WhatsApp para mensajes interactivos con botones.
const MAX_BOTONES = 3;
const MAX_TITULO_BOTON = 20;
const MAX_CUERPO = 1024;
const MAX_FILAS_LISTA = 10;
const MAX_TITULO_FILA = 24;

// WhatsApp corta el título de un botón de respuesta a 20 caracteres — el
// nombre del producto va en el id del botón (hasta 256 caracteres), nunca
// en el título.
const TITULO_BOTON_AGREGAR = 'Agregar al pedido';

// Límites de Meta para un mensaje product_list — si se pasan, rechaza el
// mensaje entero en vez de recortarlo.
const MAX_ITEMS_LISTA = 30;
const MAX_SECCIONES_LISTA = 10;
const MAX_TITULO_SECCION = 24;
const MAX_ENCABEZADO_LISTA = 60;

/**
 * Recorta una lista a los límites de Meta: hasta 10 secciones, 30 ítems
 * en total (se llenan en orden, así las primeras secciones quedan
 * completas) y títulos cortos. Las secciones que quedan vacías se quitan.
 */
export function recortarListaProductos(lista: ListaProductos): ListaProductos {
  let disponibles = MAX_ITEMS_LISTA;
  const secciones: SeccionListaProductos[] = [];
  for (const seccion of lista.secciones.slice(0, MAX_SECCIONES_LISTA)) {
    const retailerIds = seccion.retailerIds.slice(0, disponibles);
    disponibles -= retailerIds.length;
    if (retailerIds.length === 0) continue;
    secciones.push({
      titulo: seccion.titulo.slice(0, MAX_TITULO_SECCION),
      retailerIds,
    });
  }
  return {
    encabezado: lista.encabezado.slice(0, MAX_ENCABEZADO_LISTA),
    cuerpo: lista.cuerpo,
    secciones,
  };
}

/**
 * Gemini responde en Markdown estándar (**negrita**), pero WhatsApp solo
 * reconoce un asterisco de cada lado (*negrita*) — con doble asterisco no
 * lo interpreta como formato y lo muestra literal. Se normaliza acá, en el
 * único punto de salida real, para cubrir cualquier texto saliente sin
 * importar de dónde venga.
 */
export function normalizarNegritaWhatsapp(texto: string): string {
  return texto.replace(/\*\*(.+?)\*\*/g, '*$1*');
}

const cuerpoDe = (texto: string): { text: string } => ({
  text: normalizarNegritaWhatsapp(texto).slice(0, MAX_CUERPO),
});

const precioDesde = (valor: number): string =>
  `Desde $${valor.toLocaleString('es-CO')}`;

/** Hasta 3 botones de respuesta; el id vuelve como `button_reply.id`. */
export function interactivoBotones(
  cuerpo: string,
  botones: BotonRespuesta[],
): Interactivo {
  return {
    type: 'button',
    body: cuerpoDe(cuerpo),
    action: {
      buttons: botones.slice(0, MAX_BOTONES).map((b) => ({
        type: 'reply',
        reply: { id: b.id, title: b.titulo.slice(0, MAX_TITULO_BOTON) },
      })),
    },
  };
}

/** Lista de hasta 10 filas; el id vuelve como `list_reply.id`. */
export function interactivoLista(datos: {
  cuerpo: string;
  boton: string;
  filas: BotonRespuesta[];
}): Interactivo {
  return {
    type: 'list',
    body: cuerpoDe(datos.cuerpo),
    action: {
      button: datos.boton.slice(0, MAX_TITULO_BOTON),
      sections: [
        {
          rows: datos.filas.slice(0, MAX_FILAS_LISTA).map((f) => ({
            id: f.id,
            title: f.titulo.slice(0, MAX_TITULO_FILA),
          })),
        },
      ],
    },
  };
}

/** Catálogo nativo completo del número del bot. */
export function interactivoCatalogo(miniaturaRetailerId?: string): Interactivo {
  return {
    type: 'catalog_message',
    body: {
      text: 'Aquí tienes nuestro menú 🍕 Elige lo que quieras, agrégalo al carrito y mándamelo por acá.',
    },
    action: {
      name: 'catalog_message',
      ...(miniaturaRetailerId
        ? {
            parameters: {
              thumbnail_product_retailer_id: miniaturaRetailerId,
            },
          }
        : {}),
    },
  };
}

/** `lista` ya viene recortada con `recortarListaProductos`. */
export function interactivoListaProductos(
  lista: ListaProductos,
  catalogId: string,
): Interactivo {
  return {
    type: 'product_list',
    header: { type: 'text', text: lista.encabezado },
    body: { text: lista.cuerpo },
    action: {
      catalog_id: catalogId,
      sections: lista.secciones.map((s) => ({
        title: s.titulo,
        product_items: s.retailerIds.map((id) => ({
          product_retailer_id: id,
        })),
      })),
    },
  };
}

/** Botón que abre el catálogo del sitio en el navegador. */
export function interactivoBotonCatalogo(url: string): Interactivo {
  return {
    type: 'cta_url',
    body: { text: 'Mira nuestro catálogo completo con fotos y precios 🍕' },
    action: {
      name: 'cta_url',
      parameters: { display_text: 'Ver catálogo', url },
    },
  };
}

/**
 * Tarjeta de un producto: imagen (o nombre) de encabezado y un botón cuyo
 * id lleva el nombre del producto, no un UUID, para que el webhook arme un
 * texto natural sin volver a consultar la base.
 */
export function interactivoTarjetaProducto(
  producto: TarjetaProducto,
): Interactivo {
  const cuerpo = [producto.descripcion, precioDesde(producto.precioDesde)]
    .filter(Boolean)
    .join('\n');
  return {
    type: 'button',
    header: producto.imagenUrl
      ? { type: 'image', image: { link: producto.imagenUrl } }
      : { type: 'text', text: producto.nombre },
    body: {
      text: producto.imagenUrl ? cuerpo : `*${producto.nombre}*\n${cuerpo}`,
    },
    action: {
      buttons: [
        {
          type: 'reply',
          reply: {
            id: `pedir:${producto.nombre}`,
            title: TITULO_BOTON_AGREGAR,
          },
        },
      ],
    },
  };
}

/** Messenger e Instagram no tienen tarjetas: van como texto plano. */
export function textoTarjetasProductos(productos: TarjetaProducto[]): string {
  const lista = productos
    .map(
      (p) => `• ${p.nombre}: desde $${p.precioDesde.toLocaleString('es-CO')}`,
    )
    .join('\n');
  return `Estas son algunas opciones:\n${lista}`;
}
