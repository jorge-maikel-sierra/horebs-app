import { BadRequestException, ConflictException } from '@nestjs/common';
import type { AdelantoDto, AsistenciaDiaDto, SemanaRaw } from './nomina.tipos';
import {
  exigirSemanaEnCurso,
  montosDeSemana,
  validarAdelanto,
  validarFechaEnSemana,
} from './reglas-semana';

function semana(cambios: Partial<SemanaRaw> = {}): SemanaRaw {
  return {
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
    ...cambios,
  };
}

function dia(trabajo: boolean): AsistenciaDiaDto {
  return { fecha: '2026-10-26', trabajo, motivo: null };
}

function adelanto(monto: number): AdelantoDto {
  return {
    id: `a-${monto}`,
    empleado_id: 'e-1',
    nomina_semana_id: 's-1',
    monto,
    fecha: '2026-10-27',
    motivo: null,
  };
}

describe('montosDeSemana', () => {
  it('en curso calcula con la asistencia y los adelantos de hoy', () => {
    const montos = montosDeSemana(
      semana(),
      [dia(true), dia(true), dia(true), dia(false)],
      [adelanto(50000)],
    );

    expect(montos).toEqual({
      dias_trabajados: 3,
      total_adelantos: 50000,
      neto_pagar: 250000,
      saldo_pendiente: 0,
    });
  });

  it('en curso el neto nunca baja de cero y lo que sobra queda como saldo pendiente', () => {
    const montos = montosDeSemana(
      semana(),
      [dia(true)],
      [adelanto(100000), adelanto(70000)],
    );

    expect(montos.neto_pagar).toBe(0);
    expect(montos.saldo_pendiente).toBe(70000);
  });

  it('liquidada manda lo guardado al liquidar, no la asistencia de hoy', () => {
    const montos = montosDeSemana(
      semana({
        estado: 'liquidada',
        dias_trabajados: 5,
        total_adelantos: 100000,
        neto_pagar: 500000,
      }),
      [],
      [],
    );

    expect(montos).toEqual({
      dias_trabajados: 5,
      total_adelantos: 100000,
      neto_pagar: 500000,
      saldo_pendiente: 0,
    });
  });

  it('liquidada con valores nulos los toma como cero', () => {
    const montos = montosDeSemana(semana({ estado: 'liquidada' }), [], []);

    expect(montos).toEqual({
      dias_trabajados: 0,
      total_adelantos: 0,
      neto_pagar: 0,
      saldo_pendiente: 0,
    });
  });
});

describe('exigirSemanaEnCurso', () => {
  it('deja pasar una semana en curso', () => {
    expect(() =>
      exigirSemanaEnCurso({ estado: 'en_curso' }, 'editar'),
    ).not.toThrow();
  });

  it('una semana liquidada es un 409 que dice qué no se puede hacer', () => {
    const intento = () =>
      exigirSemanaEnCurso({ estado: 'liquidada' }, 'registrar un adelanto');

    expect(intento).toThrow(ConflictException);
    expect(intento).toThrow(
      'Esa semana ya está liquidada, no se puede registrar un adelanto.',
    );
  });
});

describe('validarFechaEnSemana', () => {
  it.each(['2026-10-26', '2026-10-30', '2026-11-01'])(
    'acepta %s, dentro de la semana',
    (fecha) => {
      expect(() => validarFechaEnSemana(semana(), fecha)).not.toThrow();
    },
  );

  it.each(['2026-10-25', '2026-11-02'])(
    'rechaza %s, fuera de la semana',
    (fecha) => {
      expect(() => validarFechaEnSemana(semana(), fecha)).toThrow(
        BadRequestException,
      );
    },
  );
});

describe('validarAdelanto', () => {
  const base = { empleado_id: 'e-1', monto: 20000, fecha: '2026-10-27' };

  it('acepta un adelanto con monto positivo y fecha', () => {
    expect(() => validarAdelanto(base)).not.toThrow();
  });

  it.each([0, -5000])('rechaza el monto %s', (monto) => {
    expect(() => validarAdelanto({ ...base, monto })).toThrow(
      'El monto del adelanto debe ser mayor a cero.',
    );
  });

  it('rechaza un adelanto sin fecha', () => {
    expect(() => validarAdelanto({ ...base, fecha: '' })).toThrow(
      'Falta la fecha del adelanto.',
    );
  });
});
