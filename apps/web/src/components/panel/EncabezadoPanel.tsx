'use client';

import type { Rol } from '@/lib/use-rol';

const HORA_BOGOTA = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  hour12: false,
  timeZone: 'America/Bogota',
});
const FECHA_LARGA = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'America/Bogota',
});

function saludo(ahora: Date) {
  // hour12:false puede devolver "24" a medianoche en algunos motores.
  const hora = Number(HORA_BOGOTA.format(ahora)) % 24;
  if (hora < 12) return 'Buenos días';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export default function EncabezadoPanel({ rol }: { rol: Rol | null }) {
  const ahora = new Date();
  return (
    <header className="animate-fade-up">
      <p className="text-sm font-semibold text-brand-orange-700 first-letter:uppercase dark:text-brand-orange">
        {FECHA_LARGA.format(ahora)}
      </p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
        {saludo(ahora)}
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Así va Pizzería Horebs
        {rol && (
          <>
            {' '}
            · sesión de{' '}
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              {rol === 'admin' ? 'administrador' : 'empleado'}
            </span>
          </>
        )}
        .
      </p>
    </header>
  );
}
