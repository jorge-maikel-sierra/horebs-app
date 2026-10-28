import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { errorDeBase } from '../common/error-de-base';
import type { Rol } from '../auth/roles.decorator';

export interface UsuarioStaffDto {
  id: string;
  email: string;
  rol: Rol;
  cedula: string | null;
  created_at: string;
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
      .order('created_at');

    if (error) throw errorDeBase(error);
    return data ?? [];
  }

  async asignarRol(
    email: string,
    rol: Rol,
    cedula?: string,
  ): Promise<UsuarioStaffDto> {
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
      .single();

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

  private async buscarUsuarioPorEmail(email: string) {
    const client = this.supabase.getClient();
    const maxPaginas = 5;

    for (let page = 1; page <= maxPaginas; page++) {
      const { data, error } = await client.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (error) throw errorDeBase(error);

      const encontrado = data.users.find(
        (u) => u.email?.toLowerCase() === email,
      );
      if (encontrado) return encontrado;
      if (data.users.length < 200) break;
    }

    return null;
  }
}
