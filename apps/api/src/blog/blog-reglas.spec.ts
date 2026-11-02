import { BadRequestException } from '@nestjs/common';
import type { UsuarioSupabase } from '../auth/supabase-auth.guard';
import {
  cambiosDePost,
  comentarioValido,
  esAdmin,
  filaNuevoPost,
  nombreDeAutor,
  validarNuevoPost,
} from './blog-reglas';
import { MAX_LARGO_COMENTARIO, type CrearBlogPostInput } from './blog.tipos';

const AHORA = '2026-10-30T10:00:00.000Z';

const POST: CrearBlogPostInput = {
  titulo: ' Pizza de la casa ',
  slug: ' pizza-de-la-casa ',
  resumen: ' La firma de Horebs ',
  contenido: '  # Texto  ',
};

describe('nombreDeAutor', () => {
  const usuario = (nombre: string, apellido: string) =>
    ({ nombre, apellido, email: 'ana@correo.co' }) as UsuarioSupabase;

  it('junta nombre y apellido', () => {
    expect(nombreDeAutor(usuario('Ana', 'Pérez'))).toBe('Ana Pérez');
  });

  it('sin nombre cae al correo', () => {
    expect(nombreDeAutor(usuario('', ''))).toBe('ana@correo.co');
  });
});

describe('comentarioValido', () => {
  it('devuelve el comentario recortado', () => {
    expect(comentarioValido('  Qué rica  ')).toBe('Qué rica');
  });

  it.each([undefined, '', '   '])('"%s" es 400', (contenido) => {
    expect(() => comentarioValido(contenido)).toThrow(BadRequestException);
  });

  it('el máximo se acepta y uno más se rechaza', () => {
    expect(() =>
      comentarioValido('a'.repeat(MAX_LARGO_COMENTARIO)),
    ).not.toThrow();
    expect(() =>
      comentarioValido('a'.repeat(MAX_LARGO_COMENTARIO + 1)),
    ).toThrow(BadRequestException);
  });
});

describe('esAdmin', () => {
  it('solo el rol admin borra comentarios ajenos', () => {
    expect(esAdmin({ rol: 'admin' })).toBe(true);
    expect(esAdmin({ rol: 'empleado' })).toBe(false);
    expect(esAdmin(null)).toBe(false);
  });
});

describe('validarNuevoPost', () => {
  it('con los cuatro campos obligatorios es válido', () => {
    expect(() => validarNuevoPost(POST)).not.toThrow();
  });

  it.each([
    ['titulo', 'El título es obligatorio.'],
    ['slug', 'El slug es obligatorio.'],
    ['resumen', 'El resumen es obligatorio.'],
    ['contenido', 'El contenido es obligatorio.'],
  ])('sin %s es 400', (campo, mensaje) => {
    expect(() => validarNuevoPost({ ...POST, [campo]: '  ' })).toThrow(mensaje);
  });
});

describe('filaNuevoPost', () => {
  it('nace borrador, recorta textos y deja el contenido tal cual', () => {
    expect(filaNuevoPost(POST, AHORA)).toEqual({
      titulo: 'Pizza de la casa',
      slug: 'pizza-de-la-casa',
      resumen: 'La firma de Horebs',
      contenido: '  # Texto  ',
      palabra_clave: null,
      imagen_url: null,
      etiqueta: null,
      estado: 'borrador',
      publicado_en: null,
    });
  });

  it('un artículo que nace publicado estrena publicado_en', () => {
    expect(
      filaNuevoPost(
        { ...POST, estado: 'publicado', etiqueta: ' Menú ' },
        AHORA,
      ),
    ).toMatchObject({
      estado: 'publicado',
      publicado_en: AHORA,
      etiqueta: 'Menú',
    });
  });
});

describe('cambiosDePost', () => {
  const borrador = { estado: 'borrador' as const, publicado_en: null };

  it('un cambio vacío solo marca updated_at', () => {
    expect(cambiosDePost({}, borrador, AHORA)).toEqual({ updated_at: AHORA });
  });

  it('recorta textos y vuelve null los opcionales en blanco', () => {
    expect(
      cambiosDePost(
        { titulo: ' Nuevo ', etiqueta: ' ', imagen_url: '' },
        borrador,
        AHORA,
      ),
    ).toEqual({
      updated_at: AHORA,
      titulo: 'Nuevo',
      etiqueta: null,
      imagen_url: null,
    });
  });

  it('un null en un campo obligatorio se ignora en vez de reventar', () => {
    const cambios = { titulo: null } as unknown as { titulo: string };

    expect(cambiosDePost(cambios, borrador, AHORA)).toEqual({
      updated_at: AHORA,
    });
  });

  it('la primera publicación estrena publicado_en', () => {
    expect(
      cambiosDePost({ estado: 'publicado' }, borrador, AHORA),
    ).toMatchObject({ estado: 'publicado', publicado_en: AHORA });
  });

  it('volver a publicar no pisa la fecha original', () => {
    const yaPublicado = {
      estado: 'borrador' as const,
      publicado_en: '2026-01-01T00:00:00.000Z',
    };

    expect(
      cambiosDePost({ estado: 'publicado' }, yaPublicado, AHORA),
    ).not.toHaveProperty('publicado_en');
  });
});
