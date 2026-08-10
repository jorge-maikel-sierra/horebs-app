export default function CargandoCatalogo() {
  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="skeleton h-9 w-40" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <div className="skeleton -mx-4 -mt-4 mb-3 h-40 w-[calc(100%+2rem)]" />
            <div className="skeleton h-5 w-2/3" />
            <div className="skeleton mt-2 h-4 w-full" />
            <div className="skeleton mt-1 h-4 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
