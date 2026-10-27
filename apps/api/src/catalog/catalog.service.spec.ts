import {
  CatalogService,
  entraEnCatalogoMeta,
  type ProductoDto,
} from './catalog.service';

function producto(parcial: Partial<ProductoDto>): ProductoDto {
  return {
    id: 'p',
    nombre: 'Producto',
    descripcion: null,
    imagen_url: 'https://img/p.jpg',
    destacado: false,
    categoria_id: 'c',
    slug: 'producto',
    ventas_historicas: null,
    variantes: [],
    ...parcial,
  };
}

const HAWAIANA = producto({
  id: 'p-1',
  nombre: 'Pizza Hawaiana',
  variantes: [
    { id: 'v-personal', nombre: 'Personal', precio: 1, precio_oferta: null },
    { id: 'v-grande', nombre: 'Grande', precio: 2, precio_oferta: null },
  ],
});
const GASEOSA = producto({
  id: 'p-2',
  nombre: 'Coca-Cola',
  variantes: [
    { id: 'v-coca', nombre: 'Única', precio: 1, precio_oferta: null },
  ],
});

describe('entraEnCatalogoMeta', () => {
  it('exige foto y slug, igual que el feed', () => {
    expect(entraEnCatalogoMeta(HAWAIANA)).toBe(true);
    expect(entraEnCatalogoMeta({ imagen_url: null, slug: 'x' })).toBe(false);
    expect(entraEnCatalogoMeta({ imagen_url: 'x', slug: null })).toBe(false);
  });
});

describe('CatalogService.resolverCarrito', () => {
  function crearServicio() {
    const servicio = new CatalogService({} as never);
    jest.spyOn(servicio, 'getProductos').mockResolvedValue([HAWAIANA, GASEOSA]);
    return servicio;
  }

  it('resuelve nombre, tamaño y si el producto tiene tamaños', async () => {
    const { disponibles, noDisponibles } =
      await crearServicio().resolverCarrito([
        { varianteId: 'v-grande', cantidad: 2 },
        { varianteId: 'v-coca', cantidad: 1 },
      ]);
    expect(noDisponibles).toBe(0);
    expect(disponibles).toEqual([
      {
        varianteId: 'v-grande',
        productoNombre: 'Pizza Hawaiana',
        varianteNombre: 'Grande',
        conTamanos: true,
        cantidad: 2,
        precio: 2,
      },
      {
        varianteId: 'v-coca',
        productoNombre: 'Coca-Cola',
        varianteNombre: 'Única',
        conTamanos: false,
        cantidad: 1,
        precio: 1,
      },
    ]);
  });

  it('cuenta como no disponibles las variantes inactivas o desconocidas', async () => {
    const { disponibles, noDisponibles } =
      await crearServicio().resolverCarrito([
        { varianteId: 'v-grande', cantidad: 1 },
        { varianteId: 'v-borrada', cantidad: 1 },
      ]);
    expect(disponibles).toHaveLength(1);
    expect(noDisponibles).toBe(1);
  });
});
