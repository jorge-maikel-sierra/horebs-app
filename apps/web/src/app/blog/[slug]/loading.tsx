export default function CargandoArticulo() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      <div className="skeleton h-4 w-24" />
      <div className="skeleton mt-4 h-9 w-4/5" />
      <div className="skeleton mt-6 h-72 w-full sm:h-96" />
      <div className="mt-8 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-4" style={{ width: `${90 - i * 6}%` }} />
        ))}
      </div>
    </div>
  );
}
