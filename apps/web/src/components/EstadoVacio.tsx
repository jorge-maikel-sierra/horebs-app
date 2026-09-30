import type { ReactNode } from 'react';

function IconCaja() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 8 12 3 3 8l9 5 9-5Z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
  );
}

export default function EstadoVacio({
  children,
  icon,
}: {
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="animate-fade-up mt-8 flex flex-col items-center gap-3 py-4 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-600">
        {icon ?? <IconCaja />}
      </span>
      <p className="text-zinc-600 dark:text-zinc-400">{children}</p>
    </div>
  );
}
