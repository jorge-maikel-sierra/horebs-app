import { fechaHaceDias, rendimientoPorOrigen } from './anuncios-reglas';

const conv = (
  anuncio: string | null,
  ref: string | null,
  titulo: string | null = null,
) => ({
  origen_fuente: anuncio ? 'ADS' : 'SHORTLINK',
  origen_anuncio_id: anuncio,
  origen_ref: ref,
  origen_titulo: titulo,
});
const pedido = (
  anuncio: string | null,
  ref: string | null,
  total: number,
  estado: string,
) => ({
  origen_fuente: anuncio ? 'ADS' : 'SHORTLINK',
  origen_anuncio_id: anuncio,
  origen_ref: ref,
  total,
  estado,
});

describe('rendimientoPorOrigen', () => {
  it('agrupa por anuncio y por ref, y ordena por ventas', () => {
    const filas = rendimientoPorOrigen(
      [
        conv('ad-1', null, 'Hawaiana 2x1'),
        conv('ad-1', null),
        conv(null, 'qr_caja'),
      ],
      [
        pedido('ad-1', null, 44000, 'entregado'),
        pedido('ad-1', null, 30000, 'cancelado'),
        pedido(null, 'qr_caja', 60000, 'pendiente'),
      ],
    );

    expect(filas.map((f) => f.clave)).toEqual(['ref:qr_caja', 'anuncio:ad-1']);
    expect(filas[1]).toEqual(
      expect.objectContaining({
        tipo: 'anuncio',
        titulo: 'Hawaiana 2x1',
        conversaciones: 2,
        pedidos: 2,
        entregados: 1,
        cancelados: 1,
        ventas: 44000,
      }),
    );
    expect(filas[0]).toEqual(
      expect.objectContaining({
        tipo: 'enlace',
        ventas: 60000,
        conversaciones: 1,
      }),
    );
  });

  it('sin datos devuelve una lista vacía', () => {
    expect(rendimientoPorOrigen([], [])).toEqual([]);
  });
});

describe('fechaHaceDias', () => {
  it('cuenta los días en hora de Bogotá', () => {
    // 2 a.m. UTC del 13 = 9 p.m. del 12 en Bogotá.
    expect(fechaHaceDias(0, new Date('2026-11-13T02:00:00Z'))).toBe(
      '2026-11-12',
    );
    expect(fechaHaceDias(30, new Date('2026-11-13T02:00:00Z'))).toBe(
      '2026-10-13',
    );
  });
});
