import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { RequestConUsuario } from './request-con-usuario';
import { usuarioDelToken } from './validar-token';

export interface UsuarioSupabase {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
}

function textoDe(valor: unknown): string {
  return typeof valor === 'string' ? valor : '';
}

/**
 * Valida el Bearer token contra Supabase Auth. A diferencia de RolesGuard,
 * no exige fila en perfiles_staff — cualquier cliente logueado pasa. Sirve
 * para acciones de usuarios finales (comentarios, likes), no de staff.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RequestConUsuario<UsuarioSupabase>>();
    const user = await usuarioDelToken(
      this.supabase.getClient(),
      request.headers.authorization,
    );

    const meta: Record<string, unknown> = user.user_metadata ?? {};
    const usuario: UsuarioSupabase = {
      id: user.id,
      email: user.email ?? '',
      nombre: textoDe(meta.nombre),
      apellido: textoDe(meta.apellido),
    };
    request.usuario = usuario;

    return true;
  }
}
