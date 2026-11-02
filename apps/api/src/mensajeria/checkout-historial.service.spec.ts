import type { CatalogService } from '../catalog/catalog.service';
import type { PedidosConsultasService } from '../pedidos/pedidos-consultas.service';
import { CheckoutHistorialService } from './checkout-historial.service';

const TELEFONO = '573157861208';

function crearServicio(ultimo: { items: unknown[] } | null) {
  const consultas = {
    clientePorTelefono: jest.fn().mockResolvedValue({ nombre: 'Ana' }),
    ultimoPedidoPorTelefono: jest.fn().mockResolvedValue(ultimo),
  };
  const catalog = {
    resolverCarrito: jest.fn().mockResolvedValue({
      disponibles: [{ varianteId: 'v-1' }],
      noDisponibles: 1,
    }),
  };
  const servicio = new CheckoutHistorialService(
    catalog as unknown as CatalogService,
    consultas as unknown as PedidosConsultasService,
  );
  return { servicio, consultas, catalog };
}

describe('CheckoutHistorialService', () => {
  it('cliente consulta al cliente por su teléfono', async () => {
    const { servicio, consultas } = crearServicio(null);

    await expect(servicio.cliente(TELEFONO)).resolves.toEqual({
      nombre: 'Ana',
    });
    expect(consultas.clientePorTelefono).toHaveBeenCalledWith(TELEFONO);
  });

  it('sin pedidos anteriores no hay nada que repetir ni se consulta el catálogo', async () => {
    const { servicio, catalog } = crearServicio(null);

    await expect(servicio.ultimoPedidoRepetible(TELEFONO)).resolves.toEqual({
      disponibles: [],
      noDisponibles: 0,
    });
    expect(catalog.resolverCarrito).not.toHaveBeenCalled();
  });

  it('cruza el último pedido con lo que hoy hay en el catálogo', async () => {
    const items = [{ varianteId: 'v-1', cantidad: 2 }];
    const { servicio, catalog } = crearServicio({ items });

    await expect(servicio.ultimoPedidoRepetible(TELEFONO)).resolves.toEqual({
      disponibles: [{ varianteId: 'v-1' }],
      noDisponibles: 1,
    });
    expect(catalog.resolverCarrito).toHaveBeenCalledWith(items);
  });
});
