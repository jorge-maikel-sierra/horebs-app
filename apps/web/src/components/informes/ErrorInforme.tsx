export default function ErrorInforme({
  mensaje,
  onReintentar,
}: {
  mensaje: string;
  onReintentar: () => void;
}) {
  return (
    <div
      role="alert"
      className="mt-6 flex flex-col items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 @xl:flex-row @xl:items-center @xl:justify-between dark:border-red-900/60 dark:bg-red-950/30"
    >
      <div>
        <p className="text-sm font-semibold text-red-700 dark:text-red-400">
          No pudimos cargar el informe
        </p>
        <p className="mt-0.5 text-sm text-red-600 dark:text-red-400">{mensaje}</p>
      </div>
      <button
        type="button"
        onClick={onReintentar}
        className="btn-press h-10 shrink-0 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700"
      >
        Reintentar
      </button>
    </div>
  );
}
