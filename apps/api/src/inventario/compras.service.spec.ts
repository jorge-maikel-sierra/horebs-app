import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { SupabaseService } from '../supabase/supabase.service';
import { ComprasService } from './compras.service';
import type { CrearCompraInput } from './compras.tipos';
import type { InsumosService } from './insumos.service';

interface Escritura {
  tabla: string;
  datos: unknown;
  filtros: [string, unknown][];
}

interface Consulta {
  select: () => Consulta;
  order: () => Consulta;
  limit: () => Consulta;
  returns: () => Consulta;
  eq: (columna: string, valor: unknown) => Consulta;
  update: (datos: unknown) => Consulta;
  single: () => Promise<{ data: unknown; error: null }>;
  then: (
    resolver: (v: { data: unknown; error: unknown; count: number }) => unknown,
  ) => unknown;
}

interface Respuesta {
  data: unknown;
  error: { message: string; code?: string } | null;
}

interface Configuracion {
  rpc?: Respuesta;
  filas?: unknown;
  actualizadas?: number;
}

/** Un cliente de Supabase de mentira: lee `filas`, anota las escrituras y las RPC. */
function crearServicio(config: Configuracion = {}) {
  const escrituras: Escritura[] = [];
  const llamadasRpc: { nombre: string; params: unknown }[] = [];
  const consultado: string[] = [];

  const from = (tabla: string): Consulta => {
    const b: Consulta = {
      select: () => b,
      order: () => b,
      limit: () => b,
      returns: () => b,
      eq: (columna, valor) => {
        const ultima = escrituras.at(-1);
        if (ultima) ultima.filtros.push([columna, valor]);
        else consultado.push(`${columna}=${String(valor)}`);
        return b;
      },
      update: (datos) => {
        escrituras.push({ tabla, datos, filtros: [] });
        return b;
      },
      single: () => Promise.resolve({ data: config.filas, error: null }),
      then: (resolver) =>
        resolver({
          data: config.filas,
          error: null,
          count: config.actualizadas ?? 1,
        }),
    };
    return b;
  };
  const rpc = (nombre: string, params: unknown): Promise<Respuesta> => {
    llamadasRpc.push({ nombre, params });
    return Promise.resolve(config.rpc ?? { data: null, error: null });
  };

  const verificar = jest.fn<Promise<void>, [string[]]>().mockResolvedValue();
  const servicio = new ComprasService(
    { getClient: () => ({ from, rpc }) } as unknown as SupabaseService,
    { verificarYAlertarStockBajo: verificar } as unknown as InsumosService,
  );
  return { servicio, escrituras, llamadasRpc, consultado, verificar };
}

const FILA_COMPRA = {
  id: 'c-1',
  numero_factura: null,
  proveedor: 'Distribuidora',
  fecha: '2026-10-30',
  subtotal: 13000,
  otros_cargos: 0,
  metodo_pago: 'efectivo',
  categoria: null,
  created_at: '2026-10-30T10:00:00Z',
  detalle_compra: [],
};

const COMPRA: CrearCompraInput = {
  proveedor: ' Distribuidora ',
  fecha: '2026-10-30',
  metodo_pago: 'efectivo',
  detalle: [
    {
      producto_comprado: 'Harina',
      cantidad: 2,
      unidad_medida_compra: 'kg',
      valor_unitario: 5000,
    },
    {
      producto_comprado: 'Queso',
      cantidad: 3,
      unidad_medida_compra: 'kg',
      valor_unitario: 1000,
    },
  ],
};

