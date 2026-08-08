'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type Modo = 'login' | 'registro';

export default function CuentaPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);

  const [modo, setModo] = useState<Modo>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCargandoSesion(false);
    });

    const { data: subscripcion } = supabase.auth.onAuthStateChange(
      (_event, nuevaSesion) => {
        setSession(nuevaSesion);
      },
    );

    return () => subscripcion.subscription.unsubscribe();
  }, []);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMensaje(null);
    setEnviando(true);

    if (modo === 'registro') {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (signUpError) {
        setError(signUpError.message);
      } else if (!data.session) {
        setMensaje(
          'Cuenta creada. Revisá tu correo para confirmarla antes de iniciar sesión.',
        );
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) setError(signInError.message);
    }

    setEnviando(false);
  }

  async function cerrarSesion() {
    await supabase.auth.signOut();
  }

  if (cargandoSesion) {
    return <div className="mx-auto max-w-md p-8" />;
  }

  if (session) {
    return (
      <div className="mx-auto max-w-md p-8">
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
          Mi cuenta
        </h1>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          Sesión iniciada como <strong>{session.user.email}</strong>.
        </p>
        <button
          type="button"
          onClick={cerrarSesion}
          className="mt-6 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Cerrar sesión
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md p-8">
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
        Mi cuenta
      </h1>

      <div className="mt-6 flex gap-4 border-b border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setModo('login')}
          className={`pb-2 text-sm font-semibold ${
            modo === 'login'
              ? 'border-b-2 border-brand-orange text-brand-orange'
              : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          Iniciar sesión
        </button>
        <button
          type="button"
          onClick={() => setModo('registro')}
          className={`pb-2 text-sm font-semibold ${
            modo === 'registro'
              ? 'border-b-2 border-brand-orange text-brand-orange'
              : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          Crear cuenta
        </button>
      </div>

      <form onSubmit={enviar} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Contraseña</label>
          <input
            required
            minLength={6}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {mensaje && <p className="text-sm text-brand-orange">{mensaje}</p>}

        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-lg bg-brand-orange py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {enviando
            ? 'Enviando…'
            : modo === 'login'
              ? 'Iniciar sesión'
              : 'Crear cuenta'}
        </button>
      </form>
    </div>
  );
}
