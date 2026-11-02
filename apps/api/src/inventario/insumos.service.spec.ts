import { NotFoundException } from '@nestjs/common';
import type { MailService } from '../mail/mail.service';
import type { SupabaseService } from '../supabase/supabase.service';
import { InsumosService } from './insumos.service';
import type { FilaStockInsumo, InsumoDto } from './insumos.tipos';

interface Resultado {
  data: unknown;
  error: { message: string; code?: string } | null;
}

interface Operacion {
  op: string;
  datos?: unknown;
}

interface Consulta {
  select: () => Consulta;
  order: () => Consulta;
  insert: (datos: unknown) => Consulta;
  update: (datos: unknown) => Consulta;
  eq: () => Consulta;
  in: () => Consulta;
  returns: () => Consulta;
  single: () => Promise<Resultado>;
  then: (resolver: (v: Resultado) => unknown) => unknown;
}

const INSUMO = { id: 'i-1', nombre: 'Harina', stock_actual_g: 100 };
const OK: Resultado = { data: INSUMO, error: null };
const SIN_FILAS: Resultado = { data: [], error: null };

interface Respuestas {
  /** Resultado de leer/escribir con `single()` o de esperar la consulta. */
  resultado?: Resultado;
  rpc?: Resultado;
}

function crearServicio(respuestas: Respuestas = {}) {
  const operaciones: Operacion[] = [];
  const rpc = jest.fn().mockResolvedValue(respuestas.rpc ?? { error: null });
  const resultado = respuestas.resultado ?? OK;
  const crear = (): Consulta => {
    const b: Consulta = {
      select: () => b,
      order: () => b,
      insert: (datos) => {
        operaciones.push({ op: 'insert', datos });
        return b;
      },
      update: (datos) => {
        operaciones.push({ op: 'update', datos });
        return b;
      },
      eq: () => b,
      in: () => b,
      returns: () => b,
      single: () => Promise.resolve(resultado),
      then: (resolver) =>
        resolver(Array.isArray(resultado.data) ? resultado : SIN_FILAS),
    };
    return b;
  };
  const mail = { enviarAlertaStockBajo: jest.fn() };
  const servicio = new InsumosService(
    { getClient: () => ({ from: crear, rpc }) } as unknown as SupabaseService,
    mail as unknown as MailService,
  );
  return { servicio, operaciones, rpc, mail };
}

describe('InsumosService.listar', () => {
  const lista: Partial<InsumoDto>[] = [
    { id: 'a', stock_actual_g: 5, stock_minimo_g: 10 },
    { id: 'b', stock_actual_g: 50, stock_minimo_g: 10 },
  ];

  it('sin filtro devuelve todos', async () => {
    const { servicio } = crearServicio({
      resultado: { data: lista, error: null },
    });

    expect(await servicio.listar()).toHaveLength(2);
  });

  it('con stockBajo deja solo los que están en o bajo el mínimo', async () => {
    const { servicio } = crearServicio({
      resultado: { data: lista, error: null },
    });

    const insumos = await servicio.listar(true);

    expect(insumos.map((i) => i.id)).toEqual(['a']);
  });
});

