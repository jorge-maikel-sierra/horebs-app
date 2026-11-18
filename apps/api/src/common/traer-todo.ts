import type { SupabaseClient } from '@supabase/supabase-js';
import { errorDeBase } from './error-de-base';

// PostgREST devuelve como mucho 1.000 filas por consulta.
const LOTE = 1000;

/** Trae todas las filas de una tabla paginando de a 1.000 (ordenadas por `orden` para que no se repitan). */
export async function traerTodo<T>(
  client: SupabaseClient,
  tabla: string,
  columnas: string,
  orden = 'id',
): Promise<T[]> {
  const todas: T[] = [];
  for (let desde = 0; ; desde += LOTE) {
    const { data, error } = await client
      .from(tabla)
      .select(columnas)
      .order(orden)
      .range(desde, desde + LOTE - 1)
      .returns<T[]>();
    if (error) throw errorDeBase(error);
    const lote = data ?? [];
    todas.push(...lote);
    if (lote.length < LOTE) return todas;
  }
}
