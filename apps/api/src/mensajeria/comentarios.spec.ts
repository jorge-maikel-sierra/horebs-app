import { parsearComentarios, pideInformacion } from './comentarios';
import { ComentariosService } from './comentarios.service';

describe('pideInformacion', () => {
  it('detecta a quien pregunta precio, menú o quiere pedir', () => {
    expect(pideInformacion('¿Precio de la grande?')).toBe(true);
    expect(pideInformacion('Info porfa')).toBe(true);
    expect(pideInformacion('Cuánto vale?')).toBe(true);
    expect(pideInformacion('Quiero hacer un pedido')).toBe(true);
    expect(pideInformacion('Menú')).toBe(true);
  });

  it('no le escribe a un comentario cualquiera', () => {
    expect(pideInformacion('Qué rica 😍')).toBe(false);
    expect(pideInformacion('@amiga mira esto')).toBe(false);
  });
});

describe('parsearComentarios', () => {
  it('lee un comentario nuevo de la página de Facebook', () => {
    expect(
      parsearComentarios(
        [
          {
            id: 'page-1',
            changes: [
              {
                field: 'feed',
                value: {
                  item: 'comment',
                  verb: 'add',
                  comment_id: 'c-1',
                  message: 'precio?',
                  from: { id: 'u-1' },
                },
              },
            ],
          },
        ],
        'messenger',
      ),
    ).toEqual([{ canal: 'messenger', comentarioId: 'c-1', texto: 'precio?' }]);
  });

  it('ignora los comentarios de la propia página, ediciones y likes', () => {
    const cambio = (value: Record<string, unknown>) => [
      { id: 'page-1', changes: [{ field: 'feed', value }] },
    ];
    expect(
      parsearComentarios(
        cambio({
          item: 'comment',
          verb: 'add',
          comment_id: 'c-2',
          message: 'precio 25.000',
          from: { id: 'page-1' },
        }),
        'messenger',
      ),
    ).toEqual([]);
    expect(
      parsearComentarios(
        cambio({
          item: 'comment',
          verb: 'edited',
          comment_id: 'c-3',
          message: 'info',
        }),
        'messenger',
      ),
    ).toEqual([]);
    expect(
      parsearComentarios(
        cambio({ item: 'reaction', verb: 'add' }),
        'messenger',
      ),
    ).toEqual([]);
  });

  it('lee un comentario de Instagram y no el de la propia cuenta', () => {
    const entradas = [
      {
        id: 'ig-1',
        changes: [
          {
            field: 'comments',
            value: { id: 'c-9', text: 'info', from: { id: 'u-9' } },
          },
          {
            field: 'comments',
            value: { id: 'c-10', text: 'info', from: { id: 'ig-1' } },
          },
        ],
      },
    ];
    expect(parsearComentarios(entradas, 'instagram')).toEqual([
      { canal: 'instagram', comentarioId: 'c-9', texto: 'info' },
    ]);
  });
});

describe('ComentariosService.responder', () => {
  function crear(repetido = false) {
    const enviados: string[] = [];
    const servicio = new ComentariosService(
      { yaProcesado: () => Promise.resolve(repetido) } as never,
      {
        enviarRespuestaPrivada: (id: string) => {
          enviados.push(id);
          return Promise.resolve();
        },
      } as never,
    );
    return { servicio, enviados };
  }

  it('responde una sola vez por privado a quien pide información', async () => {
    const { servicio, enviados } = crear();
    await servicio.responder({
      canal: 'instagram',
      comentarioId: 'c-1',
      texto: 'precio?',
    });
    expect(enviados).toEqual(['c-1']);
  });

  it('no responde un comentario repetido ni uno que no pide nada', async () => {
    const repetido = crear(true);
    await repetido.servicio.responder({
      canal: 'messenger',
      comentarioId: 'c-1',
      texto: 'precio?',
    });
    const casual = crear();
    await casual.servicio.responder({
      canal: 'messenger',
      comentarioId: 'c-2',
      texto: 'qué rico',
    });
    expect([...repetido.enviados, ...casual.enviados]).toEqual([]);
  });
});
