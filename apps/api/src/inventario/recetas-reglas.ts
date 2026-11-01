import { BadRequestException } from '@nestjs/common';
import type {
  CrearRecetaInput,
  CrearSubrecetaInput,
  FilaCostoReceta,
  FilaCostoSubreceta,
  FilaReceta,
  FilaSubreceta,
  RecetaComponenteInput,
  RecetaDto,
  SubrecetaComponenteInput,
  SubrecetaDto,
} from './recetas.tipos';

function esCantidadValida(cantidad: number | undefined): boolean {
  return Boolean(cantidad) && (cantidad as number) > 0;
}

function validarComponenteSubreceta(c: SubrecetaComponenteInput): void {
  if (!c.insumo_id || !esCantidadValida(c.cantidad_necesaria_g)) {
    throw new BadRequestException('Componente de subreceta inválido.');
  }
}

export function validarSubreceta(input: CrearSubrecetaInput): void {
  if (!input.nombre?.trim()) {
    throw new BadRequestException('Falta el nombre de la subreceta.');
  }
  if (!esCantidadValida(input.rendimiento_g)) {
    throw new BadRequestException('El rendimiento debe ser mayor a cero.');
  }
  if (!Array.isArray(input.componentes) || input.componentes.length === 0) {
    throw new BadRequestException('La subreceta necesita al menos un insumo.');
  }
  input.componentes.forEach(validarComponenteSubreceta);
}

function validarComponenteReceta(c: RecetaComponenteInput): void {
  if (!esCantidadValida(c.cantidad_necesaria_g)) {
    throw new BadRequestException('Cantidad inválida en un componente.');
  }
  if (c.tipo_componente === 'insumo' && !c.insumo_id) {
    throw new BadRequestException('Falta el insumo en un componente.');
  }
  if (c.tipo_componente === 'subreceta' && !c.subreceta_id) {
    throw new BadRequestException('Falta la subreceta en un componente.');
  }
}

export function validarReceta(input: CrearRecetaInput): void {
  if (!input.nombre?.trim()) {
    throw new BadRequestException('Falta el nombre de la receta.');
  }
  if (!Array.isArray(input.componentes) || input.componentes.length === 0) {
    throw new BadRequestException('La receta necesita al menos un componente.');
  }
  input.componentes.forEach(validarComponenteReceta);
}

/** Las columnas de `subrecetas` que escribe el panel (sin sus componentes). */
export function payloadSubreceta(input: CrearSubrecetaInput): {
  nombre: string;
  descripcion: string | null;
  rendimiento_g: number;
} {
  return {
    nombre: input.nombre.trim(),
    descripcion: input.descripcion?.trim() || null,
    rendimiento_g: input.rendimiento_g,
  };
}

/** Las columnas de `recetas` que escribe el panel (sin sus componentes). */
export function payloadReceta(input: CrearRecetaInput): {
  variante_id: string | null;
  nombre: string;
  descripcion: string | null;
  rendimiento_g: number | null;
  activa: boolean;
} {
  return {
    variante_id: input.variante_id || null,
    nombre: input.nombre.trim(),
    descripcion: input.descripcion?.trim() || null,
    rendimiento_g: input.rendimiento_g ?? null,
    activa: input.activa ?? true,
  };
}

export function filasComponentesSubreceta(
  subrecetaId: string,
  componentes: SubrecetaComponenteInput[],
): object[] {
  return componentes.map((c) => ({
    subreceta_id: subrecetaId,
    insumo_id: c.insumo_id,
    cantidad_necesaria_g: c.cantidad_necesaria_g,
  }));
}

/** Un componente guarda solo el id de su tipo; el otro queda en null. */
export function filasComponentesReceta(
  recetaId: string,
  componentes: RecetaComponenteInput[],
): object[] {
  return componentes.map((c) => ({
    receta_id: recetaId,
    tipo_componente: c.tipo_componente,
    insumo_id: c.tipo_componente === 'insumo' ? c.insumo_id : null,
    subreceta_id: c.tipo_componente === 'subreceta' ? c.subreceta_id : null,
    cantidad_necesaria_g: c.cantidad_necesaria_g,
  }));
}

export function costoDeSubreceta(componentes: FilaCostoSubreceta[]): number {
  return componentes.reduce(
    (acc, c) =>
      acc + c.cantidad_necesaria_g * (c.insumos?.costo_unitario_g ?? 0),
    0,
  );
}

/**
 * Un insumo cuesta lo que dice su costo por gramo; una subreceta, su costo
 * repartido entre los gramos que rinde. Sin rendimiento no se puede repartir
 * y ese componente no suma.
 */
export function costoDeReceta(componentes: FilaCostoReceta[]): number {
  return componentes.reduce((acc, c) => {
    if (c.tipo_componente === 'insumo') {
      return acc + c.cantidad_necesaria_g * (c.insumos?.costo_unitario_g ?? 0);
    }
    const rendimiento = c.subrecetas?.rendimiento_g;
    if (!rendimiento) return acc;
    const costoPorGramo = (c.subrecetas?.costo_calculado ?? 0) / rendimiento;
    return acc + c.cantidad_necesaria_g * costoPorGramo;
  }, 0);
}

export function mapSubreceta(s: FilaSubreceta): SubrecetaDto {
  return {
    id: s.id,
    nombre: s.nombre,
    descripcion: s.descripcion,
    rendimiento_g: s.rendimiento_g,
    costo_calculado: s.costo_calculado,
    componentes: (s.subreceta_componentes ?? []).map((c) => ({
      insumo_id: c.insumo_id,
      insumo_nombre: c.insumos?.nombre ?? '',
      cantidad_necesaria_g: c.cantidad_necesaria_g,
    })),
  };
}

export function mapReceta(r: FilaReceta): RecetaDto {
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
    componentes: (r.receta_componentes ?? []).map((c) => ({
      tipo_componente: c.tipo_componente,
      insumo_id: c.insumo_id,
      insumo_nombre: c.insumos?.nombre ?? null,
      subreceta_id: c.subreceta_id,
      subreceta_nombre: c.subrecetas?.nombre ?? null,
      cantidad_necesaria_g: c.cantidad_necesaria_g,
    })),
  };
}
