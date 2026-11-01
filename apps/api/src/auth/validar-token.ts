import { UnauthorizedException } from '@nestjs/common';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { tokenBearer } from './request-con-usuario';

/** El usuario de Supabase Auth dueño del Bearer token; si no hay o no sirve, 401. */
export async function usuarioDelToken(
  client: SupabaseClient,
  authHeader: string | undefined,
): Promise<User> {
  const token = tokenBearer(authHeader);
  if (!token) {
    throw new UnauthorizedException('Falta el token de autenticación.');
  }
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    throw new UnauthorizedException('Token inválido o expirado.');
  }
  return data.user;
}
