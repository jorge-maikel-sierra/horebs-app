import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

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
    if (error) throw error;
    return data ?? [];
  }

  async crear(input: CrearEmpleadoInput): Promise<EmpleadoDto> {
    if (!input.nombre?.trim()) {
      throw new BadRequestException('Falta el nombre del trabajador.');
    }
    if (typeof input.monto_semanal !== 'number' || input.monto_semanal <= 0) {
      throw new BadRequestException('El monto semanal debe ser mayor a cero.');
    }
    const diasEsperados = input.dias_esperados_semana ?? 6;
    if (diasEsperados < 1 || diasEsperados > 7) {
      throw new BadRequestException('Los días esperados por semana deben estar entre 1 y 7.');
    }

    const client = this.supabase.getClient();
    if (input.usuario_id) {
      await this.validarUsuarioDisponible(input.usuario_id);
    }

    const { data, error } = await client
      .from('empleados')
      .insert({
        nombre: input.nombre.trim(),
        apellido: input.apellido?.trim() || null,
        cedula: input.cedula?.trim() || null,
        cargo: input.cargo?.trim() || null,
        telefono: input.telefono?.trim() || null,
        correo: input.correo?.trim() || null,
        usuario_id: input.usuario_id || null,
        monto_semanal: input.monto_semanal,
        dias_esperados_semana: diasEsperados,
      })
      .select(EMPLEADO_SELECT)
      .single();
    if (error) throw error;
    return data;
  }

  async editar(id: string, cambios: EditarEmpleadoInput): Promise<EmpleadoDto> {
    if (cambios.nombre !== undefined && !cambios.nombre.trim()) {
      throw new BadRequestException('El nombre no puede quedar vacío.');
    }
    if (
      cambios.monto_semanal !== undefined &&
      (typeof cambios.monto_semanal !== 'number' || cambios.monto_semanal <= 0)
    ) {
      throw new BadRequestException('El monto semanal debe ser mayor a cero.');
    }
    if (
      cambios.dias_esperados_semana !== undefined &&
      (cambios.dias_esperados_semana < 1 || cambios.dias_esperados_semana > 7)
    ) {
      throw new BadRequestException('Los días esperados por semana deben estar entre 1 y 7.');
    }

    const client = this.supabase.getClient();
    if (cambios.usuario_id) {
      await this.validarUsuarioDisponible(cambios.usuario_id, id);
    }

    const payload: Record<string, unknown> = {};
    if (cambios.nombre !== undefined) payload.nombre = cambios.nombre.trim();
    if (cambios.apellido !== undefined) payload.apellido = cambios.apellido.trim() || null;
    if (cambios.cedula !== undefined) payload.cedula = cambios.cedula.trim() || null;
    if (cambios.cargo !== undefined) payload.cargo = cambios.cargo.trim() || null;
    if (cambios.telefono !== undefined) payload.telefono = cambios.telefono.trim() || null;
    if (cambios.correo !== undefined) payload.correo = cambios.correo.trim() || null;
    if (cambios.usuario_id !== undefined) payload.usuario_id = cambios.usuario_id || null;
    if (cambios.monto_semanal !== undefined) payload.monto_semanal = cambios.monto_semanal;
    if (cambios.dias_esperados_semana !== undefined) {
      payload.dias_esperados_semana = cambios.dias_esperados_semana;
    }

    const { data, error } = await client
      .from('empleados')
      .update(payload)
      .eq('id', id)
      .select(EMPLEADO_SELECT)
      .single();
    if (error) {
      if (error.code === 'PGRST116') throw new NotFoundException('Trabajador no encontrado.');
      throw error;
    }
    return data;
  }

  async desactivar(id: string): Promise<void> {
    await this.cambiarActivo(id, false);
  }

  async activar(id: string): Promise<void> {
    await this.cambiarActivo(id, true);
  }

  private async cambiarActivo(id: string, activo: boolean): Promise<void> {
    const { error, count } = await this.supabase
      .getClient()
      .from('empleados')
      .update({ activo }, { count: 'exact' })
      .eq('id', id);
    if (error) throw error;
    if (!count) throw new NotFoundException('Trabajador no encontrado.');
  }

  private async validarUsuarioDisponible(usuarioId: string, empleadoIdActual?: string): Promise<void> {
    const client = this.supabase.getClient();
    const { data: perfil, error: perfilError } = await client
      .from('perfiles_staff')
      .select('id, rol')
      .eq('id', usuarioId)
      .maybeSingle();
    if (perfilError) throw perfilError;
    if (!perfil) {
      throw new BadRequestException('El usuario indicado no existe.');
    }

    let query = client.from('empleados').select('id').eq('usuario_id', usuarioId);
    if (empleadoIdActual) query = query.neq('id', empleadoIdActual);
    const { data: yaVinculado, error: vinculoError } = await query.maybeSingle();
    if (vinculoError) throw vinculoError;
    if (yaVinculado) {
      throw new BadRequestException('Ese usuario ya está vinculado a otro trabajador.');
    }
  }
}