describe('ComprasService.crear', () => {
  it('una compra inválida se rechaza antes de llamar a la base', async () => {
    const { servicio, llamadasRpc } = crearServicio();

    await expect(
      servicio.crear({ ...COMPRA, detalle: [] }, 'u-1'),
    ).rejects.toThrow(BadRequestException);
    expect(llamadasRpc).toEqual([]);
  });

  it('manda a la RPC el subtotal recalculado y devuelve la compra creada', async () => {
    const { servicio, llamadasRpc, consultado } = crearServicio({
      rpc: { data: 'c-1', error: null },
      filas: FILA_COMPRA,
    });

    const creada = await servicio.crear(COMPRA, 'u-1');

    expect(llamadasRpc).toHaveLength(1);
    expect(llamadasRpc[0].nombre).toBe('crear_compra_con_detalle');
    expect(llamadasRpc[0].params).toMatchObject({
      p_subtotal: 13000,
      p_proveedor: 'Distribuidora',
      p_registrado_por: 'u-1',
    });
    expect(consultado).toEqual(['id=c-1']);
    expect(creada.id).toBe('c-1');
  });

  it('un error de la RPC sale como excepción de Nest, no crudo', async () => {
    const { servicio } = crearServicio({
      rpc: { data: null, error: { message: 'boom' } },
    });

    await expect(servicio.crear(COMPRA, 'u-1')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});

describe('ComprasService.procesarLinea', () => {
  it('procesa la línea y verifica el stock bajo del insumo afectado', async () => {
    const { servicio, llamadasRpc, verificar } = crearServicio({
      rpc: { data: { id: 'i-1' }, error: null },
    });

    await servicio.procesarLinea('d-1', 'u-1');

    expect(llamadasRpc[0]).toEqual({
      nombre: 'procesar_detalle_compra',
      params: { p_detalle_id: 'd-1', p_procesado_por: 'u-1' },
    });
    expect(verificar).toHaveBeenCalledWith(['i-1']);
  });

  it('una falla al verificar el stock no rompe la respuesta', async () => {
    const { servicio, verificar } = crearServicio({
      rpc: { data: { id: 'i-1' }, error: null },
    });
    verificar.mockRejectedValue(new Error('sin correo'));

    await expect(servicio.procesarLinea('d-1', 'u-1')).resolves.toBeUndefined();
  });

  it.each([
    ['no existe', 'Detalle no existe', NotFoundException],
    [
      'ya no está pendiente (409)',
      'La línea no está pendiente',
      ConflictException,
    ],
    [
      'sin insumo asignado (400)',
      'La línea no tiene insumo asignado',
      BadRequestException,
    ],
    ['otro error', 'duplicate key', ServiceUnavailableException],
  ])('%s', async (_caso, mensaje, excepcion) => {
    const { servicio, verificar } = crearServicio({
      rpc: { data: null, error: { message: mensaje } },
    });

    await expect(servicio.procesarLinea('d-1', 'u-1')).rejects.toThrow(
      excepcion,
    );
    expect(verificar).not.toHaveBeenCalled();
  });

  it('un mensaje de negocio se muestra tal cual al cliente', async () => {
    const { servicio } = crearServicio({
      rpc: { data: null, error: { message: 'La línea no está pendiente' } },
    });

    await expect(servicio.procesarLinea('d-1', 'u-1')).rejects.toThrow(
      'La línea no está pendiente',
    );
  });
});

describe('ComprasService.excluirLinea y vincularInsumo', () => {
  it('excluir solo toca una línea pendiente', async () => {
    const { servicio, escrituras } = crearServicio();

    await servicio.excluirLinea('d-1');

    expect(escrituras).toEqual([
      {
        tabla: 'detalle_compra',
        datos: { estado_procesado: 'excluido' },
        filtros: [
          ['id', 'd-1'],
          ['estado_procesado', 'pendiente'],
        ],
      },
    ]);
  });

  it('vincular guarda el insumo en la línea pendiente', async () => {
    const { servicio, escrituras } = crearServicio();

    await servicio.vincularInsumo('d-1', 'i-1');

    expect(escrituras[0]).toMatchObject({
      tabla: 'detalle_compra',
      datos: { insumo_id: 'i-1' },
    });
  });

  it.each([
    ['excluir', (s: ComprasService) => s.excluirLinea('d-9')],
    ['vincular', (s: ComprasService) => s.vincularInsumo('d-9', 'i-1')],
  ])(
    '%s una línea que no existe o ya no está pendiente es 404',
    async (_a, accion) => {
      const { servicio } = crearServicio({ actualizadas: 0 });

      await expect(accion(servicio)).rejects.toThrow(NotFoundException);
    },
  );
});

describe('ComprasService.actualizarLinea', () => {
  function servicioConEspias() {
    const { servicio } = crearServicio();
    return {
      svc: servicio,
      vincular: jest.spyOn(servicio, 'vincularInsumo').mockResolvedValue(),
      procesar: jest.spyOn(servicio, 'procesarLinea').mockResolvedValue(),
      excluir: jest.spyOn(servicio, 'excluirLinea').mockResolvedValue(),
    };
  }

  it('sin insumo ni estado es 400', async () => {
    const { svc } = servicioConEspias();
    await expect(svc.actualizarLinea('d1', {}, 'u1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('vincular y procesar: primero vincula, después procesa', async () => {
    const { svc, vincular, procesar } = servicioConEspias();
    const orden: string[] = [];
    vincular.mockImplementation(() => {
      orden.push('vincular');
      return Promise.resolve();
    });
    procesar.mockImplementation(() => {
      orden.push('procesar');
      return Promise.resolve();
    });
    await svc.actualizarLinea(
      'd1',
      { insumo_id: 'i1', estado: 'procesado' },
      'u1',
    );
    expect(orden).toEqual(['vincular', 'procesar']);
    expect(procesar).toHaveBeenCalledWith('d1', 'u1');
  });

  it('solo estado excluido excluye y no vincula', async () => {
    const { svc, vincular, excluir } = servicioConEspias();
    await svc.actualizarLinea('d1', { estado: 'excluido' }, 'u1');
    expect(excluir).toHaveBeenCalledWith('d1');
    expect(vincular).not.toHaveBeenCalled();
  });
});

describe('ComprasService.listar', () => {
  it('mapea las compras con su detalle', async () => {
    const { servicio } = crearServicio({ filas: [FILA_COMPRA] });

    const compras = await servicio.listar();

    expect(compras).toHaveLength(1);
    expect(compras[0]).toMatchObject({ id: 'c-1', detalle: [] });
  });
});
