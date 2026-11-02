import { Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { errorDeBase } from '../common/error-de-base';
import type { Rol } from '../auth/roles.decorator';

const MAX_PAGINAS_USUARIOS = 5;
const USUARIOS_POR_PAGINA = 200;

export interface UsuarioStaffDto {
  id: string;
  email: string;
  rol: Rol;
  cedula: string | null;
  created_at: string;
}

export interface AsignarRolInput {
  email: string;
  rol: Rol;
  cedula?: string;
}

/** Personal con acceso al panel: quién tiene qué rol. */
@Injectable()
export class UsuariosAdminService {
  constructor(private readonly supabase: SupabaseService) {}

  async listarUsuarios(): Promise<UsuarioStaffDto[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('perfiles_staff')
      .select('id, email, rol, cedula, created_at')
      .order('created_at')
      .returns<UsuarioStaffDto[]>();

    if (error) throw errorDeBase(error);
    return data ?? [];
  }

  async asignarRol({
    email,
    rol,
    cedula,
  }: AsignarRolInput): Promise<UsuarioStaffDto> {
    const client = this.supabase.getClient();
    const emailNormalizado = email.trim().toLowerCase();

    const usuario = await this.buscarUsuarioPorEmail(emailNormalizado);
    if (!usuario) {
      throw new NotFoundException(
        'Esa persona todavía no tiene una cuenta. Tiene que registrarse en /cuenta antes de poder asignarle un rol.',
      );
    }

    const payload: Record<string, string | null> = {
      id: usuario.id,
      email: usuario.email ?? emailNormalizado,
      rol,
    };
    // Solo se toca la columna si esta llamada trae cedula — así reasignar
    // un rol sin repetirla no borra la que ya estaba guardada.
    if (cedula !== undefined) payload.cedula = cedula.trim() || null;

    const { data, error } = await client
      .from('perfiles_staff')
      .upsert(payload, { onConflict: 'id' })
      .select('id, email, rol, cedula, created_at')
      .single<UsuarioStaffDto>();

    if (error) throw errorDeBase(error);
    return data;
  }

  async quitarRol(id: string): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('perfiles_staff')
      .delete()
      .eq('id', id);
    if (error) throw errorDeBase(error);
  }

  private async buscarUsuarioPorEmail(email: string): Promise<User | null> {
    const client = this.supabase.getClient();
    for (let page = 1; page <= MAX_PAGINAS_USUARIOS; page++) {
      const { data, error } = await client.auth.admin.listUsers({
        page,
        perPage: USUARIOS_POR_PAGINA,
      });
      if (error) throw errorDeBase(error);

      const encontrado = data.users.find(
        (u) => u.email?.toLowerCase() === email,
      );
      if (encontrado) return encontrado;
      if (data.users.length < USUARIOS_POR_PAGINA) break;
    }

    return null;
  }
}
