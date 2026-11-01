import { Injectable, NotFoundException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { errorDeBase } from '../common/error-de-base';
import { SupabaseService } from '../supabase/supabase.service';
import {
  costoDeReceta,
  costoDeSubreceta,
  filasComponentesReceta,
  filasComponentesSubreceta,
  mapReceta,
  mapSubreceta,
  payloadReceta,
  payloadSubreceta,
  validarReceta,
  validarSubreceta,
} from './recetas-reglas';
import {
  RECETA_SELECT,
  SUBRECETA_SELECT,
  type CrearRecetaInput,
  type CrearSubrecetaInput,
  type FilaCostoReceta,
  type FilaCostoSubreceta,
  type FilaReceta,
  type FilaSubreceta,
  type RecetaDto,
  type SubrecetaDto,
} from './recetas.tipos';

/** Dónde viven los componentes de una receta o subreceta y de quién son. */
interface DestinoComponentes {
  tabla: 'subreceta_componentes' | 'receta_componentes';
  columnaPadre: 'subreceta_id' | 'receta_id';
  padreId: string;
}

@Injectable()
export class RecetasService {
  constructor(private readonly supabase: SupabaseService) {}

  // ---------- Subrecetas ----------

  async listarSubrecetas(): Promise<SubrecetaDto[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('subrecetas')
      .select(SUBRECETA_SELECT)
      .order('nombre')
      .returns<FilaSubreceta[]>();
    if (error) throw errorDeBase(error);
    return data.map(mapSubreceta);
  }

  async crearSubreceta(input: CrearSubrecetaInput): Promise<SubrecetaDto> {
    validarSubreceta(input);
    const client = this.supabase.getClient();

    const { data: subreceta, error } = await client
      .from('subrecetas')
      .insert(payloadSubreceta(input))
      .select('id')
      .single<{ id: string }>();
    if (error) throw errorDeBase(error);

    await this.reemplazarComponentes(
      client,
      {
        tabla: 'subreceta_componentes',
        columnaPadre: 'subreceta_id',
        padreId: subreceta.id,
      },
      filasComponentesSubreceta(subreceta.id, input.componentes),
    );
    await this.recalcularCostoSubreceta(client, subreceta.id);
    return this.obtenerSubreceta(client, subreceta.id);
  }

  async editarSubreceta(
    id: string,
    input: CrearSubrecetaInput,
  ): Promise<SubrecetaDto> {
    validarSubreceta(input);
    const client = this.supabase.getClient();

    const { error, count } = await client
      .from('subrecetas')
      .update(payloadSubreceta(input), { count: 'exact' })
      .eq('id', id);
    if (error) throw errorDeBase(error);
    if (!count) throw new NotFoundException('Subreceta no encontrada.');

    await this.reemplazarComponentes(
      client,
      {
        tabla: 'subreceta_componentes',
        columnaPadre: 'subreceta_id',
        padreId: id,
      },
      filasComponentesSubreceta(id, input.componentes),
    );
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
      .order('nombre')
      .returns<FilaReceta[]>();
    if (error) throw errorDeBase(error);
    return data.map(mapReceta);
  }

  async crearReceta(input: CrearRecetaInput): Promise<RecetaDto> {
    validarReceta(input);
    const client = this.supabase.getClient();

    const { data: receta, error } = await client
      .from('recetas')
      .insert(payloadReceta(input))
      .select('id')
      .single<{ id: string }>();
    if (error) throw errorDeBase(error);

    await this.reemplazarComponentes(
      client,
      {
        tabla: 'receta_componentes',
        columnaPadre: 'receta_id',
        padreId: receta.id,
      },
      filasComponentesReceta(receta.id, input.componentes),
    );
    await this.recalcularCostoReceta(client, receta.id);
    return this.obtenerReceta(client, receta.id);
  }

  async editarReceta(id: string, input: CrearRecetaInput): Promise<RecetaDto> {
    validarReceta(input);
    const client = this.supabase.getClient();

    const { error, count } = await client
      .from('recetas')
      .update(payloadReceta(input), { count: 'exact' })
      .eq('id', id);
    if (error) throw errorDeBase(error);
    if (!count) throw new NotFoundException('Receta no encontrada.');

    await this.reemplazarComponentes(
      client,
      { tabla: 'receta_componentes', columnaPadre: 'receta_id', padreId: id },
      filasComponentesReceta(id, input.componentes),
    );
    await this.recalcularCostoReceta(client, id);
    return this.obtenerReceta(client, id);
  }

  // ---------- privado ----------

  private async reemplazarComponentes(
    client: SupabaseClient,
    destino: DestinoComponentes,
    filas: object[],
  ): Promise<void> {
    const { error: deleteError } = await client
      .from(destino.tabla)
      .delete()
      .eq(destino.columnaPadre, destino.padreId);
    if (deleteError) throw errorDeBase(deleteError);

    const { error: insertError } = await client
      .from(destino.tabla)
      .insert(filas);
    if (insertError) throw errorDeBase(insertError);
  }

  private async recalcularCostoSubreceta(
    client: SupabaseClient,
    subrecetaId: string,
  ): Promise<void> {
    const { data, error } = await client
      .from('subreceta_componentes')
      .select('cantidad_necesaria_g, insumos(costo_unitario_g)')
      .eq('subreceta_id', subrecetaId)
      .returns<FilaCostoSubreceta[]>();
    if (error) throw errorDeBase(error);

    const { error: updateError } = await client
      .from('subrecetas')
      .update({ costo_calculado: costoDeSubreceta(data) })
      .eq('id', subrecetaId);
    if (updateError) throw errorDeBase(updateError);
  }

  private async recalcularCostoReceta(
    client: SupabaseClient,
    recetaId: string,
  ): Promise<void> {
    const { data, error } = await client
      .from('receta_componentes')
      .select(
        'tipo_componente, cantidad_necesaria_g, insumos(costo_unitario_g), subrecetas(costo_calculado, rendimiento_g)',
      )
      .eq('receta_id', recetaId)
      .returns<FilaCostoReceta[]>();
    if (error) throw errorDeBase(error);

    const { error: updateError } = await client
      .from('recetas')
      .update({ costo_calculado: costoDeReceta(data) })
      .eq('id', recetaId);
    if (updateError) throw errorDeBase(updateError);
  }

  private async recalcularCostosRecetasQueUsan(
    client: SupabaseClient,
    subrecetaId: string,
  ): Promise<void> {
    const { data, error } = await client
      .from('receta_componentes')
      .select('receta_id')
      .eq('subreceta_id', subrecetaId)
      .returns<{ receta_id: string }[]>();
    if (error) throw errorDeBase(error);

    const recetaIds = [...new Set(data.map((r) => r.receta_id))];
    for (const recetaId of recetaIds) {
      await this.recalcularCostoReceta(client, recetaId);
    }
  }

  private async obtenerSubreceta(
    client: SupabaseClient,
    id: string,
  ): Promise<SubrecetaDto> {
    const { data, error } = await client
      .from('subrecetas')
      .select(SUBRECETA_SELECT)
      .eq('id', id)
      .single<FilaSubreceta>();
    if (error) throw errorDeBase(error);
    return mapSubreceta(data);
  }

  private async obtenerReceta(
    client: SupabaseClient,
    id: string,
  ): Promise<RecetaDto> {
    const { data, error } = await client
      .from('recetas')
      .select(RECETA_SELECT)
      .eq('id', id)
      .single<FilaReceta>();
    if (error) throw errorDeBase(error);
    return mapReceta(data);
  }
}
