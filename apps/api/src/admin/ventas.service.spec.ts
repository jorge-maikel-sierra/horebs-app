import { BadRequestException } from '@nestjs/common';
import type { PuntosService } from '../clientes/puntos.service';
import type { InventarioService } from '../inventario/inventario.service';
import type { SupabaseService } from '../supabase/supabase.service';
import type { AvisosVentaService } from './avisos-venta.service';
import { calcularItemsVenta } from './calcular-items-venta';
import type {
  CrearVentaInput,
  FilaClienteVenta,
  ItemVentaCalculado,
} from './pedidos-admin.tipos';
import { VentasService } from './ventas.service';

jest.mock('./calcular-items-venta');

const CLIENTE: FilaClienteVenta = {
  id: 'c-1',
  nombre: 'Ana',
  apellido: null,
  telefono: '573157861208',
  correo: null,
  cedula: null,
};
const PEDIDO = {
  id: 'ped-1',
  modalidad: 'local',
  direccion_entrega: null,
  costo_domicilio: 0,
  metodo_pago: 'efectivo',
  total: 36000,
  created_at: '2026-11-01T20:00:00Z',
};
const ITEM: ItemVentaCalculado = {
  variante_id: 'v-1',
  nombre_personalizado: null,
  producto_nombre: 'Pizza Hawaiana',
  variante_nombre: 'Personal',
  cantidad: 2,
  precio_unitario: 18000,
  subtotal: 36000,
};

interface Escritura {
  tabla: string;
  op: 'insert' | 'upsert';
  datos: unknown;
}

interface Consulta {
  insert: (datos: unknown) => Consulta;
  upsert: (datos: unknown, opciones: unknown) => Consulta;
  select: () => Consulta;
  single: () => Promise<{ data: unknown; error: null }>;
  then: (resolver: (v: { error: null }) => unknown) => unknown;
}

/** Un cliente de Supabase de mentira: devuelve filas fijas y anota lo que se escribe. */
function crearCliente(clienteGuardado: FilaClienteVenta) {
  const escrituras: Escritura[] = [];
  const from = (tabla: string): Consulta => {
    const fila = tabla === 'clientes' ? clienteGuardado : PEDIDO;
    const b: Consulta = {
      insert: (datos) => {
        escrituras.push({ tabla, op: 'insert', datos });
        return b;
      },
      upsert: (datos) => {
        escrituras.push({ tabla, op: 'upsert', datos });
        return b;
      },
      select: () => b,
      single: () => Promise.resolve({ data: fila, error: null }),
      then: (resolver) => resolver({ error: null }),
    };
    return b;
  };
  return { cliente: { from }, escrituras };
}

function crearServicio(clienteGuardado: FilaClienteVenta = CLIENTE) {
  const { cliente, escrituras } = crearCliente(clienteGuardado);
  const inventario = {
    descontarPorVentaSeguro: jest.fn().mockResolvedValue(undefined),
  };
  const puntos = {
    calcularCanjeMaximo: jest
      .fn()
      .mockResolvedValue({ puntos: 100, descuento: 5000 }),
    registrarCanje: jest.fn().mockResolvedValue(undefined),
    marcarCanjePendiente: jest.fn().mockResolvedValue(undefined),
    otorgarPuntosPorCompraSeguro: jest.fn().mockResolvedValue(36),
  };
  const avisos = { avisar: jest.fn() };
  const servicio = new VentasService(
    { getClient: () => cliente } as unknown as SupabaseService,
    inventario as unknown as InventarioService,
    puntos as unknown as PuntosService,
    avisos as unknown as AvisosVentaService,
  );
  return { servicio, escrituras, inventario, puntos, avisos };
}

function venta(cambios: Partial<CrearVentaInput> = {}): CrearVentaInput {
  return {
    cliente: { nombre: 'Ana', telefono: '573157861208' },
    modalidad: 'local',
    metodo_pago: 'efectivo',
    items: [{ variante_id: 'v-1', cantidad: 2 }],
    ...cambios,
  };
}

