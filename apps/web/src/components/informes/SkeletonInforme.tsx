/**
 * Placeholder con la misma grilla que la sección Resumen: hero, KPIs y
 * gráfico ocupan su lugar definitivo, así nada salta cuando llegan los datos.
 */
export default function SkeletonInforme() {
  return (
    <div className="mt-5 grid gap-3 @2xl:gap-4 @4xl:grid-cols-12" aria-hidden="true">
      <div className="skeleton h-56 rounded-3xl @4xl:col-span-5 @4xl:h-auto" />
      <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4 @2xl:gap-4 @4xl:col-span-7 @4xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-36 rounded-2xl" />
        ))}
      </div>
      <div className="skeleton h-80 rounded-2xl @4xl:col-span-8" />
      <div className="skeleton h-80 rounded-2xl @4xl:col-span-4" />
    </div>
  );
}
