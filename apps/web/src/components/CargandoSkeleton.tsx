/**
 * Placeholder de carga que reserva aproximadamente el alto del contenido
 * real (listas/tablas admin) para evitar el salto de layout (CLS) que deja
 * un simple texto "Cargando…" cuando el fetch resuelve y el contenido real
 * (mucho más alto) lo reemplaza de golpe.
 */
export default function CargandoSkeleton({ filas = 6 }: { filas?: number }) {
  return (
    <div className="mt-6 space-y-3" aria-hidden="true">
      {Array.from({ length: filas }).map((_, i) => (
        <div key={i} className="skeleton h-14 w-full rounded-lg" />
      ))}
    </div>
  );
}
