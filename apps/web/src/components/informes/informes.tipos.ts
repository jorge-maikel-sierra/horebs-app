import type { ClienteLista } from '@/components/informes/ModalClientes';

export type InformeDia = { fecha: string; total: number; pedidos: number };
export type InformeDesglose = { clave: string; total: number; pedidos: number };
export type InformeProducto = { nombre: string; cantidad: number; total: number };
export type InformeCategoria = { nombre: string; cantidad: number; total: number };
export type InformeClienteDia = { fecha: string; nuevos: number };
export type InformeClienteTop = {
  id: string;
  nombre: string;
  telefono: string | null;
  pedidos: number;
  total: number;
};

export type InformeBot = {
  conversaciones: number;
  pedidos: number;
  ventas: number;
  ticket_promedio: number;
  conversion: number;
  entregados: number;
  cancelados: number;
  derivaciones: number;
  repetir_toques: number;
  recompras_enviadas: number;
  reservas: number;
  comprobantes: number;
  serie_diaria: InformeDia[];
};

export type InformeDto = {
  desde: string;
  hasta: string;
  resumen: {
    ventas_brutas: number;
    promedio_diario: number;
    pedidos: number;
    articulos_vendidos: number;
    ticket_promedio: number;
    costo_domicilio_total: number;
  };
  serie_diaria: InformeDia[];
  por_metodo_pago: InformeDesglose[];
  por_modalidad: InformeDesglose[];
  por_canal: InformeDesglose[];
  por_origen: InformeDesglose[];
  top_productos: InformeProducto[];
  por_categoria: InformeCategoria[];
  clientes: {
    nuevos: number;
    recurrentes: number;
    ticket_promedio: number;
    serie_diaria_nuevos: InformeClienteDia[];
    top_clientes: InformeClienteTop[];
    lista_nuevos?: ClienteLista[];
    lista_recurrentes?: ClienteLista[];
  };
  /** Opcional: un API anterior al bot no lo manda. */
  bot?: InformeBot;
};

/** Lo que cada sección necesita para pintar valores y comparaciones. */
export type ContextoSeccion = {
  informe: InformeDto;
  anterior: InformeDto | null;
  /** "los 7 días anteriores": texto de las comparaciones ▲/▼. */
  vs: string;
  /** "12 nov – 18 nov de 2026". */
  etiqueta: string;
};

export const METODO_PAGO_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
};

export const MODALIDAD_LABEL: Record<string, string> = {
  domicilio: 'Domicilio',
  retiro: 'Para llevar',
  local: 'Comer en el local',
};

export const CANAL_LABEL: Record<string, string> = {
  web: 'Pedidos web',
  pos: 'Mostrador (POS)',
  whatsapp: 'Bot de WhatsApp',
  messenger: 'Bot de Messenger',
  instagram: 'Bot de Instagram',
};

export function plural(n: number, singular: string, pluralTxt = `${singular}s`) {
  return `${n} ${n === 1 ? singular : pluralTxt}`;
}
