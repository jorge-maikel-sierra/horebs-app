import { BadRequestException } from '@nestjs/common';
import {
  aFechaLocal,
  claveBucket,
  contarDias,
  resolverGranularidad,
  resolverRango,
  serializarSerie,
  serializarSerieClientes,
} from './informes-fechas';

describe('serializarSerie / serializarSerieClientes', () => {
  it('por día incluye los días sin ventas, con ceros', () => {
    const porBucket = new Map([['2026-10-26', { total: 90000, pedidos: 3 }]]);
    expect(
      serializarSerie(porBucket, '2026-10-25', '2026-10-27', 'dia'),
    ).toEqual([
      { fecha: '2026-10-25', total: 0, pedidos: 0 },
      { fecha: '2026-10-26', total: 90000, pedidos: 3 },
      { fecha: '2026-10-27', total: 0, pedidos: 0 },
    ]);
  });

  it('por mes cruza el cambio de año sin saltarse meses', () => {
    const meses = serializarSerie(
      new Map(),
      '2026-11-15',
      '2027-01-03',
      'mes',
    ).map((m) => m.fecha);
    expect(meses).toEqual(['2026-11', '2026-12', '2027-01']);
  });

  it('la serie de clientes nuevos usa el mismo recorrido', () => {
    const porBucket = new Map([['2026-10-27', 4]]);
    expect(
      serializarSerieClientes(porBucket, '2026-10-26', '2026-10-27', 'dia'),
    ).toEqual([
      { fecha: '2026-10-26', nuevos: 0 },
      { fecha: '2026-10-27', nuevos: 4 },
    ]);
  });
});

describe('zona horaria de Bogotá', () => {
  it('una venta a las 9 p.m. de Bogotá cuenta para ese día, no para el siguiente', () => {
    // 21:00 en Bogotá = 02:00 UTC del día siguiente.
    const ventaNocturna = '2026-10-28T02:00:00Z';
    expect(aFechaLocal(ventaNocturna).slice(0, 10)).toBe('2026-10-27');
    expect(claveBucket(ventaNocturna, 'dia')).toBe('2026-10-27');
    expect(claveBucket(ventaNocturna, 'mes')).toBe('2026-10');
  });
});

describe('resolverGranularidad y contarDias', () => {
  it('cuenta ambos extremos', () => {
    expect(contarDias('2026-10-25', '2026-10-25')).toBe(1);
    expect(contarDias('2026-10-22', '2026-10-28')).toBe(7);
  });

  it('hasta 62 días va por día; más, por mes', () => {
    expect(resolverGranularidad('2026-09-01', '2026-10-31')).toBe('dia');
    expect(resolverGranularidad('2026-01-01', '2026-10-31')).toBe('mes');
  });
});

describe('resolverRango', () => {
  it('devuelve los límites del día en hora de Bogotá', () => {
    expect(resolverRango('2026-10-25', '2026-10-27')).toEqual({
      desde: '2026-10-25',
      hasta: '2026-10-27',
      desdeISO: '2026-10-25T00:00:00.000-05:00',
      hastaISO: '2026-10-27T23:59:59.999-05:00',
    });
  });

  it('sin "desde" toma los 7 días que terminan en "hasta"', () => {
    expect(resolverRango(undefined, '2026-10-28').desde).toBe('2026-10-22');
  });

  it('un "desde" posterior a "hasta" es 400', () => {
    expect(() => resolverRango('2026-10-28', '2026-10-27')).toThrow(
      BadRequestException,
    );
  });
});
