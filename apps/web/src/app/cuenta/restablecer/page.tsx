'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type Estado = 'verificando' | 'listo' | 'invalido' | 'guardado';

export default function RestablecerPasswordPage() {
  const [estado, setEstado] = useState<Estado>('verificando');
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { data: subscripcion } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'PASSWORD_RECOVERY') setEstado('listo');
      },
    );

    // Si el enlace ya estableció la sesión de recuperación antes de que
    // este componente montara el listener, onAuthStateChange no vuelve a
    // disparar — confirmamos con una sesión activa como respaldo.
    const timeout = setTimeout(() => {
      supabase.auth.getSession().then(({ data }) => {
        setEstado((actual) => (actual === 'verificando' && data.session
          ? 'listo'
          : actual === 'verificando'
            ? 'invalido'
            : actual));
      });
    }, 2000);

    return () => {
      subscripcion.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (nuevaPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (nuevaPassword !== confirmarPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setEnviando(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password: nuevaPassword,
    });
    if (updateError) setError(updateError.message);
    else setEstado('guardado');
    setEnviando(false);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Restablecer contraseña
        </h1>

        {estado === 'verificando' && (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Verificando el enlace…
          </p>
        )}

        {estado === 'invalido' && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-red-600">
              Este enlace no es válido o ya expiró.
            </p>
            <Link
              href="/cuenta"
              className="text-sm text-brand-orange underline"
            >
              Volver a Mi cuenta
            </Link>
          </div>
        )}

        {estado === 'guardado' && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-brand-orange">
              Contraseña actualizada. Ya podés iniciar sesión con la nueva.
            </p>
            <Link
              href="/cuenta"
              className="text-sm text-brand-orange underline"
            >
              Ir a Mi cuenta
            </Link>
          </div>
        )}

        {estado === 'listo' && (
          <form onSubmit={guardar} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium">
                Nueva contraseña
              </label>
              <input
                required
                minLength={6}
                type="password"
                value={nuevaPassword}
                onChange={(e) => setNuevaPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">
                Confirmar contraseña
              </label>
              <input
                required
                minLength={6}
                type="password"
                value={confirmarPassword}
                onChange={(e) => setConfirmarPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={enviando}
              className="w-full rounded-lg bg-brand-orange py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {enviando ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
