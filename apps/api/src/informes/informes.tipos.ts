import type { InformeBotDto } from './metricas-bot';

/** Contrato de `GET /informes`: lo que devuelve el API y lee el panel. */

export type Granularidad = 'dia' | 'mes';

export interface InformeDiaDto {
  fecha: string;
  total: number;
  pedidos: number;
}

export interface InformeDesgloseDto {
  clave: string;
  total: number;
  pedidos: number;
}

export interface InformeProductoDto {
  nombre: string;
  cantidad: number;
  total: number;
}

export interface InformeCategoriaDto {
  nombre: string;
  cantidad: number;
  total: number;
}

export interface InformeClienteDiaDto {
  fecha: string;
  nuevos: number;
}

export interface InformeClienteTopDto {
  id: string;
  nombre: string;
  telefono: string | null;
  pedidos: number;
  total: number;
}

export interface InformeClienteListaDto extends InformeClienteTopDto {
  primera_compra: string;
}

export interface InformeClientesDto {
  nuevos: number;
  recurrentes: number;
  ticket_promedio: number;
  serie_diaria_nuevos: InformeClienteDiaDto[];
  top_clientes: InformeClienteTopDto[];
  /** Los más recientes primero; recortada a MAX_LISTA_CLIENTES. */
  lista_nuevos: InformeClienteListaDto[];
  /** Los de mayor gasto primero; recortada a MAX_LISTA_CLIENTES. */
  lista_recurrentes: InformeClienteListaDto[];
}

export const MAX_LISTA_CLIENTES = 100;

export interface InformeDto {
  desde: string;
  hasta: string;
  granularidad: Granularidad;
  resumen: {
    ventas_brutas: number;
    promedio_diario: number;
    pedidos: number;
    articulos_vendidos: number;
    ticket_promedio: number;
    costo_domicilio_total: number;
  };
  serie_diaria: InformeDiaDto[];
  por_metodo_pago: InformeDesgloseDto[];
  por_modalidad: InformeDesgloseDto[];
  por_canal: InformeDesgloseDto[];
  top_productos: InformeProductoDto[];
  por_categoria: InformeCategoriaDto[];
  clientes: InformeClientesDto;
  bot: InformeBotDto & { serie_diaria: InformeDiaDto[] };
}

/** Total vendido y cantidad de pedidos de un grupo (día, mes, método de pago…). */
export type Acumulador = { total: number; pedidos: number };

/**
 * Los pedidos en vivo y los históricos (migrados de WooCommerce, ver
 * historico_pedidos) viven en tablas separadas con columnas distintas.
 * Se normalizan a esta forma común una sola vez para poder reusar toda
 * la lógica de agregación sin duplicarla por origen.
 */
export interface PedidoUnificado {
  id: string;
  total: number;
  costo_domicilio: number;
  metodo_pago: string;
  modalidad: string;
  canal: string;
  creado_en: string;
  telefono: string | null;
  nombre_cliente: string | null;
}
