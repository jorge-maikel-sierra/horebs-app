export function formatPrecio(precio: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(precio);
}

export function formatFecha(fecha: string) {
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Bogota',
  }).format(new Date(fecha));
}

export function formatGramos(gramos: number) {
  if (Math.abs(gramos) >= 1000) {
    return `${(gramos / 1000).toLocaleString('es-CO', { maximumFractionDigits: 2 })} kg`;
  }
  return `${gramos.toLocaleString('es-CO', { maximumFractionDigits: 1 })} g`;
}

export type UnidadMedida = 'g' | 'ml' | 'unidad';

/** Igual que formatGramos, pero respeta la unidad real del insumo — antes
 * todo se mostraba en gramos aunque fuera un insumo por unidad o en ml. */
export function formatCantidad(valor: number, unidad: UnidadMedida) {
  if (unidad === 'unidad') {
    return `${valor.toLocaleString('es-CO', { maximumFractionDigits: 0 })} u`;
  }
  if (unidad === 'ml') {
    if (Math.abs(valor) >= 1000) {
      return `${(valor / 1000).toLocaleString('es-CO', { maximumFractionDigits: 2 })} L`;
    }
    return `${valor.toLocaleString('es-CO', { maximumFractionDigits: 1 })} ml`;
  }
  return formatGramos(valor);
}

export function formatHora(fecha: string) {
  return new Intl.DateTimeFormat('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  }).format(new Date(fecha));
}
