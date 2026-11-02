import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { UsuarioSupabase } from '../auth/supabase-auth.guard';
import type { SupabaseService } from '../supabase/supabase.service';
import { BlogService } from './blog.service';

interface Resultado {
  data?: unknown;
  count?: number | null;
  error: { message: string; code?: string } | null;
}

interface Llamada {
  tabla: string;
  metodo: string;
  args: unknown[];
}

interface Consulta {
  select: (...args: unknown[]) => Consulta;
  eq: (...args: unknown[]) => Consulta;
  order: (...args: unknown[]) => Consulta;
  insert: (...args: unknown[]) => Consulta;
  update: (...args: unknown[]) => Consulta;
  delete: (...args: unknown[]) => Consulta;
  returns: () => Consulta;
  single: () => Promise<Resultado>;
  maybeSingle: () => Promise<Resultado>;
  then: (resolver: (v: Resultado) => unknown) => unknown;
}

const POST_ID: Resultado = { data: { id: 'p-1' }, error: null };

/**
 * Cada tabla trae una lista de resultados que se consume en orden; el último
 * se repite, para que una consulta repetida vea lo mismo.
 */
function crearServicio(porTabla: Record<string, Resultado[]> = {}) {
  const llamadas: Llamada[] = [];
  const colas = new Map(
    Object.entries({ blog_posts: [POST_ID], ...porTabla }).map(([t, rs]) => [
      t,
      [...rs],
    ]),
  );
  const siguiente = (tabla: string): Resultado => {
    const cola = colas.get(tabla) ?? [];
    return (
      (cola.length > 1 ? cola.shift() : cola[0]) ?? {
        data: null,
        error: null,
      }
    );
  };
  const from = (tabla: string): Consulta => {
    const resultado = siguiente(tabla);
    const registrar =
      (metodo: string) =>
      (...args: unknown[]): Consulta => {
        llamadas.push({ tabla, metodo, args });
        return b;
      };
    const b: Consulta = {
      select: registrar('select'),
      eq: registrar('eq'),
      order: registrar('order'),
      insert: registrar('insert'),
      update: registrar('update'),
      delete: registrar('delete'),
      returns: () => b,
      single: () => Promise.resolve(resultado),
      maybeSingle: () => Promise.resolve(resultado),
      then: (resolver) => resolver(resultado),
    };
    return b;
  };
  const servicio = new BlogService({
    getClient: () => ({ from }),
  } as unknown as SupabaseService);
  const escrituras = () =>
    llamadas.filter((l) => ['insert', 'update', 'delete'].includes(l.metodo));
  return { servicio, llamadas, escrituras };
}

const USUARIO: UsuarioSupabase = {
  id: 'u-1',
  nombre: 'Ana',
  apellido: 'Pérez',
  email: 'ana@correo.co',
};

