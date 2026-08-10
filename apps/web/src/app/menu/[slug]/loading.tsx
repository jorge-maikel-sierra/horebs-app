export default function CargandoProducto() {
  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="skeleton h-4 w-32" />
      <div className="skeleton mt-4 h-9 w-4/5" />
      <div className="skeleton mt-6 h-72 w-full sm:h-96" />
      <div className="skeleton mt-6 h-5 w-full" />
      <div className="skeleton mt-2 h-5 w-2/3" />
      <div className="mt-6 space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <div className="skeleton h-5 w-32" />
            <div className="skeleton h-5 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
