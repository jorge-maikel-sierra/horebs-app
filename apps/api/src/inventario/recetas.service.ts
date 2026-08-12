import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface SubrecetaComponenteInput {
  insumo_id: string;
  cantidad_necesaria_g: number;
}

export interface CrearSubrecetaInput {
  nombre: string;
  descripcion?: string;
  rendimiento_g: number;
  componentes: SubrecetaComponenteInput[];
}

export interface SubrecetaDto {
  id: string;
  nombre: string;
  descripcion: string | null;
  rendimiento_g: number;
  costo_calculado: number;
  componentes: {
    insumo_id: string;
    insumo_nombre: string;
    cantidad_necesaria_g: number;
  }[];
}

export interface RecetaComponenteInput {
  tipo_componente: 'insumo' | 'subreceta';
  insumo_id?: string;
  subreceta_id?: string;
  cantidad_necesaria_g: number;
}

export interface CrearRecetaInput {
  variante_id?: string;
  nombre: string;
  descripcion?: string;
  rendimiento_g?: number;
  activa?: boolean;
  componentes: RecetaComponenteInput[];
}

export interface RecetaDto {
  id: string;
  variante_id: string | null;
  variante_nombre: string | null;
  producto_nombre: string | null;
  nombre: string;
  descripcion: string | null;
  rendimiento_g: number | null;
  activa: boolean;
  costo_calculado: number;
  componentes: {
    tipo_componente: 'insumo' | 'subreceta';
    insumo_id: string | null;
    insumo_nombre: string | null;
    subreceta_id: string | null;
    subreceta_nombre: string | null;
    cantidad_necesaria_g: number;
  }[];
}

const SUBRECETA_SELECT =
  'id, nombre, descripcion, rendimiento_g, costo_calculado, subreceta_componentes(insumo_id, cantidad_necesaria_g, insumos(nombre))';
const RECETA_SELECT =
  'id, variante_id, nombre, descripcion, rendimiento_g, activa, costo_calculado, variantes_producto(nombre, productos(nombre)), receta_componentes(tipo_componente, insumo_id, subreceta_id, cantidad_necesaria_g, insumos(nombre), subrecetas(nombre))';

@Injectable()
export class RecetasService {
  constructor(private readonly supabase: SupabaseService) {}

  // ---------- Subrecetas ----------

  async listarSubrecetas(): Promise<SubrecetaDto[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('subrecetas')
      .select(SUBRECETA_SELECT)
      .order('nombre');
    if (error) throw error;
    return (data ?? []).map((s) => this.mapSubreceta(s));
  }

  async crearSubreceta(input: CrearSubrecetaInput): Promise<SubrecetaDto> {
    this.validarSubreceta(input);
    const client = this.supabase.getClient();

    const { data: subreceta, error } = await client
      .from('subrecetas')
      .insert({
        nombre: input.nombre.trim(),
        descripcion: input.descripcion?.trim() || null,
        rendimiento_g: input.rendimiento_g,
      })
      .select('id')
      .single();
    if (error) throw error;

    await this.reemplazarComponentesSubreceta(client, subreceta.id, input.componentes);
    await this.recalcularCostoSubreceta(client, subreceta.id);
    return this.obtenerSubreceta(client, subreceta.id);
  }

  async editarSubreceta(id: string, input: CrearSubrecetaInput): Promise<SubrecetaDto> {
    this.validarSubreceta(input);
    const client = this.supabase.getClient();

    const { error, count } = await client
      .from('subrecetas')
      .update(
        {
          nombre: input.nombre.trim(),
          descripcion: input.descripcion?.trim() || null,
          rendimiento_g: input.rendimiento_g,
        },
        { count: 'exact' },
      )
      .eq('id', id);
    if (error) throw error;
    if (!count) throw new NotFoundException('Subreceta no encontrada.');

    await this.reemplazarComponentesSubreceta(client, id, input.componentes);
    await this.recalcularCostoSubreceta(client, id);
    // Una subreceta puede estar en varias recetas — su costo cambió.
    await this.recalcularCostosRecetasQueUsan(client, id);
    return this.obtenerSubreceta(client, id);
  }

  // ---------- Recetas ----------

  async listarRecetas(): Promise<RecetaDto[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('recetas')
      .select(RECETA_SELECT)
      .order('nombre');
    if (error) throw error;
    return (data ?? []).map((r) => this.mapReceta(r));
  }

