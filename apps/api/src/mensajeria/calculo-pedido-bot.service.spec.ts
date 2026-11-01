import type { CatalogService, ProductoDto } from '../catalog/catalog.service';
import { CalculoPedidoBotService } from './calculo-pedido-bot.service';
import type { ConversacionesService } from './conversaciones.service';

function pizza(nombre: string, precios: Record<string, number>): ProductoDto {
  return {
    id: `p-${nombre}`,
    nombre,
    descripcion: null,
    imagen_url: null,
    destacado: false,
    categoria_id: 'cat-pizza',
    slug: null,
    ventas_historicas: null,
    variantes: Object.entries(precios).map(([tamano, precio]) => ({
      id: `${nombre}-${tamano}`,
      nombre: tamano,
      precio,
      precio_oferta: null,
    })),
  };
}

const TAMANOS = { Personal: 20000, Mediana: 40000, Grande: 60000 };
const ESPECIAL = pizza('Pizza Horebs Especial', TAMANOS);
const JAMON = pizza('Pizza de Jamón y Queso', {
  Personal: 15000,
  Mediana: 30000,
  Grande: 45000,
});
const COLA: ProductoDto = {
  ...pizza('Cola', { 'Cola 400ml': 4000 }),
  categoria_id: 'cat-bebidas',
};

const CLIENTE = {
  nombre: 'Ana',
  apellido: 'Pérez',
  modalidad: 'retiro',
};

function crearServicio(
  carrito: { varianteId: string; cantidad: number }[] = [],
) {
  const catalog = {
    getProductos: jest.fn().mockResolvedValue([ESPECIAL, JAMON, COLA]),
    getCategorias: jest.fn().mockResolvedValue([
      { id: 'cat-pizza', nombre: 'Pizzas' },
      { id: 'cat-bebidas', nombre: 'Bebidas' },
    ]),
    resolverCarrito: jest.fn().mockResolvedValue({
      disponibles: carrito.map((c) => ({
        varianteId: c.varianteId,
        cantidad: c.cantidad,
        productoNombre: 'Pizza Horebs Especial',
        varianteNombre: 'Mediana',
        conTamanos: true,
        precio: 40000,
      })),
      noDisponibles: 0,
    }),
  };
  const conversaciones = {
    obtenerCarrito: jest.fn().mockResolvedValue(carrito),
  };
  const servicio = new CalculoPedidoBotService(
    catalog as unknown as CatalogService,
    conversaciones as unknown as ConversacionesService,
  );
  return { servicio, catalog, conversaciones };
}

const calcular = (
  servicio: CalculoPedidoBotService,
  argumentos: Record<string, unknown>,
) => servicio.calcular(argumentos, 'whatsapp', '573157861208');

describe('CalculoPedidoBotService.calcular', () => {
  it('se niega a calcular sin nombre completo y no consulta nada', async () => {
    const { servicio, catalog, conversaciones } = crearServicio();
    const r = await calcular(servicio, { ...CLIENTE, apellido: '', items: [] });
    expect(r).toMatchObject({ ok: false });
    expect(!r.ok && r.texto).toContain('nombre completo');
    expect(conversaciones.obtenerCarrito).not.toHaveBeenCalled();
    expect(catalog.getProductos).not.toHaveBeenCalled();
  });

  it('calcula un producto pedido por escrito con el precio de la base', async () => {
    const { servicio } = crearServicio();
    const r = await calcular(servicio, {
      ...CLIENTE,
      items: [{ producto: 'especial', tamano: 'grande', cantidad: 2 }],
    });
    expect(r).toMatchObject({
      ok: true,
      items: [{ varianteId: 'Pizza Horebs Especial-Grande', cantidad: 2 }],
      lineas: [
        {
          cantidad: 2,
          productoNombre: 'Pizza Horebs Especial',
          varianteNombre: 'Grande',
          precioUnitario: 60000,
        },
      ],
      datos: { modalidad: 'retiro', nombre: 'Ana', apellido: 'Pérez' },
    });
  });

  it('junta el carrito del catálogo con lo pedido por escrito', async () => {
    const { servicio } = crearServicio([
      { varianteId: 'Pizza Horebs Especial-Mediana', cantidad: 1 },
    ]);
    const r = await calcular(servicio, {
      ...CLIENTE,
      items: [{ producto: 'cola' }],
    });
    expect(r.ok && r.lineas).toHaveLength(2);
    expect(r.ok && r.items.map((i) => i.varianteId)).toEqual([
      'Pizza Horebs Especial-Mediana',
      'Cola-Cola 400ml',
    ]);
  });

  it('si el tamaño no está claro pregunta con las opciones exactas', async () => {
    const { servicio } = crearServicio();
    const r = await calcular(servicio, {
      ...CLIENTE,
      items: [{ producto: 'especial' }],
    });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.texto).toContain('Personal, Mediana, Grande');
  });

  it('un producto que no existe no devuelve total', async () => {
    const { servicio } = crearServicio();
    const r = await calcular(servicio, {
      ...CLIENTE,
      items: [{ producto: 'lasaña de unicornio' }],
    });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.texto).toContain('No se pudo calcular el pedido');
  });

  it('sin carrito ni productos no hay nada que calcular', async () => {
    const { servicio } = crearServicio();
    const r = await calcular(servicio, { ...CLIENTE, items: [] });
    expect(!r.ok && r.texto).toContain('No hay productos para calcular');
  });

  it('mitad y mitad cobra el sabor de mayor valor y deja la nota', async () => {
    const { servicio } = crearServicio();
    const r = await calcular(servicio, {
      ...CLIENTE,
      items: [
        {
          producto: 'especial',
          segundo_sabor: 'jamón queso',
          tamano: 'mediana',
          cantidad: 2,
        },
      ],
    });
    expect(r.ok && r.lineas[0]).toMatchObject({
      cantidad: 2,
      productoNombre: 'Pizza mitad y mitad',
      precioUnitario: 40000,
    });
    expect(r.ok && r.items[0].varianteId).toBe('Pizza Horebs Especial-Mediana');
    expect(r.ok && r.datos.nota).toMatch(/^2 pizzas:/);
  });

  it('acota la cantidad a 20', async () => {
    const { servicio } = crearServicio();
    const r = await calcular(servicio, {
      ...CLIENTE,
      items: [{ producto: 'cola', cantidad: 999 }],
    });
    expect(r.ok && r.items[0].cantidad).toBe(20);
  });
});
