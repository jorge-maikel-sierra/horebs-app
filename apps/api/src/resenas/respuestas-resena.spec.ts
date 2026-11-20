import {
  armarRespuesta,
  clasificarResena,
  comentarioOriginal,
  estrellasDe,
  primerNombre,
} from './respuestas-resena';
import type { ResenaGoogle } from './resenas.tipos';

const AHORA = new Date('2026-11-20T15:00:00Z');

function resena(extra: Partial<ResenaGoogle> = {}): ResenaGoogle {
  return {
    name: 'accounts/1/locations/2/reviews/abc',
    reviewer: { displayName: 'maría josé pérez' },
    starRating: 'FIVE',
    createTime: '2026-11-20T12:00:00Z',
    ...extra,
  };
}

describe('respuestas-resena', () => {
  it('convierte la calificación de Google a número', () => {
    expect(estrellasDe('FOUR')).toBe(4);
    expect(estrellasDe('STAR_RATING_UNSPECIFIED')).toBeNull();
    expect(estrellasDe(undefined)).toBeNull();
  });

  it('usa solo el primer nombre y nada para anónimos o raros', () => {
    expect(primerNombre('maría josé pérez')).toBe('María');
    expect(primerNombre('Un usuario de Google')).toBeNull();
    expect(primerNombre('A Google User')).toBeNull();
    expect(primerNombre('🍕🍕')).toBeNull();
    expect(primerNombre(null)).toBeNull();
  });

  it('se queda con el texto original y quita la traducción de Google', () => {
    expect(
      comentarioOriginal('Muy rica\n\n(Translated by Google)\nVery tasty'),
    ).toBe('Muy rica');
    expect(
      comentarioOriginal(
        '(Translated by Google) Very tasty\n\n(Original)\nMuy rica',
      ),
    ).toBe('Muy rica');
    expect(comentarioOriginal('   ')).toBeNull();
    expect(comentarioOriginal(undefined)).toBeNull();
  });

  it('arma siempre la misma respuesta para la misma reseña', () => {
    const datos = {
      googleId: 'x/1',
      autor: 'Ana',
      estrellas: 5,
      comentario: null,
    };
    expect(armarRespuesta(datos)).toBe(armarRespuesta(datos));
    expect(armarRespuesta(datos)).toContain('Ana');
  });

  it('a una reseña mala le ofrece el WhatsApp del negocio', () => {
    const texto = armarRespuesta({
      googleId: 'x/2',
      autor: 'Luis Gómez',
      estrellas: 2,
      comentario: 'Llegó fría',
    });
    expect(texto).toContain('Hola, Luis');
    expect(texto).toContain('+57 315 786 1208');
  });

  it('4–5★ reciente se publica sola si está activado', () => {
    const c = clasificarResena(resena(), AHORA, true);
    expect(c).toMatchObject({ publicar: true, avisar: false });
    expect(c?.fila).toMatchObject({
      estado: 'pendiente',
      estrellas: 5,
      autor: 'maría josé pérez',
    });
    expect(c?.fila.respuesta).toContain('María');
  });

  it('con la publicación apagada, 5★ queda de borrador sin aviso', () => {
    expect(clasificarResena(resena(), AHORA, false)).toMatchObject({
      publicar: false,
      avisar: false,
    });
  });

  it('una reseña de más de 7 días no se publica sola', () => {
    const vieja = resena({ createTime: '2026-10-01T12:00:00Z' });
    expect(clasificarResena(vieja, AHORA, true)?.publicar).toBe(false);
  });

  it('1–3★ va a revisión del equipo y nunca se publica sola', () => {
    const c = clasificarResena(
      resena({ starRating: 'THREE', comment: 'Demoró' }),
      AHORA,
      true,
    );
    expect(c).toMatchObject({ publicar: false, avisar: true });
    expect(c?.fila).toMatchObject({
      estado: 'para_revisar',
      comentario: 'Demoró',
    });
  });

  it('una reseña que ya tiene respuesta en Google se guarda como respondida', () => {
    const c = clasificarResena(
      resena({
        reviewReply: {
          comment: 'Gracias!',
          updateTime: '2026-11-19T00:00:00Z',
        },
      }),
      AHORA,
      true,
    );
    expect(c).toMatchObject({ publicar: false, avisar: false });
    expect(c?.fila).toMatchObject({
      estado: 'respondida',
      respuesta: 'Gracias!',
    });
  });

  it('una reseña anónima no guarda autor', () => {
    const c = clasificarResena(
      resena({ reviewer: { displayName: 'Ana', isAnonymous: true } }),
      AHORA,
      true,
    );
    expect(c?.fila.autor).toBeNull();
  });

  it('ignora una reseña sin calificación', () => {
    expect(
      clasificarResena(resena({ starRating: undefined }), AHORA, true),
    ).toBeNull();
  });
});
