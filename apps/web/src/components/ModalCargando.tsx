export default function ModalCargando({ mensaje }: { mensaje: string }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 p-4 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div className="animate-pop-in flex w-full max-w-xs flex-col items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-zinc-200 border-t-brand-orange dark:border-zinc-700" />
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{mensaje}</p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
          <div className="animate-barra-cargando h-full w-1/3 rounded-full bg-brand-orange" />
        </div>
      </div>
    </div>
  );
}
