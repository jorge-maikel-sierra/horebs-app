import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupabaseService } from '../supabase/supabase.service';
import { ROLES_KEY, Rol } from './roles.decorator';

export interface UsuarioAutenticado {
  id: string;
  email: string;
  rol: Rol;
}

/**
 * Valida el Bearer token contra Supabase Auth y chequea que el usuario
 * tenga fila en perfiles_staff con uno de los roles requeridos por
 * @Roles(...). Sin ese decorator en el handler, deja pasar sin chequear
 * nada — el guard solo actúa donde se lo pide explícitamente.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rolesRequeridos = this.reflector.get<Rol[]>(
      ROLES_KEY,
      context.getHandler(),
    );
    if (!rolesRequeridos || rolesRequeridos.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : undefined;

    if (!token) {
      throw new UnauthorizedException('Falta el token de autenticación.');
    }

    const client = this.supabase.getClient();
    const { data: userData, error: userError } =
      await client.auth.getUser(token);
    if (userError || !userData.user) {
      throw new UnauthorizedException('Token inválido o expirado.');
    }

    const { data: perfil, error: perfilError } = await client
      .from('perfiles_staff')
      .select('rol')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (perfilError) throw perfilError;
    if (!perfil || !rolesRequeridos.includes(perfil.rol as Rol)) {
      throw new ForbiddenException('No tenés permiso para esta acción.');
    }

    const usuario: UsuarioAutenticado = {
      id: userData.user.id,
      email: userData.user.email ?? '',
      rol: perfil.rol as Rol,
    };
    request.usuario = usuario;

    return true;
  }
}
