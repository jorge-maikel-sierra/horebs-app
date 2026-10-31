import type { PedidoUnificado } from './informes.tipos';

interface ClienteAnidado {
  telefono: string | null;
  nombre: string;
  apellido: string | null;
}

/** Fila de `pedidos` con su cliente (`clientes(telefono, nombre, apellido)`). */
export interface PedidoVivoFila {
  id: string;
  total: number;
  costo_domicilio: number | null;
  metodo_pago: string;
  modalidad: string;
  canal: string;
  created_at: string;
  clientes: ClienteAnidado | null;
}

/** Fila de `historico_pedidos` (WooCommerce) con su cliente migrado. */
export interface PedidoHistoricoFila {
  id: string;
  total: number;
  metodo_pago: string;
  modalidad: string;
  canal: string;
  creado_en: string;
  historico_clientes: ClienteAnidado | null;
}

const nombreDe = (cliente: ClienteAnidado | null): string | null =>
  cliente ? `${cliente.nombre} ${cliente.apellido ?? ''}`.trim() : null;

export function unificarPedidoVivo(p: PedidoVivoFila): PedidoUnificado {
  return {
    id: p.id,
    total: p.total,
    costo_domicilio: p.costo_domicilio ?? 0,
    metodo_pago: p.metodo_pago,
    modalidad: p.modalidad,
    canal: p.canal,
    creado_en: p.created_at,
    telefono: p.clientes?.telefono ?? null,
    nombre_cliente: nombreDe(p.clientes),
  };
}

/** El histórico no guarda costo de domicilio: cuenta como 0. */
export function unificarPedidoHistorico(
  p: PedidoHistoricoFila,
): PedidoUnificado {
  return {
    id: p.id,
    total: p.total,
    costo_domicilio: 0,
    metodo_pago: p.metodo_pago,
    modalidad: p.modalidad,
    canal: p.canal,
    creado_en: p.creado_en,
    telefono: p.historico_clientes?.telefono ?? null,
    nombre_cliente: nombreDe(p.historico_clientes),
  };
}
