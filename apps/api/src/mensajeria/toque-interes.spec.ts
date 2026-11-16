import type { ProductoDto } from '../catalog/catalog.service';
import { mensajeToque, ventanaToque } from './toque-interes';

const pizza: ProductoDto = {
  id: 'hw',
  nombre: 'Pizza Hawaiana',
  descripcion: null,
  imagen_url: null,
  destacado: true,
  categoria_id: 'c',
  slug: 'hw',
  ventas_historicas: null,
  variantes: [
    { id: 'hw-p', nombre: 'Personal', precio: 20000, precio_oferta: null },
  ],
};

describe('segundo mensaje a quien vino por un anuncio', () => {
  it('le escribe a quien calla hace entre 2 y 23 horas (dentro de las 24 h de Meta)', () => {
    const ahora = new Date('2026-11-16T20:00:00Z');
    expect(ventanaToque(ahora)).toEqual({
      desde: '2026-11-15T21:00:00.000Z',
      hasta: '2026-11-16T18:00:00.000Z',
    });
  });

  it('nombra el producto que vio y ofrece sus tamaños', () => {
    const { texto, botones } = mensajeToque(pizza);
    expect(texto).toBe(
      '¿Te animas con la Pizza Hawaiana? 🍕 Elige el tamaño y te la dejo en el pedido 👇',
    );
    expect(botones.map((b) => b.id)).toEqual(['ped:v:hw-p', 'mnu:menu']);
  });
});
