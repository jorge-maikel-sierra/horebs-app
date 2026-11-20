import type { SupabaseService } from '../supabase/supabase.service';
import type { AvisoEquipoService } from './aviso-equipo.service';
import {
  MINUTOS_SIN_RESPUESTA,
  MOTIVO_REAVISO,
  ventanaReaviso,
  type CandidataReaviso,
} from './reaviso-derivacion';
import { ReavisoDerivacionService } from './reaviso-derivacion.service';

// Jueves 19 nov 2026, 7:00 p.m. en Bogotá: el local está abierto.
const ABIERTO = new Date('2026-11-20T00:00:00.000Z');
// 2:00 a.m. en Bogotá: cerrado.
const CERRADO = new Date('2026-11-20T07:00:00.000Z');

const CANDIDATA: CandidataReaviso = {
  id: 'cv-1',
  canal: 'messenger',
  identificador_externo: 'psid-1',
  telefono: null,
  derivado_en: '2026-11-19T23:40:00.000Z',
};

describe('ventanaReaviso', () => {
  it('toma derivaciones de hace más de 10 minutos y menos de 6 horas', () => {
    expect(ventanaReaviso(ABIERTO)).toEqual({
      desde: '2026-11-19T18:00:00.000Z',
      hasta: '2026-11-19T23:50:00.000Z',
    });
    expect(MOTIVO_REAVISO).toContain(`${MINUTOS_SIN_RESPUESTA} minutos`);
  });
});

function crear(opciones: {
  candidatas?: CandidataReaviso[];
  respuestasHumanas?: number;
}) {
  const marcadas: string[] = [];
  const notificar = jest.fn();
  const cadena = (resultado: unknown) => {
    const q = {
      select: () => q,
      eq: () => q,
      is: () => q,
      gte: () => q,
      lte: () => q,
      returns: () => Promise.resolve(resultado),
      then: (r: (v: unknown) => unknown) => Promise.resolve(resultado).then(r),
    };
    return q;
  };
  const cliente = {
    from: (tabla: string) => {
      if (tabla === 'mensajes_conversacion') {
        return cadena({ count: opciones.respuestasHumanas ?? 0, error: null });
      }
      return Object.assign(
        cadena({ data: opciones.candidatas ?? [], error: null }),
        {
          update: () => ({
            eq: (_c: string, id: string) => {
              marcadas.push(id);
              return Promise.resolve({ error: null });
            },
          }),
        },
      );
    },
  };
  const servicio = new ReavisoDerivacionService(
    { getClient: () => cliente } as unknown as SupabaseService,
    { notificar } as unknown as AvisoEquipoService,
  );
  return { servicio, marcadas, notificar };
}

describe('ReavisoDerivacionService', () => {
  it('sin respuesta del equipo vuelve a avisar una vez, con el motivo', async () => {
    const { servicio, marcadas, notificar } = crear({
      candidatas: [CANDIDATA],
    });

    await servicio.ejecutar(ABIERTO);

    expect(marcadas).toEqual(['cv-1']);
    expect(notificar).toHaveBeenCalledWith(
      expect.objectContaining({
        conversacionId: 'cv-1',
        motivo: MOTIVO_REAVISO,
      }),
    );
  });

  it('si alguien del equipo ya escribió, solo se marca', async () => {
    const { servicio, marcadas, notificar } = crear({
      candidatas: [CANDIDATA],
      respuestasHumanas: 1,
    });

    await servicio.ejecutar(ABIERTO);

    expect(marcadas).toEqual(['cv-1']);
    expect(notificar).not.toHaveBeenCalled();
  });

  it('con el bot fuera de horario no hace nada', async () => {
    const { servicio, notificar } = crear({ candidatas: [CANDIDATA] });
    await servicio.ejecutar(CERRADO);
    expect(notificar).not.toHaveBeenCalled();
  });
});
