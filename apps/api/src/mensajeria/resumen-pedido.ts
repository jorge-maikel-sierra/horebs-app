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
}

const ETIQUETA_MODALIDAD: Record<string, string> = {
  retiro: 'para retirar en el local',
  local: 'para comer en el local',
};

function pesos(valor: number): string {
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
  const total = subtotal + domicilio;

  const texto = [
    '*Resumen de tu pedido*',
    `Cliente: ${datos.nombreCompleto}`,
    ...datos.lineas.map(
      (l) =>
        `- ${l.cantidad}x ${l.productoNombre}${l.varianteNombre ? ` (${l.varianteNombre})` : ''}: ${pesos(l.precioUnitario * l.cantidad)}`,
    ),
    esDomicilio
      ? `Domicilio a ${datos.direccion ?? 'dirección sin especificar'}: ${pesos(domicilio)}`
      : `Modalidad: ${ETIQUETA_MODALIDAD[datos.modalidad] ?? datos.modalidad}`,
    `*Total: ${pesos(total)}*`,
  ].join('\n');

  return { texto, total };
}
