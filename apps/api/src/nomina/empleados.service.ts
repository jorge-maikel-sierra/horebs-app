import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { errorDeBase } from '../common/error-de-base';
import { armarCambiosEmpleado } from './empleado-cambios';

export interface EmpleadoDto {
  id: string;
  nombre: string;
  apellido: string | null;
  cedula: string | null;
  cargo: string | null;
  telefono: string | null;
  correo: string | null;
  usuario_id: string | null;
  monto_semanal: number;
  dias_esperados_semana: number;
  activo: boolean;
}

export interface CrearEmpleadoInput {
  nombre: string;
  apellido?: string;
  cedula?: string;
  cargo?: string;
  telefono?: string;
  correo?: string;
  usuario_id?: string | null;
  monto_semanal: number;
  dias_esperados_semana?: number;
}

export interface EditarEmpleadoInput {
  nombre?: string;
  apellido?: string;
  cedula?: string;
  cargo?: string;
  telefono?: string;
  correo?: string;
  usuario_id?: string | null;
  monto_semanal?: number;
  dias_esperados_semana?: number;
  activo?: boolean;
}

export const EMPLEADO_SELECT =
  'id, nombre, apellido, cedula, cargo, telefono, correo, usuario_id, monto_semanal, dias_esperados_semana, activo';

@Injectable()
export class EmpleadosService {
  constructor(private readonly supabase: SupabaseService) {}

  async listar(soloActivos = false): Promise<EmpleadoDto[]> {
    const client = this.supabase.getClient();
    let query = client.from('empleados').select(EMPLEADO_SELECT).order('nombre');
    if (soloActivos) query = query.eq('activo', true);
    const { data, error } = await query;
    if (error) throw errorDeBase(error);
    return data ?? [];
  }

  async crear(input: CrearEmpleadoInput): Promise<EmpleadoDto> {
    const client = this.supabase.getClient();
    if (input.usuario_id) {
      await this.validarUsuarioDisponible(input.usuario_id);
    }

    const { data, error } = await client
      .from('empleados')
      // Lo que falte (días esperados, activo) lo completa el default de la tabla.
      .insert(armarCambiosEmpleado(input))
      .select(EMPLEADO_SELECT)
      .single();
    if (error) throw errorDeBase(error);
    return data;
  }

  async editar(id: string, cambios: EditarEmpleadoInput): Promise<EmpleadoDto> {
    const client = this.supabase.getClient();
    if (cambios.usuario_id) {
      await this.validarUsuarioDisponible(cambios.usuario_id, id);
    }

    const { data, error } = await client
      .from('empleados')
      .update(armarCambiosEmpleado(cambios))
      .eq('id', id)
      .select(EMPLEADO_SELECT)
      .single();
    if (error) {
      if (error.code === 'PGRST116') throw new NotFoundException('Trabajador no encontrado.');
      throw errorDeBase(error);
    }
    return data;
  }

  private async validarUsuarioDisponible(usuarioId: string, empleadoIdActual?: string): Promise<void> {
    const client = this.supabase.getClient();
    const { data: perfil, error: perfilError } = await client
      .from('perfiles_staff')
      .select('id, rol')
      .eq('id', usuarioId)
      .maybeSingle();
    if (perfilError) throw errorDeBase(perfilError);
    if (!perfil) {
      throw new BadRequestException('El usuario indicado no existe.');
    }

    let query = client.from('empleados').select('id').eq('usuario_id', usuarioId);
    if (empleadoIdActual) query = query.neq('id', empleadoIdActual);
    const { data: yaVinculado, error: vinculoError } = await query.maybeSingle();
    if (vinculoError) throw errorDeBase(vinculoError);
    if (yaVinculado) {
      throw new ConflictException('Ese usuario ya está vinculado a otro trabajador.');
    }
  }
}
