import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { MailService } from '../mail/mail.service';
import type { SupabaseService } from '../supabase/supabase.service';
import { PuntosService } from './puntos.service';

interface Resultado {
  data: unknown;
  error: { message: string } | null;
}

interface Escritura {
  tabla: string;
  datos: unknown;
}

interface Consulta {
  select: () => Consulta;
  in: () => Consulta;
  eq: () => Consulta;
  gt: () => Consulta;
  lt: () => Consulta;
  order: () => Consulta;
  limit: () => Consulta;
  update: (datos: unknown) => Consulta;
  upsert: (datos: unknown) => Consulta;
  returns: () => Consulta;
  single: () => Promise<Resultado>;
  maybeSingle: () => Promise<Resultado>;
  then: (resolver: (v: Resultado) => unknown) => unknown;
}

const SIN_ERROR: Resultado = { data: null, error: null };

const CONFIG_FILAS: Resultado = {
  data: [
    { clave: 'puntos_por_1000_pesos', valor: '1' },
    { clave: 'valor_punto_pesos', valor: '50' },
    { clave: 'puntos_minimo_canje', valor: '100' },
    { clave: 'puntos_vencimiento_meses', valor: '12' },
  ],
  error: null,
};

interface Respuestas {
  /** Lo que devuelve la consulta por tabla (para `then`, `single` y `maybeSingle`). */
  tablas?: Record<string, Resultado>;
  /** Respuesta de cada llamada a la RPC, en orden; la última se repite. */
  rpc?: Resultado[];
}

function crearServicio(respuestas: Respuestas = {}) {
  const escrituras: Escritura[] = [];
  const tablas = new Map(
    Object.entries({ configuracion: CONFIG_FILAS, ...respuestas.tablas }),
  );
  const from = (tabla: string): Consulta => {
    const resultado = tablas.get(tabla) ?? SIN_ERROR;
    const b: Consulta = {
      select: () => b,
      in: () => b,
      eq: () => b,
      gt: () => b,
      lt: () => b,
      order: () => b,
      limit: () => b,
      update: (datos) => {
        escrituras.push({ tabla, datos });
        return b;
      },
      upsert: (datos) => {
        escrituras.push({ tabla, datos });
        return b;
      },
      returns: () => b,
      single: () => Promise.resolve(resultado),
      maybeSingle: () => Promise.resolve(resultado),
      then: (resolver) => resolver(resultado),
    };
    return b;
  };
  const llamadasRpc: unknown[] = [];
  const respuestasRpc = [...(respuestas.rpc ?? [SIN_ERROR])];
  const rpc = (_nombre: string, params: unknown): Promise<Resultado> => {
    llamadasRpc.push(params);
    const siguiente =
      respuestasRpc.length > 1 ? respuestasRpc.shift() : respuestasRpc[0];
    return Promise.resolve(siguiente ?? SIN_ERROR);
  };
  const avisos: unknown[] = [];
  const mail = {
    enviarAlertaPuntosPendientes: (aviso: unknown): number =>
      avisos.push(aviso),
  };
  const servicio = new PuntosService(
    { getClient: () => ({ from, rpc }) } as unknown as SupabaseService,
    mail as unknown as MailService,
  );
  return { servicio, escrituras, llamadasRpc, avisos };
}

describe('PuntosService: configuración', () => {
  it('lee la configuración guardada', async () => {
    const { servicio } = crearServicio();

    await expect(servicio.obtenerConfiguracion()).resolves.toEqual({
      puntosPor1000Pesos: 1,
      valorPuntoPesos: 50,
      puntosMinimoCanje: 100,
      puntosVencimientoMeses: 12,
    });
  });

  it('actualizar escribe solo lo que cambió', async () => {
    const { servicio, escrituras } = crearServicio();

    await servicio.actualizarConfiguracion({ valorPuntoPesos: 60 });

    expect(escrituras).toEqual([
      {
        tabla: 'configuracion',
        datos: [{ clave: 'valor_punto_pesos', valor: '60' }],
      },
    ]);
  });

  it('un cambio vacío no toca la base', async () => {
    const { servicio, escrituras } = crearServicio();

    await servicio.actualizarConfiguracion({});

    expect(escrituras).toEqual([]);
  });

  it('un valor negativo es 400 y no escribe', async () => {
    const { servicio, escrituras } = crearServicio();

    await expect(
      servicio.actualizarConfiguracion({ puntosMinimoCanje: -1 }),
    ).rejects.toThrow(BadRequestException);
    expect(escrituras).toEqual([]);
  });
});

