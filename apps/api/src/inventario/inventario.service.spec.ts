import type { MailService } from '../mail/mail.service';
import type { SupabaseService } from '../supabase/supabase.service';
import type { InsumosService } from './insumos.service';
import { InventarioService } from './inventario.service';
import type { FilaRecetaExplosion } from './inventario.tipos';

interface Resultado {
  data: unknown;
  error: { message: string } | null;
}

interface Consulta {
  select: () => Consulta;
  in: () => Consulta;
  eq: () => Consulta;
  update: (datos: unknown) => Consulta;
  returns: () => Promise<Resultado>;
  then: (resolver: (v: Resultado) => unknown) => unknown;
}

const RECETAS: FilaRecetaExplosion[] = [
  {
    variante_id: 'v-1',
    receta_componentes: [
      {
        tipo_componente: 'insumo',
        insumo_id: 'harina',
        subreceta_id: null,
        cantidad_necesaria_g: 200,
        subrecetas: null,
      },
    ],
  },
];

const ITEMS = [{ variante_id: 'v-1', cantidad: 2 }];

interface Respuestas {
  recetas?: Resultado;
  rpc?: Resultado;
  actualizar?: Resultado;
}

function crearServicio(respuestas: Respuestas = {}) {
  const actualizaciones: unknown[] = [];
  const recetas = respuestas.recetas ?? { data: RECETAS, error: null };
  const from = (): Consulta => {
    const b: Consulta = {
      select: () => b,
      in: () => b,
      eq: () => b,
      update: (datos) => {
        actualizaciones.push(datos);
        return b;
      },
      returns: () => Promise.resolve(recetas),
      then: (resolver) =>
        resolver(respuestas.actualizar ?? { data: null, error: null }),
    };
    return b;
  };
  const rpc = jest.fn().mockResolvedValue(respuestas.rpc ?? { error: null });
  const avisos: unknown[] = [];
  const mail = {
    enviarAlertaStockPendiente: (aviso: unknown): number => avisos.push(aviso),
  };
  const insumos = {
    verificarYAlertarStockBajo: jest.fn().mockResolvedValue(undefined),
  };
  const servicio = new InventarioService(
    { getClient: () => ({ from, rpc }) } as unknown as SupabaseService,
    mail as unknown as MailService,
    insumos as unknown as InsumosService,
  );
  return { servicio, rpc, avisos, insumos, actualizaciones };
}

describe('InventarioService.calcularExplosion', () => {
  it('sin ítems no consulta recetas', async () => {
    const { servicio } = crearServicio({
      recetas: { data: null, error: { message: 'no debía llamarse' } },
    });

    await expect(servicio.calcularExplosion([])).resolves.toEqual([]);
  });

  it('explota las recetas activas de las variantes vendidas', async () => {
    const { servicio } = crearServicio();

    await expect(servicio.calcularExplosion(ITEMS)).resolves.toEqual([
      { insumo_id: 'harina', cantidad_g: 400 },
    ]);
  });

  it('un error de base se traduce con errorDeBase', async () => {
    const { servicio } = crearServicio({
      recetas: { data: null, error: { message: 'caído' } },
    });

    await expect(servicio.calcularExplosion(ITEMS)).rejects.toThrow();
  });
});

describe('InventarioService: descontar y revertir', () => {
  it('descontarPorVenta manda la RPC con las cantidades en negativo', async () => {
    const { servicio, rpc, insumos } = crearServicio();

    await servicio.descontarPorVenta(ITEMS, 'p-1', 'u-1');

    expect(rpc).toHaveBeenCalledWith('aplicar_movimientos_stock', {
      p_movimientos: [{ insumo_id: 'harina', cantidad_g: -400 }],
      p_referencia_tipo: 'pedido',
      p_referencia_id: 'p-1',
      p_tipo: 'venta',
      p_created_by: 'u-1',
    });
    expect(insumos.verificarYAlertarStockBajo).toHaveBeenCalledWith(['harina']);
  });

  it('revertirPorVenta devuelve las cantidades en positivo', async () => {
    const { servicio, rpc } = crearServicio();

    await servicio.revertirPorVenta(ITEMS, 'p-1', null);

    expect(rpc).toHaveBeenCalledWith('aplicar_movimientos_stock', {
      p_movimientos: [{ insumo_id: 'harina', cantidad_g: 400 }],
      p_referencia_tipo: 'pedido',
      p_referencia_id: 'p-1',
      p_tipo: 'reversion',
      p_created_by: null,
    });
  });

  it('sin recetas no toca el ledger', async () => {
    const { servicio, rpc } = crearServicio({
      recetas: { data: [], error: null },
    });

    await servicio.descontarPorVenta(ITEMS, 'p-1', null);

    expect(rpc).not.toHaveBeenCalled();
  });

  it('si la verificación de stock bajo falla, no tumba la venta', async () => {
    const { servicio, insumos } = crearServicio();
    insumos.verificarYAlertarStockBajo.mockRejectedValue(
      new Error('sin correo'),
    );

    await expect(
      servicio.descontarPorVenta(ITEMS, 'p-1', null),
    ).resolves.toBeUndefined();
  });
});

describe('InventarioService.descontarPorVentaSeguro', () => {
  it('si todo sale bien no marca nada ni avisa', async () => {
    const { servicio, avisos, actualizaciones } = crearServicio();

    await servicio.descontarPorVentaSeguro(ITEMS, 'p-1', null);

    expect(actualizaciones).toEqual([]);
    expect(avisos).toEqual([]);
  });

  it('si la RPC falla marca el pedido como pendiente y avisa por correo', async () => {
    const { servicio, avisos, actualizaciones } = crearServicio({
      rpc: { data: null, error: { message: 'rpc caída' } },
    });

    await expect(
      servicio.descontarPorVentaSeguro(ITEMS, 'p-1', null),
    ).resolves.toBeUndefined();

    expect(actualizaciones).toEqual([{ stock_status: 'pendiente' }]);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatchObject({ pedidoId: 'p-1' });
  });

  it('aunque no se pueda marcar el pedido, igual avisa por correo', async () => {
    const { servicio, avisos } = crearServicio({
      rpc: { data: null, error: { message: 'rpc caída' } },
      actualizar: { data: null, error: { message: 'tampoco' } },
    });

    await servicio.descontarPorVentaSeguro(ITEMS, 'p-1', null);

    expect(avisos).toHaveLength(1);
  });
});
