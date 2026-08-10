export default function CargandoBlog() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      <div className="skeleton h-9 w-24" />
      <div className="skeleton mt-3 h-5 w-2/3" />

      <div className="mt-8 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex gap-4 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <div className="skeleton h-24 w-24 shrink-0" />
            <div className="flex-1">
              <div className="skeleton h-5 w-3/4" />
              <div className="skeleton mt-2 h-4 w-full" />
              <div className="skeleton mt-1 h-4 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
