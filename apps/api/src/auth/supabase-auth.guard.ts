import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface UsuarioSupabase {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
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
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : undefined;

    if (!token) {
      throw new UnauthorizedException('Falta el token de autenticación.');
    }

    const { data, error } = await this.supabase
      .getClient()
      .auth.getUser(token);
    if (error || !data.user) {
      throw new UnauthorizedException('Token inválido o expirado.');
    }

    const meta = data.user.user_metadata ?? {};
    const usuario: UsuarioSupabase = {
      id: data.user.id,
      email: data.user.email ?? '',
      nombre: meta.nombre ?? '',
      apellido: meta.apellido ?? '',
    };
    request.usuario = usuario;

    return true;
  }
}

export const UsuarioSupabaseActual = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UsuarioSupabase => {
    const request = ctx.switchToHttp().getRequest();
    return request.usuario;
  },
);
