import { NEGOCIO } from '@/lib/negocio';

const SITE_URL = `https://${NEGOCIO.sitio}`;
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

interface VarianteProductoDto {
  nombre: string;
  precio: number;
  precio_oferta: number | null;
}

interface ProductoDto {
  nombre: string;
  descripcion: string | null;
  destacado: boolean;
  slug: string | null;
  variantes: VarianteProductoDto[];
}

function formatPrecio(precio: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(precio);
}

function lineaProducto(p: ProductoDto): string {
  const precios = p.variantes.map((v) => v.precio_oferta ?? v.precio);
  const desde = precios.length > 0 ? Math.min(...precios) : null;
  const precioTexto = desde !== null ? `desde ${formatPrecio(desde)}` : 'precio a consultar';
  const descripcion = p.descripcion?.trim();
  const url = p.slug ? `${SITE_URL}/menu/${p.slug}` : `${SITE_URL}/catalogo`;
  return `- [${p.nombre}](${url}): ${precioTexto}.${descripcion ? ` ${descripcion}` : ''}`;
}

export async function GET() {
  let productos: ProductoDto[] = [];
  try {
    const res = await fetch(`${API_URL}/catalogo/productos`, { cache: 'no-store' });
    if (res.ok) productos = await res.json();
  } catch {
    // API no disponible al generar llms.txt: seguimos solo con las
    // secciones estáticas en vez de romper la respuesta.
  }

  const destacados = productos.filter((p) => p.destacado);
  const resto = productos.filter((p) => !p.destacado);

  const contenido = `# ${NEGOCIO.nombre}

> Pizzería artesanal en ${NEGOCIO.direccion.split(',').slice(1).join(',').trim()}, Colombia. Pedidos en línea con carrito y checkout, catálogo completo, y atención por WhatsApp con respuesta automática.

Horario de atención: ${NEGOCIO.horario}.
Dirección: ${NEGOCIO.direccion}.
WhatsApp: ${NEGOCIO.whatsapp}.

## Páginas principales

- [Catálogo completo](${SITE_URL}/catalogo): Todas las pizzas, panzerottis y bebidas con precios actualizados.
- [Contacto](${SITE_URL}/contacto): Dirección, horario y WhatsApp.
- [Blog](${SITE_URL}/blog): Novedades del negocio.
- [Cuenta](${SITE_URL}/cuenta): Registro, historial y estado de pedidos.
- [Política de privacidad](${SITE_URL}/politica-privacidad): Cómo se tratan los datos de los clientes.

${destacados.length > 0 ? `## Productos destacados\n\n${destacados.map(lineaProducto).join('\n')}\n` : ''}
${resto.length > 0 ? `## Resto del menú\n\n${resto.map(lineaProducto).join('\n')}\n` : ''}
## Cómo pedir

Los pedidos se hacen en línea en ${SITE_URL}/catalogo con carrito y checkout, o directamente por WhatsApp al ${NEGOCIO.whatsapp}, donde un asistente automático responde consultas de menú, horario y estado de pedido en el momento.
`.replace(/\n{3,}/g, '\n\n');

  return new Response(contenido, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