describe('InsumosService.crear y editar', () => {
  it('crear valida antes de tocar la base', async () => {
    const { servicio, operaciones } = crearServicio();

    await expect(
      servicio.crear({ nombre: '', categoria: 'Secos' }),
    ).rejects.toThrow('Falta el nombre del insumo.');
    expect(operaciones).toEqual([]);
  });

  it('crear inserta la fila normalizada', async () => {
    const { servicio, operaciones } = crearServicio();

    await servicio.crear({ nombre: ' Harina ', categoria: 'Secos' });

    expect(operaciones[0]).toMatchObject({
      op: 'insert',
      datos: { nombre: 'Harina', unidad_medida: 'g' },
    });
  });

  it('editar solo actualiza lo que el cambio trae', async () => {
    const { servicio, operaciones } = crearServicio();

    await servicio.editar('i-1', { activo: false });

    expect(operaciones[0]).toEqual({ op: 'update', datos: { activo: false } });
  });

  it('editar un insumo que no existe es 404', async () => {
    const { servicio } = crearServicio({
      resultado: {
        data: null,
        error: { message: 'sin filas', code: 'PGRST116' },
      },
    });

    await expect(servicio.editar('i-9', { activo: true })).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('InsumosService.ajustarStock', () => {
  const merma = { tipo: 'merma', cantidad_g: 30, motivo: 'se cayó' } as const;

  it('una cantidad en cero se rechaza sin llamar a la RPC', async () => {
    const { servicio, rpc } = crearServicio();

    await expect(
      servicio.ajustarStock('i-1', { ...merma, cantidad_g: 0 }, 'u-1'),
    ).rejects.toThrow('La cantidad del ajuste no puede ser cero.');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('manda el movimiento firmado al ledger y devuelve el insumo', async () => {
    const { servicio, rpc } = crearServicio();

    const insumo = await servicio.ajustarStock('i-1', merma, 'u-1');

    expect(rpc).toHaveBeenCalledWith(
      'aplicar_movimientos_stock',
      expect.objectContaining({
        p_movimientos: [{ insumo_id: 'i-1', cantidad_g: -30 }],
        p_tipo: 'merma',
        p_created_by: 'u-1',
      }),
    );
    expect(insumo).toMatchObject({ id: 'i-1' });
  });

  it('si la RPC dice que el insumo no existe, es 404', async () => {
    const { servicio } = crearServicio({
      rpc: { data: null, error: { message: 'insumo no existe' } },
    });

    await expect(servicio.ajustarStock('i-9', merma, 'u-1')).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('InsumosService.verificarYAlertarStockBajo', () => {
  const bajo: FilaStockInsumo = {
    id: 'i-1',
    nombre: 'Harina',
    unidad_medida: 'g',
    stock_actual_g: 10,
    stock_minimo_g: 500,
    alerta_stock_enviada_en: null,
  };

  it('sin ids no consulta nada', async () => {
    const { servicio, operaciones } = crearServicio();

    await servicio.verificarYAlertarStockBajo([]);

    expect(operaciones).toEqual([]);
  });

  it('un insumo bajo el mínimo se marca y se avisa por correo', async () => {
    const { servicio, operaciones, mail } = crearServicio({
      resultado: { data: [bajo], error: null },
    });

    await servicio.verificarYAlertarStockBajo(['i-1']);

    expect(operaciones).toHaveLength(1);
    expect(operaciones[0].op).toBe('update');
    expect(operaciones[0].datos).toHaveProperty('alerta_stock_enviada_en');
    expect(mail.enviarAlertaStockBajo).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'i-1', stockActual: 10, stockMinimo: 500 }),
    ]);
  });

  it('un insumo recuperado apaga la marca y no manda correo', async () => {
    const recuperado = {
      ...bajo,
      stock_actual_g: 900,
      alerta_stock_enviada_en: '2026-10-29T10:00:00Z',
    };
    const { servicio, operaciones, mail } = crearServicio({
      resultado: { data: [recuperado], error: null },
    });

    await servicio.verificarYAlertarStockBajo(['i-1']);

    expect(operaciones).toEqual([
      { op: 'update', datos: { alerta_stock_enviada_en: null } },
    ]);
    expect(mail.enviarAlertaStockBajo).not.toHaveBeenCalled();
  });

  it('si la consulta falla no revienta ni avisa', async () => {
    const { servicio, mail } = crearServicio({
      resultado: { data: null, error: { message: 'caído' } },
    });

    await expect(
      servicio.verificarYAlertarStockBajo(['i-1']),
    ).resolves.toBeUndefined();
    expect(mail.enviarAlertaStockBajo).not.toHaveBeenCalled();
  });
});
