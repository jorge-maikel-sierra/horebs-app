import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupabaseService } from '../supabase/supabase.service';
import { ROLES_KEY, Rol } from './roles.decorator';
import { errorDeBase } from '../common/error-de-base';
import type { RequestConUsuario } from './request-con-usuario';
import { usuarioDelToken } from './validar-token';

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

    const request = context
      .switchToHttp()
      .getRequest<RequestConUsuario<UsuarioAutenticado>>();
    const client = this.supabase.getClient();
    const user = await usuarioDelToken(client, request.headers.authorization);

    const { data: perfil, error: perfilError } = await client
      .from('perfiles_staff')
      .select('rol')
      .eq('id', user.id)
      .maybeSingle();

    if (perfilError) throw errorDeBase(perfilError);
    if (!perfil || !rolesRequeridos.includes(perfil.rol as Rol)) {
      throw new ForbiddenException('No tenés permiso para esta acción.');
    }

    const usuario: UsuarioAutenticado = {
      id: user.id,
      email: user.email ?? '',
      rol: perfil.rol as Rol,
    };
    request.usuario = usuario;

    return true;
  }
}