describe('PuntosService: saldo y canje', () => {
  it('el saldo por teléfono trae el valor del punto y el mínimo de canje', async () => {
    const { servicio } = crearServicio({
      tablas: {
        clientes: {
          data: { nombre: 'Ana', puntos_actuales: 340 },
          error: null,
        },
      },
    });

    await expect(servicio.obtenerSaldoPorTelefono('315')).resolves.toEqual({
      nombre: 'Ana',
      puntos: 340,
      valorPuntoPesos: 50,
      puntosMinimoCanje: 100,
    });
  });

  it('un teléfono sin cliente devuelve null', async () => {
    const { servicio } = crearServicio({
      tablas: { clientes: SIN_ERROR },
    });

    await expect(servicio.obtenerSaldoPorTelefono('000')).resolves.toBeNull();
  });

  it('calcularCanjeMaximo respeta el saldo y el monto del pedido', async () => {
    const { servicio } = crearServicio({
      tablas: { clientes: { data: { puntos_actuales: 300 }, error: null } },
    });

    await expect(servicio.calcularCanjeMaximo('c-1', 10_000)).resolves.toEqual({
      puntos: 200,
      descuento: 10_000,
    });
  });

  it('registrarCanje con cero puntos no llama a la RPC', async () => {
    const { servicio, llamadasRpc } = crearServicio();

    await servicio.registrarCanje('c-1', 0, 'p-1');

    expect(llamadasRpc).toEqual([]);
  });

  it('registrarCanje resta los puntos y propaga el error si la RPC falla', async () => {
    const { servicio, llamadasRpc } = crearServicio();

    await servicio.registrarCanje('c-1', 40, 'p-1');

    expect(llamadasRpc[0]).toMatchObject({
      p_tipo: 'canjeado',
      p_puntos: -40,
      p_referencia_id: 'p-1',
      p_actualizar_actividad: false,
    });

    const fallida = crearServicio({
      rpc: [{ data: null, error: { message: 'saldo cambió' } }],
    });
    await expect(
      fallida.servicio.registrarCanje('c-1', 40, 'p-1'),
    ).rejects.toThrow();
  });
});

describe('PuntosService.otorgarPuntosPorCompraSeguro', () => {
  it('otorga 1 punto por cada $1.000 y lo deja en el pedido', async () => {
    const { servicio, llamadasRpc, escrituras } = crearServicio();

    const puntos = await servicio.otorgarPuntosPorCompraSeguro(
      'c-1',
      25_900,
      'p-1',
    );

    expect(puntos).toBe(25);
    expect(llamadasRpc[0]).toMatchObject({
      p_tipo: 'ganado',
      p_puntos: 25,
      p_actualizar_actividad: true,
    });
    expect(escrituras).toEqual([
      { tabla: 'pedidos', datos: { puntos_ganados: 25 } },
    ]);
  });

  it('una compra que no llega a $1.000 no otorga nada', async () => {
    const { servicio, llamadasRpc } = crearServicio();

    await expect(
      servicio.otorgarPuntosPorCompraSeguro('c-1', 900, 'p-1'),
    ).resolves.toBe(0);
    expect(llamadasRpc).toEqual([]);
  });

  it('si la RPC falla devuelve 0 en vez de romper el checkout', async () => {
    const { servicio, escrituras } = crearServicio({
      rpc: [{ data: null, error: { message: 'caída' } }],
    });

    await expect(
      servicio.otorgarPuntosPorCompraSeguro('c-1', 25_900, 'p-1'),
    ).resolves.toBe(0);
    expect(escrituras).toEqual([]);
  });
});

