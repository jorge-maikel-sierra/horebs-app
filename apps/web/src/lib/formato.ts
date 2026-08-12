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
  }).format(new Date(fecha));
}

export function formatGramos(gramos: number) {
  if (Math.abs(gramos) >= 1000) {
    return `${(gramos / 1000).toLocaleString('es-CO', { maximumFractionDigits: 2 })} kg`;
  }
  return `${gramos.toLocaleString('es-CO', { maximumFractionDigits: 1 })} g`;
}

export function formatHora(fecha: string) {
  return new Intl.DateTimeFormat('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(fecha));
}
