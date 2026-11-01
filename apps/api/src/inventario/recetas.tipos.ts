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

export type TipoComponente = 'insumo' | 'subreceta';

export interface RecetaComponenteInput {
  tipo_componente: TipoComponente;
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
    tipo_componente: TipoComponente;
    insumo_id: string | null;
    insumo_nombre: string | null;
    subreceta_id: string | null;
    subreceta_nombre: string | null;
    cantidad_necesaria_g: number;
  }[];
}

/** La fila que devuelve `SUBRECETA_SELECT`, con sus joins. */
export interface FilaSubreceta {
  id: string;
  nombre: string;
  descripcion: string | null;
  rendimiento_g: number;
  costo_calculado: number;
  subreceta_componentes:
    | {
        insumo_id: string;
        cantidad_necesaria_g: number;
        insumos: { nombre: string } | null;
      }[]
    | null;
}

/** La fila que devuelve `RECETA_SELECT`, con sus joins. */
export interface FilaReceta {
  id: string;
  variante_id: string | null;
  nombre: string;
  descripcion: string | null;
  rendimiento_g: number | null;
  activa: boolean;
  costo_calculado: number;
  variantes_producto: {
    nombre: string;
    productos: { nombre: string } | null;
  } | null;
  receta_componentes:
    | {
        tipo_componente: TipoComponente;
        insumo_id: string | null;
        subreceta_id: string | null;
        cantidad_necesaria_g: number;
        insumos: { nombre: string } | null;
        subrecetas: { nombre: string } | null;
      }[]
    | null;
}

/** Lo que se lee de cada componente de una subreceta para recalcular su costo. */
export interface FilaCostoSubreceta {
  cantidad_necesaria_g: number;
  insumos: { costo_unitario_g: number | null } | null;
}

/** Lo que se lee de cada componente de una receta para recalcular su costo. */
export interface FilaCostoReceta {
  tipo_componente: TipoComponente;
  cantidad_necesaria_g: number;
  insumos: { costo_unitario_g: number | null } | null;
  subrecetas: {
    costo_calculado: number | null;
    rendimiento_g: number | null;
  } | null;
}

export const SUBRECETA_SELECT =
  'id, nombre, descripcion, rendimiento_g, costo_calculado, subreceta_componentes(insumo_id, cantidad_necesaria_g, insumos(nombre))';
export const RECETA_SELECT =
  'id, variante_id, nombre, descripcion, rendimiento_g, activa, costo_calculado, variantes_producto(nombre, productos(nombre)), receta_componentes(tipo_componente, insumo_id, subreceta_id, cantidad_necesaria_g, insumos(nombre), subrecetas(nombre))';