describe('VentasService.crearVenta', () => {
  beforeEach(() => {
    jest
      .mocked(calcularItemsVenta)
      .mockResolvedValue({ itemsCalculados: [ITEM], total: 36000 });
  });

  it('una venta inválida se rechaza antes de tocar la base', async () => {
    const { servicio, escrituras } = crearServicio();

    await expect(
      servicio.crearVenta(venta({ cliente: { nombre: ' ' } }), 'u-1'),
    ).rejects.toThrow(BadRequestException);

    expect(escrituras).toEqual([]);
    expect(calcularItemsVenta).not.toHaveBeenCalled();
  });

  it('con teléfono guarda al cliente por upsert y registra el pedido como entregado en el POS', async () => {
    const { servicio, escrituras } = crearServicio();

    const resultado = await servicio.crearVenta(venta(), 'u-1');

    expect(escrituras.map((e) => `${e.tabla}:${e.op}`)).toEqual([
      'clientes:upsert',
      'pedidos:insert',
      'items_pedido:insert',
    ]);
    expect(escrituras[1].datos).toMatchObject({
      cliente_id: 'c-1',
      estado: 'entregado',
      canal: 'pos',
      registrado_por: 'u-1',
      total: 36000,
      costo_domicilio: 0,
      puntos_canjeados: 0,
    });
    expect(resultado).toMatchObject({
      id: 'ped-1',
      total: 36000,
      puntos_ganados: 36,
    });
  });

  it('descuenta stock solo de lo que tiene variante y avisa al final', async () => {
    const { servicio, inventario, avisos } = crearServicio();

    await servicio.crearVenta(venta({ notas: 'Sin cebolla' }), 'u-1');

    expect(inventario.descontarPorVentaSeguro).toHaveBeenCalledWith(
      [{ variante_id: 'v-1', cantidad: 2 }],
      'ped-1',
      'u-1',
    );
    expect(avisos.avisar).toHaveBeenCalledWith(
      expect.objectContaining({ notas: 'Sin cebolla', items: [ITEM] }),
    );
  });

  it('sin teléfono inserta un cliente nuevo y no toca los puntos', async () => {
    const { servicio, escrituras, puntos } = crearServicio({
      ...CLIENTE,
      telefono: null,
    });

    const resultado = await servicio.crearVenta(
      venta({ cliente: { nombre: 'Ana' }, usar_puntos: true }),
      'u-1',
    );

    expect(escrituras[0]).toMatchObject({ tabla: 'clientes', op: 'insert' });
    expect(puntos.calcularCanjeMaximo).not.toHaveBeenCalled();
    expect(puntos.otorgarPuntosPorCompraSeguro).not.toHaveBeenCalled();
    expect(resultado.puntos_ganados).toBe(0);
  });

  it('al canjear puntos el pedido se cobra con el descuento y los puntos ganados salen del total pagado', async () => {
    const { servicio, escrituras, puntos } = crearServicio();

    const resultado = await servicio.crearVenta(
      venta({ usar_puntos: true }),
      'u-1',
    );

    expect(escrituras[1].datos).toMatchObject({
      total: 31000,
      puntos_canjeados: 100,
      descuento_puntos: 5000,
    });
    expect(puntos.registrarCanje).toHaveBeenCalledWith('c-1', 100, 'ped-1');
    expect(puntos.otorgarPuntosPorCompraSeguro).toHaveBeenCalledWith(
      'c-1',
      31000,
      'ped-1',
    );
    expect(resultado).toMatchObject({
      puntos_canjeados: 100,
      descuento_puntos: 5000,
    });
  });

  it('si el canje falla la venta sigue: el pedido queda marcado para revisión', async () => {
    const { servicio, puntos } = crearServicio();
    puntos.registrarCanje.mockRejectedValue(new Error('saldo cambió'));

    const resultado = await servicio.crearVenta(
      venta({ usar_puntos: true }),
      'u-1',
    );

    expect(puntos.marcarCanjePendiente).toHaveBeenCalledWith(
      'ped-1',
      'saldo cambió',
    );
    expect(resultado.id).toBe('ped-1');
  });

  it('un domicilio suma el costo al total y manda la dirección al pedido', async () => {
    const { servicio, escrituras } = crearServicio();

    await servicio.crearVenta(
      venta({
        modalidad: 'domicilio',
        direccion_entrega: 'Carrera 7 # 17B - 66',
      }),
      'u-1',
    );

    expect(escrituras[1].datos).toMatchObject({
      modalidad: 'domicilio',
      direccion_entrega: 'Carrera 7 # 17B - 66',
      costo_domicilio: 5000,
      total: 41000,
    });
  });
});