  async crearReceta(input: CrearRecetaInput): Promise<RecetaDto> {
    this.validarReceta(input);
    const client = this.supabase.getClient();

    const { data: receta, error } = await client
      .from('recetas')
      .insert({
        variante_id: input.variante_id || null,
        nombre: input.nombre.trim(),
        descripcion: input.descripcion?.trim() || null,
        rendimiento_g: input.rendimiento_g ?? null,
        activa: input.activa ?? true,
      })
      .select('id')
      .single();
    if (error) throw error;

    await this.reemplazarComponentesReceta(client, receta.id, input.componentes);
    await this.recalcularCostoReceta(client, receta.id);
    return this.obtenerReceta(client, receta.id);
  }

  async editarReceta(id: string, input: CrearRecetaInput): Promise<RecetaDto> {
    this.validarReceta(input);
    const client = this.supabase.getClient();

    const { error, count } = await client
      .from('recetas')
      .update(
        {
          variante_id: input.variante_id || null,
          nombre: input.nombre.trim(),
          descripcion: input.descripcion?.trim() || null,
          rendimiento_g: input.rendimiento_g ?? null,
          activa: input.activa ?? true,
        },
        { count: 'exact' },
      )
      .eq('id', id);
    if (error) throw error;
    if (!count) throw new NotFoundException('Receta no encontrada.');

    await this.reemplazarComponentesReceta(client, id, input.componentes);
    await this.recalcularCostoReceta(client, id);
    return this.obtenerReceta(client, id);
  }

  // ---------- privado ----------

  private validarSubreceta(input: CrearSubrecetaInput) {
    if (!input.nombre?.trim()) throw new BadRequestException('Falta el nombre de la subreceta.');
    if (!input.rendimiento_g || input.rendimiento_g <= 0) {
      throw new BadRequestException('El rendimiento debe ser mayor a cero.');
    }
    if (!Array.isArray(input.componentes) || input.componentes.length === 0) {
      throw new BadRequestException('La subreceta necesita al menos un insumo.');
    }
    for (const c of input.componentes) {
      if (!c.insumo_id || !c.cantidad_necesaria_g || c.cantidad_necesaria_g <= 0) {
        throw new BadRequestException('Componente de subreceta inválido.');
      }
    }
  }

  private validarReceta(input: CrearRecetaInput) {
    if (!input.nombre?.trim()) throw new BadRequestException('Falta el nombre de la receta.');
    if (!Array.isArray(input.componentes) || input.componentes.length === 0) {
      throw new BadRequestException('La receta necesita al menos un componente.');
    }
    for (const c of input.componentes) {
      if (!c.cantidad_necesaria_g || c.cantidad_necesaria_g <= 0) {
        throw new BadRequestException('Cantidad inválida en un componente.');
      }
      if (c.tipo_componente === 'insumo' && !c.insumo_id) {
        throw new BadRequestException('Falta el insumo en un componente.');
      }
      if (c.tipo_componente === 'subreceta' && !c.subreceta_id) {
        throw new BadRequestException('Falta la subreceta en un componente.');
      }
    }
  }

  private async reemplazarComponentesSubreceta(
    client: SupabaseClient,
    subrecetaId: string,
    componentes: SubrecetaComponenteInput[],
  ) {
    const { error: deleteError } = await client
      .from('subreceta_componentes')
      .delete()
      .eq('subreceta_id', subrecetaId);
    if (deleteError) throw deleteError;

    const { error: insertError } = await client.from('subreceta_componentes').insert(
      componentes.map((c) => ({
        subreceta_id: subrecetaId,
        insumo_id: c.insumo_id,
        cantidad_necesaria_g: c.cantidad_necesaria_g,
      })),
    );
    if (insertError) throw insertError;
  }

  private async reemplazarComponentesReceta(
    client: SupabaseClient,
    recetaId: string,
    componentes: RecetaComponenteInput[],
  ) {
    const { error: deleteError } = await client
      .from('receta_componentes')
      .delete()
      .eq('receta_id', recetaId);
    if (deleteError) throw deleteError;

    const { error: insertError } = await client.from('receta_componentes').insert(
      componentes.map((c) => ({
        receta_id: recetaId,
        tipo_componente: c.tipo_componente,
        insumo_id: c.tipo_componente === 'insumo' ? c.insumo_id : null,
        subreceta_id: c.tipo_componente === 'subreceta' ? c.subreceta_id : null,
        cantidad_necesaria_g: c.cantidad_necesaria_g,
      })),
    );
    if (insertError) throw insertError;
  }