describe('PuntosService.marcarCanjePendiente', () => {
  it('marca el pedido y avisa por correo', async () => {
    const { servicio, escrituras, avisos } = crearServicio();

    await servicio.marcarCanjePendiente('p-1', 'saldo cambió');

    expect(escrituras).toEqual([
      { tabla: 'pedidos', datos: { puntos_status: 'pendiente' } },
    ]);
    expect(avisos).toEqual([{ pedidoId: 'p-1', motivoError: 'saldo cambió' }]);
  });

  it('aunque no se pueda marcar el pedido, igual avisa por correo', async () => {
    const { servicio, avisos } = crearServicio({
      tablas: { pedidos: { data: null, error: { message: 'tampoco' } } },
    });

    await servicio.marcarCanjePendiente('p-1', 'saldo cambió');

    expect(avisos).toHaveLength(1);
  });
});

describe('PuntosService.ajustarPuntos', () => {
  it('un ajuste en cero se rechaza sin llamar a la RPC', async () => {
    const { servicio, llamadasRpc } = crearServicio();

    await expect(
      servicio.ajustarPuntos('c-1', 0, 'conteo', 'u-1'),
    ).rejects.toThrow(BadRequestException);
    expect(llamadasRpc).toEqual([]);
  });

  it('redondea los puntos, recorta el motivo y devuelve el saldo resultante', async () => {
    const { servicio, llamadasRpc } = crearServicio({
      rpc: [{ data: 240, error: null }],
    });

    await expect(
      servicio.ajustarPuntos('c-1', 10.4, ' corrección ', 'u-1'),
    ).resolves.toBe(240);
    expect(llamadasRpc[0]).toMatchObject({
      p_tipo: 'ajuste',
      p_puntos: 10,
      p_motivo: 'corrección',
      p_created_by: 'u-1',
      p_referencia_tipo: 'ajuste_manual',
    });
  });

  it.each([
    ['cliente no existe', NotFoundException],
    ['saldo negativo', ConflictException],
  ])(
    'si la RPC dice "%s" responde con el error de negocio',
    async (mensaje, clase) => {
      const { servicio } = crearServicio({
        rpc: [{ data: null, error: { message: mensaje } }],
      });

      await expect(
        servicio.ajustarPuntos('c-1', -500, 'x', 'u-1'),
      ).rejects.toThrow(clase);
    },
  );
});

describe('PuntosService.vencerPuntosInactivos', () => {
  const CLIENTES: Resultado = {
    data: [
      { id: 'c-1', puntos_actuales: 120 },
      { id: 'c-2', puntos_actuales: 30 },
    ],
    error: null,
  };

  it('vence el saldo completo de cada cliente inactivo y cuenta los que salieron bien', async () => {
    const { servicio, llamadasRpc } = crearServicio({
      tablas: { clientes: CLIENTES },
      rpc: [SIN_ERROR, { data: null, error: { message: 'falló' } }],
    });

    await expect(servicio.vencerPuntosInactivos()).resolves.toBe(1);
    expect(llamadasRpc[0]).toMatchObject({
      p_cliente_id: 'c-1',
      p_tipo: 'vencido',
      p_puntos: -120,
      p_motivo: 'Vencimiento por 12 meses de inactividad',
    });
    expect(llamadasRpc).toHaveLength(2);
  });

  it('sin clientes inactivos no vence nada', async () => {
    const { servicio, llamadasRpc } = crearServicio({
      tablas: { clientes: { data: [], error: null } },
    });

    await expect(servicio.vencerPuntosInactivos()).resolves.toBe(0);
    expect(llamadasRpc).toEqual([]);
  });
});

describe('PuntosService.listarMovimientos', () => {
  it('devuelve los movimientos o una lista vacía', async () => {
    const movimiento = { id: 'm-1', tipo: 'ganado', puntos: 5 };
    const { servicio } = crearServicio({
      tablas: { movimientos_puntos: { data: [movimiento], error: null } },
    });
    const vacio = crearServicio();

    await expect(servicio.listarMovimientos('c-1')).resolves.toEqual([
      movimiento,
    ]);
    await expect(vacio.servicio.listarMovimientos('c-1')).resolves.toEqual([]);
  });
});
