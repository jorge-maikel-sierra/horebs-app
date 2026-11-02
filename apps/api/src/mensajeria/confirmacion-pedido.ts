import { etiquetaHora } from '../common/horario';
import { idCortoPedido } from '../common/pedido-numero';
import { INICIO_CONFIRMACION_PEDIDO } from './aviso-equipo.service';
import type { MetodoPagoBot } from './checkout-whatsapp';
import { pesos } from './resumen-pedido';

// Dato confirmado en CLAUDE.md — el mismo que muestra el sitio web en la
// confirmación de un pedido con transferencia (apps/web/src/lib/negocio.ts).
const TRANSFERENCIA = { banco: 'Nu', llave: '1118843420' };

/** Qué le decimos del cobro según el método; con tarjeta, el enlace de Bold. */
function lineasDeCobro(
  metodo: MetodoPagoBot,
  enlacePago: string | null | undefined,
): string[] {
  if (metodo !== 'tarjeta') {
    return [
      'Te aviso por acá cuando lo confirmemos y cuando vaya en camino 🍕',
    ];
  }
  if (enlacePago) {
    return [
      `Para confirmarlo, paga con tarjeta aquí 👇\n${enlacePago}`,
      'Apenas se acredite el pago te aviso y lo preparamos 🍕',
    ];
  }
  return [
    'Una persona del equipo te escribe por acá con el enlace para pagar con tarjeta 🍕',
  ];
}

/** Mensaje de confirmación al cliente; con transferencia incluye la llave. */
export function textoConfirmacionPedido(datos: {
  nombre: string | undefined;
  pedido: { id: string; total: number };
  programadoPara: string | null | undefined;
  metodo: MetodoPagoBot;
  /** Link de pago de Bold, cuando el cliente eligió tarjeta y se pudo generar. */
  enlacePago?: string | null;
}): string {
  const { nombre, pedido, programadoPara, metodo, enlacePago } = datos;
  return [
    `${INICIO_CONFIRMACION_PEDIDO} ${nombre}! Recibimos tu pedido *#${idCortoPedido(pedido.id)}* por *${pesos(pedido.total)}*.`,
    programadoPara
      ? `🕒 Quedó reservado para las *${etiquetaHora(programadoPara)}*.`
      : null,
    ...lineasDeCobro(metodo, enlacePago),
    metodo === 'transferencia'
      ? `\nPara transferir: *Banco ${TRANSFERENCIA.banco}*, llave *${TRANSFERENCIA.llave}*. Mandanos el comprobante por acá.`
      : null,
  ]
    .filter((l) => l !== null)
    .join('\n');
}
