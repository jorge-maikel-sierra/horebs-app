import { BadRequestException, ConflictException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { AvisoEquipoService } from '../mensajeria/aviso-equipo.service';
import type { SupabaseService } from '../supabase/supabase.service';
import type { GoogleBusinessService } from './google-business.service';
import { ResenasService } from './resenas.service';
import type { ResenaDto, ResenaGoogle } from './resenas.tipos';

const AHORA = new Date('2026-11-20T15:00:00Z');

function google(name: string, starRating: string): ResenaGoogle {
  return {
    name,
    starRating,
    createTime: '2026-11-20T14:00:00Z',
    reviewer: { displayName: 'Ana' },
  };
}

const FILA: ResenaDto = {
  id: 'f1',
  google_id: 'accounts/1/locations/2/reviews/r1',
  autor: 'Ana',
  estrellas: 2,
  comentario: 'fría',
  creada_en: '2026-11-20T14:00:00Z',
  estado: 'para_revisar',
  respuesta: 'Hola, Ana…',
  respondida_en: null,
  error: null,
};

function crear(opciones: {
  conocidas?: string[];
  fila?: ResenaDto;
  auto?: boolean;
  resenas?: ResenaGoogle[];
}) {
  const insertadas: Record<string, unknown>[] = [];
  const actualizaciones: Record<string, unknown>[] = [];
  let siguienteId = 0;
  const cadena = (resultado: unknown) => {
    const q = {
      select: () => q,
      eq: () => q,
      in: () => q,
      order: () => q,
      limit: () => q,
      returns: () => Promise.resolve(resultado),
      maybeSingle: () => Promise.resolve(resultado),
      single: () => Promise.resolve(resultado),
    };
    return q;
  };
  const cliente = {
    from: () => ({
      select: () =>
        cadena({
          data:
            opciones.fila ??
            (opciones.conocidas ?? []).map((google_id) => ({ google_id })),
          error: null,
        }),
      upsert: (fila: Record<string, unknown>) => {
        insertadas.push(fila);
        siguienteId += 1;
        return cadena({ data: [{ id: `n${siguienteId}` }], error: null });
      },
      update: (cambios: Record<string, unknown>) => {
        actualizaciones.push(cambios);
        return cadena({ data: { ...FILA, ...cambios }, error: null });
      },
    }),
  };
  const googleApi = {
    configurado: true,
    listarResenas: jest.fn().mockResolvedValue(opciones.resenas ?? []),
    responder: jest.fn().mockResolvedValue(undefined),
  };
  const aviso = { notificarTexto: jest.fn() };
  const servicio = new ResenasService(
    { getClient: () => cliente } as unknown as SupabaseService,
    googleApi as unknown as GoogleBusinessService,
    aviso as unknown as AvisoEquipoService,
    {
      get: () => (opciones.auto === false ? undefined : 'true'),
    } as unknown as ConfigService,
  );
  return { servicio, googleApi, aviso, insertadas, actualizaciones };
}

describe('ResenasService', () => {
  it('publica sola la de 5★ y manda a revisión la de 2★', async () => {
    const t = crear({
      resenas: [google('r/5', 'FIVE'), google('r/2', 'TWO')],
    });
    await t.servicio.sincronizar(AHORA);
    expect(t.insertadas).toHaveLength(2);
    expect(t.googleApi.responder).toHaveBeenCalledTimes(1);
    expect(t.googleApi.responder).toHaveBeenCalledWith(
      'r/5',
      expect.stringContaining('Ana'),
    );
    expect(t.aviso.notificarTexto).toHaveBeenCalledTimes(1);
    expect(t.actualizaciones[0]).toMatchObject({ estado: 'respondida' });
  });

  it('no vuelve a procesar una reseña que ya conoce', async () => {
    const t = crear({ resenas: [google('r/5', 'FIVE')], conocidas: ['r/5'] });
    await t.servicio.sincronizar(AHORA);
    expect(t.insertadas).toHaveLength(0);
    expect(t.googleApi.responder).not.toHaveBeenCalled();
  });

  it('con la publicación apagada solo guarda el borrador', async () => {
    const t = crear({ resenas: [google('r/5', 'FIVE')], auto: false });
    await t.servicio.sincronizar(AHORA);
    expect(t.insertadas).toHaveLength(1);
    expect(t.googleApi.responder).not.toHaveBeenCalled();
  });

  it('si Google falla al publicar, la marca con error', async () => {
    const t = crear({ resenas: [google('r/5', 'FIVE')] });
    t.googleApi.responder.mockRejectedValueOnce(new Error('403'));
    await t.servicio.sincronizar(AHORA);
    expect(t.actualizaciones[0]).toMatchObject({
      estado: 'error',
      error: '403',
    });
  });

  it('el equipo publica la respuesta editada', async () => {
    const t = crear({ fila: FILA });
    const r = await t.servicio.actualizar('f1', {
      estado: 'respondida',
      respuesta: ' Lo sentimos ',
    });
    expect(t.googleApi.responder).toHaveBeenCalledWith(
      FILA.google_id,
      'Lo sentimos',
    );
    expect(r.estado).toBe('respondida');
  });

  it('publicar sin texto es 400', async () => {
    const t = crear({ fila: FILA });
    await expect(
      t.servicio.actualizar('f1', { estado: 'respondida', respuesta: '  ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('no se descarta una reseña ya respondida', async () => {
    const t = crear({ fila: { ...FILA, estado: 'respondida' } });
    await expect(
      t.servicio.actualizar('f1', { estado: 'descartada' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
