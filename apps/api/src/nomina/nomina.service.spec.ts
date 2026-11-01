import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseService } from '../supabase/supabase.service';
import type { EmpleadoDto, EmpleadosService } from './empleados.service';
import { NominaService } from './nomina.service';
import type { AdelantoDto, SemanaNominaDto, SemanaRaw } from './nomina.tipos';

const SEMANA: SemanaRaw = {
  id: 's-1',
  empleado_id: 'e-1',
  semana_inicio: '2026-10-26',
  semana_fin: '2026-11-01',
  monto_base: 700000,
  dias_esperados: 7,
  dias_trabajados: null,
  total_adelantos: null,
  neto_pagar: null,
  estado: 'en_curso',
  liquidada_en: null,
  notas: null,
};
const EMPLEADO = {
  id: 'e-1',
  monto_semanal: 700000,
  dias_esperados_semana: 7,
} as unknown as EmpleadoDto;
const ADELANTO: AdelantoDto = {
  id: 'a-1',
  empleado_id: 'e-1',
  nomina_semana_id: 's-1',
  monto: 20000,
  fecha: '2026-10-27',
  motivo: null,
};

interface Escritura {
  tabla: string;
  op: 'insert' | 'upsert' | 'delete';
  datos?: unknown;
}

interface RespuestaFalsa {
  /** Lo que devuelven las lecturas de una semana, en orden (null = no existe). */
  semanas: (SemanaRaw | null)[];
  /** Resultado del insert de una semana nueva. */
  semanaCreada?: { data: SemanaRaw | null; error: { code: string } | null };
  empleado?: EmpleadoDto | null;
  adelantoLeido?: { id: string; nomina_semana_id: string } | null;
}

interface Consulta {
  select: () => Consulta;
  eq: () => Consulta;
  order: () => Consulta;
  limit: () => Consulta;
  returns: () => Consulta;
  insert: (datos: unknown) => Consulta;
  upsert: (datos: unknown) => Promise<{ error: null }>;
  delete: () => Consulta;
  maybeSingle: () => Promise<{ data: unknown; error: null }>;
  single: () => Promise<{ data: unknown; error: unknown }>;
  then: (resolver: (v: { data: unknown[]; error: null }) => unknown) => unknown;
}

/** Un cliente de Supabase de mentira: responde según `r` y anota lo que se escribe. */
function crearCliente(r: RespuestaFalsa) {
  const escrituras: Escritura[] = [];
  const semanas = [...r.semanas];
  const from = (tabla: string): Consulta => {
    const b: Consulta = {
      select: () => b,
      eq: () => b,
      order: () => b,
      limit: () => b,
      returns: () => b,
      insert: (datos) => {
        escrituras.push({ tabla, op: 'insert', datos });
        return b;
      },
      upsert: (datos) => {
        escrituras.push({ tabla, op: 'upsert', datos });
        return Promise.resolve({ error: null });
      },
      delete: () => {
        escrituras.push({ tabla, op: 'delete' });
        return b;
      },
      maybeSingle: () => {
        if (tabla === 'nomina_semanas') {
          return Promise.resolve({
            data: semanas.shift() ?? null,
            error: null,
          });
        }
        const leida = tabla === 'empleados' ? r.empleado : r.adelantoLeido;
        return Promise.resolve({ data: leida ?? null, error: null });
      },
      single: () =>
        Promise.resolve(
          tabla === 'nomina_semanas' && r.semanaCreada
            ? r.semanaCreada
            : { data: ADELANTO, error: null },
        ),
      then: (resolver) => resolver({ data: [], error: null }),
    };
    return b;
  };
  return { cliente: { from }, escrituras };
}

function crearServicio(r: RespuestaFalsa) {
  const { cliente, escrituras } = crearCliente(r);
  const servicio = new NominaService(
    { getClient: () => cliente } as unknown as SupabaseService,
    {} as unknown as EmpleadosService,
  );
  return { servicio, escrituras };
}

