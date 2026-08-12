import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface InsumoDto {
  id: string;
  nombre: string;
  categoria: string;
  stock_actual_g: number;
  stock_minimo_g: number;
  costo_unitario_g: number;
  proveedor_principal: string | null;
  fecha_ultima_compra: string | null;
  activo: boolean;
}

export interface CrearInsumoInput {
  nombre: string;
  categoria: string;
  stock_minimo_g?: number;
  proveedor_principal?: string;
}

const INSUMO_SELECT =
  'id, nombre, categoria, stock_actual_g, stock_minimo_g, costo_unitario_g, proveedor_principal, fecha_ultima_compra, activo';

@Injectable()
export class InsumosService {
  constructor(private readonly supabase: SupabaseService) {}

  async listar(stockBajo?: boolean): Promise<InsumoDto[]> {
    const client = this.supabase.getClient();
    let query = client.from('insumos').select(INSUMO_SELECT).order('nombre');
    const { data, error } = await query;
    if (error) throw error;

    const insumos = data ?? [];
    if (!stockBajo) return insumos;
    return insumos.filter((i) => i.stock_actual_g <= i.stock_minimo_g);
  }

  async crear(input: CrearInsumoInput): Promise<InsumoDto> {
    if (!input.nombre?.trim()) {
      throw new BadRequestException('Falta el nombre del insumo.');
    }
    if (!input.categoria?.trim()) {
      throw new BadRequestException('Falta la categoría del insumo.');
    }
    if (input.stock_minimo_g !== undefined && input.stock_minimo_g < 0) {
      throw new BadRequestException('El stock mínimo no puede ser negativo.');
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('insumos')
      .insert({
        nombre: input.nombre.trim(),
        categoria: input.categoria.trim(),
        stock_minimo_g: input.stock_minimo_g ?? 0,
        proveedor_principal: input.proveedor_principal?.trim() || null,
      })
      .select(INSUMO_SELECT)
      .single();
    if (error) throw error;
    return data;
  }

  async editar(
    id: string,
    cambios: {
      nombre?: string;
      categoria?: string;
      stock_minimo_g?: number;
      proveedor_principal?: string;
      activo?: boolean;
    },
  ): Promise<InsumoDto> {
    if (cambios.nombre !== undefined && !cambios.nombre.trim()) {
      throw new BadRequestException('El nombre no puede quedar vacío.');
    }
    if (cambios.stock_minimo_g !== undefined && cambios.stock_minimo_g < 0) {
      throw new BadRequestException('El stock mínimo no puede ser negativo.');
    }

    const payload: Record<string, unknown> = {};
    if (cambios.nombre !== undefined) payload.nombre = cambios.nombre.trim();
    if (cambios.categoria !== undefined) payload.categoria = cambios.categoria.trim();
    if (cambios.stock_minimo_g !== undefined) payload.stock_minimo_g = cambios.stock_minimo_g;
    if (cambios.proveedor_principal !== undefined) {
      payload.proveedor_principal = cambios.proveedor_principal.trim() || null;
    }
    if (cambios.activo !== undefined) payload.activo = cambios.activo;

    const { data, error } = await this.supabase
      .getClient()
      .from('insumos')
      .update(payload)
      .eq('id', id)
      .select(INSUMO_SELECT)
      .single();
    if (error) {
      if (error.code === 'PGRST116') throw new NotFoundException('Insumo no encontrado.');
      throw error;
    }
    return data;
  }
}
