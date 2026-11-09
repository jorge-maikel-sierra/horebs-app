import {
  descuentoSobrePizzas,
  textoDescuentoAplicado,
} from '../common/promocion';
import { esAdicional } from './adicionales';

export interface LineaPedido {
  cantidad: number;
  productoNombre: string;
  /** null cuando el producto tiene una sola variante: no se muestra. */
  varianteNombre: string | null;
  precioUnitario: number;
}

export interface DatosResumenPedido {
  nombreCompleto: string;
  lineas: LineaPedido[];
  modalidad: string;
  direccion: string | null;
  costoDomicilio: number;
  /** "lo antes posible" o "6:30 p.m. (reserva)". */
  entrega?: string;
  /** Nota del pedido (ej. qué sabores lleva una pizza mitad y mitad). */
  nota?: string;
  /** Aplica el descuento del 20% a las pizzas (nunca al domicilio). */
  promocion?: boolean;
}

const ETIQUETA_MODALIDAD: Record<string, string> = {
  retiro: 'para retirar en el local',
  local: 'para comer en el local',
};

export function pesos(valor: number): string {
  return `$${valor.toLocaleString('es-CO')}`;
}

/**
 * Resumen que recibe el cliente, armado por código y no por el modelo: en
 * producción el modelo llegó a cambiar el total, agregar sabores que no
 * existen ("Jugo Hit - Mango") e inventar datos de pago al reescribirlo.
 * Precios y total salen solo de la base.
 */
export function armarResumenPedido(datos: DatosResumenPedido): {
  texto: string;
  total: number;
} {
  const subtotal = datos.lineas.reduce(
    (suma, l) => suma + l.precioUnitario * l.cantidad,
    0,
  );
  const esDomicilio = datos.modalidad === 'domicilio';
  const domicilio = esDomicilio ? datos.costoDomicilio : 0;
  const descuento = datos.promocion
    ? descuentoSobrePizzas(
        datos.lineas.map((l) => ({
          producto_nombre: l.productoNombre,
          variante_nombre: l.varianteNombre,
          subtotal: l.precioUnitario * l.cantidad,
        })),
      )
    : 0;
  const total = subtotal - descuento + domicilio;
  const adicionales = datos.lineas
    .filter((l) => esAdicional(l.productoNombre))
    .reduce((suma, l) => suma + l.precioUnitario * l.cantidad, 0);

  const texto = [
    '*Resumen de tu pedido*',
    `Cliente: ${datos.nombreCompleto}`,
    ...datos.lineas.map(
      (l) =>
        `- ${l.cantidad}x ${l.productoNombre}${l.varianteNombre ? ` (${l.varianteNombre})` : ''}: ${pesos(l.precioUnitario * l.cantidad)}`,
    ),
    adicionales > 0 ? `Adicionales: ${pesos(adicionales)}` : null,
    descuento > 0 ? textoDescuentoAplicado(descuento) : null,
    esDomicilio
      ? `Domicilio a ${datos.direccion ?? 'dirección sin especificar'}: ${pesos(domicilio)}`
      : `Modalidad: ${ETIQUETA_MODALIDAD[datos.modalidad] ?? datos.modalidad}`,
    datos.entrega ? `Entrega: ${datos.entrega}` : null,
    datos.nota ? `Nota: ${datos.nota}` : null,
    `*Total: ${pesos(total)}*`,
  ]
    .filter((l) => l !== null)
    .join('\n');

  return { texto, total };
}
