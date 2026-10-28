export interface InformeBotDto {
  /** Conversaciones distintas con al menos un mensaje del cliente en el rango. */
  conversaciones: number;
  /** Pedidos del bot no cancelados. */
  pedidos: number;
  ventas: number;
  ticket_promedio: number;
  /** pedidos / conversaciones (0 a 1). */
  conversion: number;
  entregados: number;
  cancelados: number;
  derivaciones: number;
  /** Toques de "Sí, lo mismo" y "🍕 Pedir lo mismo". */
  repetir_toques: number;
  recompras_enviadas: number;
  reservas: number;
  comprobantes: number;
}

export interface PedidoBotFila {
  total: number;
  estado: string;
  reserva: boolean;
  comprobante: boolean;
}

/** Textos exactos de los botones de "repetir" (así se guardan en el historial). */
export const TEXTOS_REPETIR = ['Sí, lo mismo', '🍕 Pedir lo mismo'];

/**
 * Embudo del bot en un rango: todo sale de las tablas (conversaciones,
 * mensajes y pedidos canal 'whatsapp'), nada estimado.
 */
export function agregarMetricasBot(datos: {
  pedidos: PedidoBotFila[];
  conversacionesConMensaje: string[];
  derivaciones: number;
  repetirToques: number;
  recomprasEnviadas: number;
}): InformeBotDto {
  const vigentes = datos.pedidos.filter((p) => p.estado !== 'cancelado');
  const ventas = vigentes.reduce((suma, p) => suma + Number(p.total), 0);
  const conversaciones = new Set(datos.conversacionesConMensaje).size;
  return {
    conversaciones,
    pedidos: vigentes.length,
    ventas,
    ticket_promedio: vigentes.length > 0 ? ventas / vigentes.length : 0,
    conversion: conversaciones > 0 ? vigentes.length / conversaciones : 0,
    entregados: datos.pedidos.filter((p) => p.estado === 'entregado').length,
    cancelados: datos.pedidos.length - vigentes.length,
    derivaciones: datos.derivaciones,
    repetir_toques: datos.repetirToques,
    recompras_enviadas: datos.recomprasEnviadas,
    reservas: vigentes.filter((p) => p.reserva).length,
    comprobantes: vigentes.filter((p) => p.comprobante).length,
  };
}