  private async recalcularCostoSubreceta(client: SupabaseClient, subrecetaId: string) {
    const { data, error } = await client
      .from('subreceta_componentes')
      .select('cantidad_necesaria_g, insumos(costo_unitario_g)')
      .eq('subreceta_id', subrecetaId);
    if (error) throw error;

    const costo = (data ?? []).reduce(
      (acc: number, c: any) => acc + c.cantidad_necesaria_g * (c.insumos?.costo_unitario_g ?? 0),
      0,
    );
    const { error: updateError } = await client
      .from('subrecetas')
      .update({ costo_calculado: costo })
      .eq('id', subrecetaId);
    if (updateError) throw updateError;
  }

  private async recalcularCostoReceta(client: SupabaseClient, recetaId: string) {
    const { data, error } = await client
      .from('receta_componentes')
      .select(
        'tipo_componente, cantidad_necesaria_g, insumos(costo_unitario_g), subrecetas(costo_calculado, rendimiento_g)',
      )
      .eq('receta_id', recetaId);
    if (error) throw error;

    const costo = (data ?? []).reduce((acc: number, c: any) => {
      if (c.tipo_componente === 'insumo') {
        return acc + c.cantidad_necesaria_g * (c.insumos?.costo_unitario_g ?? 0);
      }
      const rendimiento = c.subrecetas?.rendimiento_g;
      if (!rendimiento) return acc;
      const costoPorGramo = (c.subrecetas?.costo_calculado ?? 0) / rendimiento;
      return acc + c.cantidad_necesaria_g * costoPorGramo;
    }, 0);

    const { error: updateError } = await client
      .from('recetas')
      .update({ costo_calculado: costo })
      .eq('id', recetaId);
    if (updateError) throw updateError;
  }

  private async recalcularCostosRecetasQueUsan(client: SupabaseClient, subrecetaId: string) {
    const { data, error } = await client
      .from('receta_componentes')
      .select('receta_id')
      .eq('subreceta_id', subrecetaId);
    if (error) throw error;

    const recetaIds = [...new Set((data ?? []).map((r) => r.receta_id as string))];
    for (const recetaId of recetaIds) {
      await this.recalcularCostoReceta(client, recetaId);
    }
  }

  private async obtenerSubreceta(client: SupabaseClient, id: string): Promise<SubrecetaDto> {
    const { data, error } = await client.from('subrecetas').select(SUBRECETA_SELECT).eq('id', id).single();
    if (error) throw error;
    return this.mapSubreceta(data);
  }

  private async obtenerReceta(client: SupabaseClient, id: string): Promise<RecetaDto> {
    const { data, error } = await client.from('recetas').select(RECETA_SELECT).eq('id', id).single();
    if (error) throw error;
    return this.mapReceta(data);
  }

  private mapSubreceta(s: any): SubrecetaDto {
    const componentes = (s.subreceta_componentes ?? []) as any[];
    return {
      id: s.id,
      nombre: s.nombre,
      descripcion: s.descripcion,
      rendimiento_g: s.rendimiento_g,
      costo_calculado: s.costo_calculado,
      componentes: componentes.map((c) => ({
        insumo_id: c.insumo_id,
        insumo_nombre: c.insumos?.nombre ?? '',
        cantidad_necesaria_g: c.cantidad_necesaria_g,
      })),
    };
  }

  private mapReceta(r: any): RecetaDto {
    const componentes = (r.receta_componentes ?? []) as any[];
    return {
      id: r.id,
      variante_id: r.variante_id,
      variante_nombre: r.variantes_producto?.nombre ?? null,
      producto_nombre: r.variantes_producto?.productos?.nombre ?? null,
      nombre: r.nombre,
      descripcion: r.descripcion,
      rendimiento_g: r.rendimiento_g,
      activa: r.activa,
      costo_calculado: r.costo_calculado,
      componentes: componentes.map((c) => ({
        tipo_componente: c.tipo_componente,
        insumo_id: c.insumo_id,
        insumo_nombre: c.insumos?.nombre ?? null,
        subreceta_id: c.subreceta_id,
        subreceta_nombre: c.subrecetas?.nombre ?? null,
        cantidad_necesaria_g: c.cantidad_necesaria_g,
      })),
    };
  }
}
