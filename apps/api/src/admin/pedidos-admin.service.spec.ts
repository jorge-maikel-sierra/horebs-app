import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { FacturaService } from '../facturas/factura.service';
import type { InventarioService } from '../inventario/inventario.service';
import type { SupabaseService } from '../supabase/supabase.service';
import type { AvisosCambioPedidoService } from './avisos-cambio-pedido.service';
import { calcularItemsVenta } from './calcular-items-venta';
import { PedidosAdminService } from './pedidos-admin.service';

jest.mock('./calcular-items-venta');
// factura.service es .tsx (react-pdf) y jest no resuelve esa extensión.
jest.mock('../facturas/factura.service', () => ({ FacturaService: class {} }), {
  virtual: true,
});

interface Operacion {
  tabla: string;
  op: 'update' | 'delete' | 'insert';
  datos?: unknown;
}

const ACTUAL = {
  id: 'ped-1',
  costo_domicilio: 5000,
  estado: 'confirmado',
  items_pedido: [{ variante_id: 'v-1', cantidad: 2 }],
};
const FILA_ADMIN = {
  id: 'ped-1',
  canal: 'whatsapp',
  modalidad: 'domicilio',
  direccion_entrega: 'Carrera 7',
  costo_domicilio: 5000,
  metodo_pago: 'efectivo',
  estado: 'confirmado',
  stock_status: 'ok',
  total: 45000,
  created_at: '2026-10-31T19:00:00Z',
  clientes: { id: 'c-1', nombre: 'Ana', telefono: '573157861208' },
  items_pedido: [],
};

interface Consulta {
  select: () => Consulta;
  eq: () => Consulta;
  update: (datos: unknown) => Consulta;
  delete: () => Consulta;
  insert: (datos: unknown) => Promise<{ error: null }>;
  maybeSingle: () => Promise<{ data: unknown; error: null }>;
  single: () => Promise<{ data: unknown; error: null }>;
  then: (resolver: (v: { error: null }) => unknown) => unknown;
}

/** Un cliente de Supabase de mentira: lee `actual` y `admin`, anota lo que se escribe. */
function crearCliente(actual: unknown) {
  const operaciones: Operacion[] = [];
  const from = (tabla: string): Consulta => {
    const b: Consulta = {
      select: () => b,
      eq: () => b,
      update: (datos) => {
        operaciones.push({ tabla, op: 'update', datos });
        return b;
      },
      delete: () => {
        operaciones.push({ tabla, op: 'delete' });
        return b;
      },
      insert: (datos) => {
        operaciones.push({ tabla, op: 'insert', datos });
        return Promise.resolve({ error: null });
      },
      maybeSingle: () => Promise.resolve({ data: actual, error: null }),
      single: () => Promise.resolve({ data: FILA_ADMIN, error: null }),
      then: (resolver) => resolver({ error: null }),
    };
    return b;
  };
  return { cliente: { from }, operaciones };
}

function crearServicio(actual: unknown = ACTUAL) {
  const { cliente, operaciones } = crearCliente(actual);
  const supabase = { getClient: () => cliente };
  const inventario = {
    revertirPorVenta: jest.fn().mockResolvedValue(undefined),
    descontarPorVentaSeguro: jest.fn().mockResolvedValue(undefined),
  };
  const avisosCambio = { avisar: jest.fn() };
  const servicio = new PedidosAdminService(
    supabase as unknown as SupabaseService,
    inventario as unknown as InventarioService,
    avisosCambio as unknown as AvisosCambioPedidoService,
    {} as FacturaService,
  );
  return { servicio, operaciones, inventario, avisosCambio };
}

describe('PedidosAdminService.editarPedido', () => {
  beforeEach(() => {
    jest.mocked(calcularItemsVenta).mockResolvedValue({
      itemsCalculados: [
        {
          variante_id: 'v-9',
          nombre_personalizado: null,
          producto_nombre: 'Pizza',
          variante_nombre: 'Mediana',
          cantidad: 1,
          precio_unitario: 40000,
          subtotal: 40000,
        },
      ],
      total: 40000,
    });
  });

  it('un método de pago o un estado desconocido es 400 y no toca la base', async () => {
    const { servicio, operaciones } = crearServicio();

    await expect(
      servicio.editarPedido('ped-1', { metodo_pago: 'bitcoin' }, 'u-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      servicio.editarPedido('ped-1', { estado: 'volando' }, 'u-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(operaciones).toEqual([]);
  });

  it('un pedido que no existe es 404', async () => {
    const { servicio } = crearServicio(null);

    await expect(
      servicio.editarPedido('ped-x', { estado: 'entregado' }, 'u-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('cambiar el estado actualiza el pedido y avisa del cambio', async () => {
    const { servicio, operaciones, avisosCambio } = crearServicio();

    const pedido = await servicio.editarPedido(
      'ped-1',
      { estado: 'entregado' },
      'u-1',
    );

    expect(operaciones).toEqual([
      { tabla: 'pedidos', op: 'update', datos: { estado: 'entregado' } },
    ]);
    expect(avisosCambio.avisar).toHaveBeenCalledWith(
      pedido,
      'entregado',
      'confirmado',
    );
  });

  it('cancelar un pedido devuelve el stock de lo que tenía', async () => {
    const { servicio, inventario } = crearServicio();

    await servicio.editarPedido('ped-1', { estado: 'cancelado' }, 'u-1');

    expect(inventario.revertirPorVenta).toHaveBeenCalledWith(
      [{ variante_id: 'v-1', cantidad: 2 }],
      'ped-1',
      'u-1',
    );
  });

  it('reemplazar los ítems recalcula el total con el domicilio y mueve el stock', async () => {
    const { servicio, operaciones, inventario } = crearServicio();

    await servicio.editarPedido(
      'ped-1',
      { items: [{ variante_id: 'v-9', cantidad: 1 }] },
      'u-1',
    );

    expect(inventario.revertirPorVenta).toHaveBeenCalledTimes(1);
    expect(inventario.descontarPorVentaSeguro).toHaveBeenCalledWith(
      [{ variante_id: 'v-9', cantidad: 1 }],
      'ped-1',
      'u-1',
    );
    expect(operaciones.map((o) => `${o.tabla}:${o.op}`)).toEqual([
      'items_pedido:delete',
      'items_pedido:insert',
      'pedidos:update',
    ]);
    expect(operaciones[2].datos).toEqual({ total: 45000 });
  });

  it('reemplazar ítems y cancelar a la vez no descuenta stock de los nuevos', async () => {
    const { servicio, inventario } = crearServicio();

    await servicio.editarPedido(
      'ped-1',
      { estado: 'cancelado', items: [{ variante_id: 'v-9', cantidad: 1 }] },
      'u-1',
    );

    expect(inventario.revertirPorVenta).toHaveBeenCalledTimes(1);
    expect(inventario.descontarPorVentaSeguro).not.toHaveBeenCalled();
  });
});
