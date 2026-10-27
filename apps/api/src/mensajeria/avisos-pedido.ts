const HORA_MS = 60 * 60 * 1000;
/** Ventana gratis de WhatsApp para mensajes de sesión. */
export const VENTANA_SESION_MS = 24 * HORA_MS;
// La invitación a repetir sale en la última hora de la ventana: sin
// plantilla paga, después de las 24h ya no se le puede escribir.
const INICIO_RECOMPRA_MS = 23 * HORA_MS;

export interface PuntosRecompra {
  /** Puntos que sumó el pedido entregado. */
  ganados: number;
  /** Saldo actual del cliente. */
  saldo: number;
  valorPuntoPesos: number;
  minimoCanje: number;
}

function pesos(valor: number): string {
  return `$${valor.toLocaleString('es-CO')}`;
}

/**
 * Invitación a repetir, al día siguiente de la compra. Los puntos van acá y
 * no en el resumen del pedido: son la excusa para volver a comprar.
 */
export function textoRecompra(puntos: PuntosRecompra | null): string {
  const lineaPuntos =
    puntos && (puntos.ganados > 0 || puntos.saldo > 0)
      ? puntos.saldo >= puntos.minimoCanje
        ? `⭐ Con esa compra sumaste ${puntos.ganados} puntos y ya tenés ${puntos.saldo}: son *${pesos(puntos.saldo * puntos.valorPuntoPesos)}* para tu próxima compra.`
        : `⭐ Con esa compra sumaste ${puntos.ganados} puntos y ya vas en ${puntos.saldo}. Desde ${puntos.minimoCanje} los podés cambiar por descuento.`
      : null;
  return [
    '¿Qué tal estuvo tu pedido? 🍕',
    lineaPuntos,
    'Si te quedaste con ganas, repetilo con un toque 👇',
  ]
    .filter((l) => l !== null)
    .join('\n');
}

export interface PedidoParaAviso {
  id: string;
  estado: string;
  modalidad: string;
  direccionEntrega: string | null;
}

/**
 * Texto fijo por estado — nunca lo escribe el modelo. null para estados
 * sin aviso (pendiente: el cliente ya recibió la confirmación del pedido).
 */
export function textoAvisoEstado(p: PedidoParaAviso): string | null {
  const numero = `#${p.id.slice(0, 8)}`;
  switch (p.estado) {
    case 'confirmado':
      return `✅ ¡Confirmamos tu pedido *${numero}*! Ya lo estamos preparando.`;
    case 'en_preparacion':
      return `🔥 Tu pedido *${numero}* ya está en el horno.`;
    case 'en_camino':
      return p.direccionEntrega
        ? `🛵 Tu pedido *${numero}* va en camino a ${p.direccionEntrega}.`
        : `🛵 Tu pedido *${numero}* va en camino.`;
    case 'entregado':
      return p.modalidad === 'domicilio'
        ? `¡Que lo disfrutes! 🍕 Gracias por pedirnos.`
        : `🍕 Tu pedido *${numero}* está listo. ¡Que lo disfrutes!`;
    case 'cancelado':
      return `Tu pedido *${numero}* fue cancelado. Si es un error, escribinos por acá.`;
    default:
      return null;
  }
}

/** ¿El cliente escribió hace menos de 24h? Fuera de eso Meta descarta el mensaje. */
export function dentroDeLaVentana(
  ultimaInteraccion: Date,
  ahora: Date,
): boolean {
  return ahora.getTime() - ultimaInteraccion.getTime() < VENTANA_SESION_MS;
}

/** Última hora de la ventana: entre 23h y 24h desde el último mensaje del cliente. */
export function enVentanaDeRecompra(
  ultimaInteraccion: Date,
  ahora: Date,
): boolean {
  const transcurrido = ahora.getTime() - ultimaInteraccion.getTime();
  return transcurrido >= INICIO_RECOMPRA_MS && transcurrido < VENTANA_SESION_MS;
}
