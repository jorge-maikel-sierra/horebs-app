import { BlogService } from './blog.service';

type Fila = { post_id: string; usuario_id: string };

/** Supabase falso mínimo: una tabla de likes en memoria. */
function servicio(likes: Fila[]) {
  const svc = Object.create(BlogService.prototype) as BlogService;
  jest
    .spyOn(svc as never, 'obtenerIdPostPublicado')
    .mockResolvedValue('p1' as never);
  jest
    .spyOn(svc, 'obtenerTotalMeGusta')
    .mockImplementation(() => Promise.resolve({ total: likes.length }));
  const supabase = {
    getClient: () => ({
      from: () => ({
        insert: (fila: Fila) => {
          likes.push(fila);
          return Promise.resolve({ error: null });
        },
        delete: () => ({
          eq: () => ({
            eq: (_: string, usuario: string) => {
              const resto = likes.filter((l) => l.usuario_id !== usuario);
              likes.splice(0, likes.length, ...resto);
              return Promise.resolve({ error: null });
            },
          }),
        }),
      }),
    }),
  };
  Object.assign(svc, { supabase });
  return svc;
}

describe('likes idempotentes', () => {
  it('darMeGusta dos veces deja un solo like', async () => {
    const likes: Fila[] = [];
    const svc = servicio(likes);
    jest
      .spyOn(svc, 'obtenerMeGusta')
      .mockImplementation(() =>
        Promise.resolve({ meGusta: likes.some((l) => l.usuario_id === 'u1') }),
      );
    await svc.darMeGusta('slug', 'u1');
    const segunda = await svc.darMeGusta('slug', 'u1');
    expect(likes).toHaveLength(1);
    expect(segunda).toEqual({ total: 1, meGusta: true });
  });

  it('quitarMeGusta sin like previo no falla y deja total 0', async () => {
    const svc = servicio([]);
    await expect(svc.quitarMeGusta('slug', 'u1')).resolves.toEqual({
      total: 0,
      meGusta: false,
    });
  });
});
