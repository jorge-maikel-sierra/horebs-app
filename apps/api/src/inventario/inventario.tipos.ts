export interface ItemVendido {
  variante_id: string;
  cantidad: number;
}

export interface MovimientoCalculado {
  insumo_id: string;
  cantidad_g: number;
}

export type TipoMovimientoPedido = 'venta' | 'reversion';

export interface FilaComponenteSubreceta {
  insumo_id: string;
  cantidad_necesaria_g: number;
}

export interface FilaComponenteReceta {
  tipo_componente: 'insumo' | 'subreceta';
  insumo_id: string | null;
  subreceta_id: string | null;
  cantidad_necesaria_g: number;
  subrecetas: {
    rendimiento_g: number;
    subreceta_componentes: FilaComponenteSubreceta[] | null;
  } | null;
}

export interface FilaRecetaExplosion {
  variante_id: string;
  receta_componentes: FilaComponenteReceta[] | null;
}

export const RECETA_EXPLOSION_SELECT =
  'variante_id, receta_componentes(tipo_componente, insumo_id, subreceta_id, cantidad_necesaria_g, subrecetas(rendimiento_g, subreceta_componentes(insumo_id, cantidad_necesaria_g)))';