describe('NominaService.marcarAsistencia', () => {
  const marca = {
    semanaId: 's-1',
    fecha: '2026-10-28',
    trabajo: true,
    motivo: '  turno completo ',
    usuarioId: 'u-1',
  };

  it('guarda el día con el motivo recortado y quién lo marcó', async () => {
    const { servicio, escrituras } = crearServicio({ semanas: [SEMANA] });

    await servicio.marcarAsistencia(marca);

    expect(escrituras).toEqual([
      {
        tabla: 'asistencia_nomina',
        op: 'upsert',
        datos: {
          nomina_semana_id: 's-1',
          fecha: '2026-10-28',
          trabajo: true,
          motivo: 'turno completo',
          registrado_por: 'u-1',
        },
      },
    ]);
  });

  it('una semana liquidada es un 409 y no escribe nada', async () => {
    const { servicio, escrituras } = crearServicio({
      semanas: [{ ...SEMANA, estado: 'liquidada' }],
    });

    await expect(servicio.marcarAsistencia(marca)).rejects.toThrow(
      ConflictException,
    );
    expect(escrituras).toEqual([]);
  });

  it('una fecha fuera de la semana es un 400', async () => {
    const { servicio, escrituras } = crearServicio({ semanas: [SEMANA] });

    await expect(
      servicio.marcarAsistencia({ ...marca, fecha: '2026-11-09' }),
    ).rejects.toThrow(BadRequestException);
    expect(escrituras).toEqual([]);
  });

  it('una semana que no existe es un 404', async () => {
    const { servicio } = crearServicio({ semanas: [null] });

    await expect(servicio.marcarAsistencia(marca)).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('NominaService.registrarAdelanto', () => {
  const adelanto = { empleado_id: 'e-1', monto: 20000, fecha: '2026-10-27' };

  it('un monto inválido se rechaza antes de tocar la base', async () => {
    const { servicio, escrituras } = crearServicio({ semanas: [] });

    await expect(
      servicio.registrarAdelanto({ ...adelanto, monto: 0 }, 'u-1'),
    ).rejects.toThrow(BadRequestException);
    expect(escrituras).toEqual([]);
  });

  it('un trabajador que no existe es un 404', async () => {
    const { servicio } = crearServicio({ semanas: [], empleado: null });

    await expect(servicio.registrarAdelanto(adelanto, 'u-1')).rejects.toThrow(
      'Trabajador no encontrado.',
    );
  });

  it('en una semana liquidada es un 409', async () => {
    const { servicio, escrituras } = crearServicio({
      semanas: [{ ...SEMANA, estado: 'liquidada' }],
      empleado: EMPLEADO,
    });

    await expect(servicio.registrarAdelanto(adelanto, 'u-1')).rejects.toThrow(
      ConflictException,
    );
    expect(escrituras).toEqual([]);
  });

  it('se guarda en la semana de la fecha del adelanto', async () => {
    const { servicio, escrituras } = crearServicio({
      semanas: [SEMANA],
      empleado: EMPLEADO,
    });

    const resultado = await servicio.registrarAdelanto(
      { ...adelanto, motivo: ' arriendo ' },
      'u-1',
    );

    expect(resultado).toBe(ADELANTO);
    expect(escrituras[0]).toMatchObject({
      tabla: 'adelantos_nomina',
      op: 'insert',
      datos: {
        nomina_semana_id: 's-1',
        monto: 20000,
        motivo: 'arriendo',
        registrado_por: 'u-1',
      },
    });
  });

  it('si otra request creó la semana al mismo tiempo, la relee en vez de fallar', async () => {
    const { servicio, escrituras } = crearServicio({
      semanas: [null, SEMANA],
      semanaCreada: { data: null, error: { code: '23505' } },
      empleado: EMPLEADO,
    });

    await servicio.registrarAdelanto(adelanto, 'u-1');

    expect(escrituras.map((e) => `${e.tabla}:${e.op}`)).toEqual([
      'nomina_semanas:insert',
      'adelantos_nomina:insert',
    ]);
  });
});

describe('NominaService.eliminarAdelanto', () => {
  it('un adelanto que no existe es un 404', async () => {
    const { servicio } = crearServicio({ semanas: [], adelantoLeido: null });

    await expect(servicio.eliminarAdelanto('a-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('de una semana liquidada es un 409 y no borra nada', async () => {
    const { servicio, escrituras } = crearServicio({
      semanas: [{ ...SEMANA, estado: 'liquidada' }],
      adelantoLeido: { id: 'a-1', nomina_semana_id: 's-1' },
    });

    await expect(servicio.eliminarAdelanto('a-1')).rejects.toThrow(
      ConflictException,
    );
    expect(escrituras).toEqual([]);
  });

  it('de una semana en curso lo borra', async () => {
    const { servicio, escrituras } = crearServicio({
      semanas: [SEMANA],
      adelantoLeido: { id: 'a-1', nomina_semana_id: 's-1' },
    });

    await servicio.eliminarAdelanto('a-1');

    expect(escrituras).toEqual([{ tabla: 'adelantos_nomina', op: 'delete' }]);
  });
});

describe('NominaService.asegurarLiquidada (PUT idempotente)', () => {
  const liquidada = { id: 's-1', estado: 'liquidada' } as SemanaNominaDto;

  function conLiquidacion() {
    const { servicio } = crearServicio({ semanas: [] });
    const liquidar = jest.spyOn(servicio, 'liquidar');
    const obtener = jest
      .spyOn(servicio, 'obtenerSemana')
      .mockResolvedValue(liquidada);
    return { servicio, liquidar, obtener };
  }

  it('liquida la primera vez', async () => {
    const { servicio, liquidar, obtener } = conLiquidacion();
    liquidar.mockResolvedValue(liquidada);

    await expect(servicio.asegurarLiquidada('s-1', 'u-1', 'ok')).resolves.toBe(
      liquidada,
    );
    expect(obtener).not.toHaveBeenCalled();
  });

  it('si ya estaba liquidada devuelve la existente, sin error', async () => {
    const { servicio, liquidar, obtener } = conLiquidacion();
    liquidar.mockRejectedValue(new ConflictException('ya'));

    await expect(
      servicio.asegurarLiquidada('s-1', 'u-1', undefined),
    ).resolves.toBe(liquidada);
    expect(obtener).toHaveBeenCalledWith('s-1');
  });

  it('otros errores se propagan', async () => {
    const { servicio, liquidar } = conLiquidacion();
    liquidar.mockRejectedValue(new NotFoundException('no existe'));

    await expect(
      servicio.asegurarLiquidada('s-1', 'u-1', undefined),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
