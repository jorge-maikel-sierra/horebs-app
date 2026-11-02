import { BadRequestException } from '@nestjs/common';
import type { UsuarioSupabase } from '../auth/supabase-auth.guard';
import {
  MAX_LARGO_COMENTARIO,
  type CrearBlogPostInput,
  type FilaPostActual,
  type FilaPerfilStaff,
} from './blog.tipos';

/** Nombre y apellido; si no hay, el correo; el insert lo cae a "Cliente" si tampoco hay. */
export function nombreDeAutor(usuario: UsuarioSupabase): string {
  return `${usuario.nombre} ${usuario.apellido}`.trim() || usuario.email;
}

/** El comentario recortado, o 400 si queda vacío o se pasa del máximo. */
export function comentarioValido(contenido: string | undefined): string {
  const limpio = contenido?.trim();
  if (!limpio) {
    throw new BadRequestException('El comentario no puede estar vacío.');
  }
  if (limpio.length > MAX_LARGO_COMENTARIO) {
    throw new BadRequestException(
      `El comentario es demasiado largo (máximo ${MAX_LARGO_COMENTARIO} caracteres).`,
    );
  }
  return limpio;
}

export function esAdmin(perfil: FilaPerfilStaff | null): boolean {
  return perfil?.rol === 'admin';
}

export function validarNuevoPost(input: CrearBlogPostInput): void {
  const obligatorios: [string | undefined, string][] = [
    [input.titulo, 'El título es obligatorio.'],
    [input.slug, 'El slug es obligatorio.'],
    [input.resumen, 'El resumen es obligatorio.'],
    [input.contenido, 'El contenido es obligatorio.'],
  ];
  for (const [valor, mensaje] of obligatorios) {
    if (!valor?.trim()) throw new BadRequestException(mensaje);
  }
}

/** Un texto opcional en blanco se guarda como null. */
function opcionalONull(valor: string | undefined | null): string | null {
  return valor?.trim() || null;
}

/** La fila a insertar; un artículo que nace publicado estrena `publicado_en`. */
export function filaNuevoPost(
  input: CrearBlogPostInput,
  ahora: string,
): Record<string, unknown> {
  const estado = input.estado ?? 'borrador';
  return {
    titulo: input.titulo.trim(),
    slug: input.slug.trim(),
    resumen: input.resumen.trim(),
    contenido: input.contenido,
    palabra_clave: opcionalONull(input.palabra_clave),
    imagen_url: opcionalONull(input.imagen_url),
    etiqueta: opcionalONull(input.etiqueta),
    estado,
    publicado_en: estado === 'publicado' ? ahora : null,
  };
}

/** Un valor ausente no se toca; en blanco se guarda como null. */
function borrable(valor: string | undefined | null): string | null | undefined {
  return valor === undefined ? undefined : opcionalONull(valor);
}

/**
 * Solo las columnas que el cambio trae. `publicado_en` se estrena la primera
 * vez que el artículo pasa a publicado y no se vuelve a tocar.
 */
export function cambiosDePost(
  cambios: Partial<CrearBlogPostInput>,
  actual: FilaPostActual,
  ahora: string,
): Record<string, unknown> {
  const columnas: Record<string, unknown> = {
    titulo: cambios.titulo?.trim(),
    slug: cambios.slug?.trim(),
    resumen: cambios.resumen?.trim(),
    contenido: cambios.contenido ?? undefined,
    palabra_clave: borrable(cambios.palabra_clave),
    imagen_url: borrable(cambios.imagen_url),
    etiqueta: borrable(cambios.etiqueta),
    estado: cambios.estado,
  };
  if (cambios.estado === 'publicado' && !actual.publicado_en) {
    columnas.publicado_en = ahora;
  }
  const traidas = Object.entries(columnas).filter(([, v]) => v !== undefined);
  return { updated_at: ahora, ...Object.fromEntries(traidas) };
}