describe('BlogService: lectura pública', () => {
  it('un artículo que no existe como publicado devuelve null', async () => {
    const { servicio } = crearServicio({
      blog_posts: [{ data: null, error: null }],
    });

    await expect(servicio.obtenerPostPublicadoPorSlug('x')).resolves.toBeNull();
  });

  it('los comentarios de un slug inexistente son 404', async () => {
    const { servicio } = crearServicio({
      blog_posts: [{ data: null, error: null }],
    });

    await expect(servicio.obtenerComentarios('x')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('un error de base se traduce con errorDeBase', async () => {
    const { servicio } = crearServicio({
      blog_posts: [{ data: null, error: { message: 'caído' } }],
    });

    await expect(servicio.obtenerPostsPublicados()).rejects.toThrow();
  });
});

describe('BlogService: comentarios', () => {
  it('un comentario vacío se rechaza antes de tocar la base', async () => {
    const { servicio, llamadas } = crearServicio();

    await expect(
      servicio.crearComentario('slug', USUARIO, { contenido: '  ' }),
    ).rejects.toThrow(BadRequestException);
    expect(llamadas).toEqual([]);
  });

  it('crea el comentario con el autor y el post publicado', async () => {
    const { servicio, escrituras } = crearServicio({
      comentarios_blog: [{ data: { id: 'c-1' }, error: null }],
    });

    await servicio.crearComentario('slug', USUARIO, { contenido: ' Rica ' });

    expect(escrituras()[0]).toEqual({
      tabla: 'comentarios_blog',
      metodo: 'insert',
      args: [
        {
          post_id: 'p-1',
          usuario_id: 'u-1',
          autor_nombre: 'Ana Pérez',
          contenido: 'Rica',
        },
      ],
    });
  });

  it('el autor puede borrar su comentario', async () => {
    const { servicio, escrituras } = crearServicio({
      comentarios_blog: [
        { data: { id: 'c-1', usuario_id: 'u-1' }, error: null },
      ],
    });

    await servicio.eliminarComentario('c-1', 'u-1');

    expect(escrituras()).toHaveLength(1);
  });

  it('un admin puede borrar el comentario de otra persona', async () => {
    const { servicio, escrituras } = crearServicio({
      comentarios_blog: [
        { data: { id: 'c-1', usuario_id: 'u-9' }, error: null },
      ],
      perfiles_staff: [{ data: { rol: 'admin' }, error: null }],
    });

    await servicio.eliminarComentario('c-1', 'u-1');

    expect(escrituras()).toHaveLength(1);
  });

  it('cualquier otra persona no puede borrar un comentario ajeno', async () => {
    const { servicio, escrituras } = crearServicio({
      comentarios_blog: [
        { data: { id: 'c-1', usuario_id: 'u-9' }, error: null },
      ],
      perfiles_staff: [{ data: null, error: null }],
    });

    await expect(servicio.eliminarComentario('c-1', 'u-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(escrituras()).toEqual([]);
  });

  it('un comentario que no existe es 404', async () => {
    const { servicio } = crearServicio({
      comentarios_blog: [{ data: null, error: null }],
    });

    await expect(servicio.eliminarComentario('c-9', 'u-1')).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('BlogService: likes idempotentes', () => {
  it('darMeGusta sin like previo lo inserta y devuelve el total', async () => {
    const { servicio, escrituras } = crearServicio({
      likes_blog_post: [
        { data: null, error: null },
        { count: 1, error: null },
      ],
    });

    await expect(servicio.darMeGusta('slug', 'u-1')).resolves.toEqual({
      total: 1,
      meGusta: true,
    });
    expect(escrituras()).toEqual([
      {
        tabla: 'likes_blog_post',
        metodo: 'insert',
        args: [{ post_id: 'p-1', usuario_id: 'u-1' }],
      },
    ]);
  });

  it('darMeGusta con like previo no inserta nada', async () => {
    const { servicio, escrituras } = crearServicio({
      likes_blog_post: [
        { data: { id: 'l-1' }, error: null },
        { count: 1, error: null },
      ],
    });

    await expect(servicio.darMeGusta('slug', 'u-1')).resolves.toEqual({
      total: 1,
      meGusta: true,
    });
    expect(escrituras()).toEqual([]);
  });

  it('si otro request ganó la carrera (23505) igual queda con like', async () => {
    const { servicio } = crearServicio({
      likes_blog_post: [
        { data: null, error: null },
        { data: null, error: { message: 'duplicate', code: '23505' } },
        { count: 1, error: null },
      ],
    });

    await expect(servicio.darMeGusta('slug', 'u-1')).resolves.toEqual({
      total: 1,
      meGusta: true,
    });
  });

  it('quitarMeGusta sin like previo no falla y deja el total en cero', async () => {
    const { servicio } = crearServicio({
      likes_blog_post: [
        { data: null, error: null },
        { count: 0, error: null },
      ],
    });

    await expect(servicio.quitarMeGusta('slug', 'u-1')).resolves.toEqual({
      total: 0,
      meGusta: false,
    });
  });

  it('obtenerMeGusta dice si el usuario ya dio like', async () => {
    const { servicio } = crearServicio({
      likes_blog_post: [{ data: { id: 'l-1' }, error: null }],
    });

    await expect(servicio.obtenerMeGusta('slug', 'u-1')).resolves.toEqual({
      meGusta: true,
    });
  });
});

describe('BlogService: administración de artículos', () => {
  const POST = {
    titulo: 'Pizza',
    slug: 'pizza',
    resumen: 'Resumen',
    contenido: 'Texto',
  };

  it('un artículo sin título se rechaza antes de tocar la base', async () => {
    const { servicio, llamadas } = crearServicio();

    await expect(
      servicio.crearBlogPost({ ...POST, titulo: ' ' }),
    ).rejects.toThrow('El título es obligatorio.');
    expect(llamadas).toEqual([]);
  });

  it('un slug repetido es un conflicto 409', async () => {
    const { servicio } = crearServicio({
      blog_posts: [{ data: null, error: { message: 'dup', code: '23505' } }],
    });

    await expect(servicio.crearBlogPost(POST)).rejects.toThrow(
      ConflictException,
    );
  });

  it('actualizar un artículo que no existe es 404 y no escribe', async () => {
    const { servicio, escrituras } = crearServicio({
      blog_posts: [{ data: null, error: null }],
    });

    await expect(
      servicio.actualizarBlogPost('p-9', { titulo: 'x' }),
    ).rejects.toThrow(NotFoundException);
    expect(escrituras()).toEqual([]);
  });

  it('actualizar escribe solo lo recibido y estrena publicado_en al publicar', async () => {
    const { servicio, escrituras } = crearServicio({
      blog_posts: [
        { data: { estado: 'borrador', publicado_en: null }, error: null },
        { data: { id: 'p-1' }, error: null },
      ],
    });

    await servicio.actualizarBlogPost('p-1', { estado: 'publicado' });

    const [escritura] = escrituras();
    expect(escritura.metodo).toBe('update');
    expect(escritura.args[0]).toHaveProperty('publicado_en');
    expect(escritura.args[0]).toHaveProperty('estado', 'publicado');
  });

  it('eliminar un artículo que no existe es 404', async () => {
    const { servicio } = crearServicio({
      blog_posts: [{ count: 0, error: null }],
    });

    await expect(servicio.eliminarBlogPost('p-9')).rejects.toThrow(
      NotFoundException,
    );
  });
});
