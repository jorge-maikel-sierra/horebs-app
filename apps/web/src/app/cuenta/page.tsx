'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type Modo = 'login' | 'registro';

function iniciales(nombre: string, apellido: string, email: string) {
  const n = nombre.trim();
  const a = apellido.trim();
  if (n) return (n[0] + (a[0] ?? '')).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

export default function CuentaPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);

  const [modo, setModo] = useState<Modo>('login');
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [perfilNombre, setPerfilNombre] = useState('');
  const [perfilApellido, setPerfilApellido] = useState('');
  const [perfilTelefono, setPerfilTelefono] = useState('');
  const [perfilDireccion, setPerfilDireccion] = useState('');
  const [perfilGuardando, setPerfilGuardando] = useState(false);
  const [perfilError, setPerfilError] = useState<string | null>(null);
  const [perfilMensaje, setPerfilMensaje] = useState<string | null>(null);

  const [nuevoEmail, setNuevoEmail] = useState('');
  const [emailGuardando, setEmailGuardando] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailMensaje, setEmailMensaje] = useState<string | null>(null);

  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [passwordGuardando, setPasswordGuardando] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordMensaje, setPasswordMensaje] = useState<string | null>(null);

  const [recuperarEnviando, setRecuperarEnviando] = useState(false);
  const [recuperarError, setRecuperarError] = useState<string | null>(null);
  const [recuperarMensaje, setRecuperarMensaje] = useState<string | null>(
    null,
  );

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

  useEffect(() => {
    if (!session) return;
    const meta = session.user.user_metadata ?? {};
    setPerfilNombre(meta.nombre ?? '');
    setPerfilApellido(meta.apellido ?? '');
    setPerfilTelefono(meta.telefono ?? '');
    setPerfilDireccion(meta.direccion ?? '');
    setNuevoEmail(session.user.email ?? '');
  }, [session]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMensaje(null);
    setEnviando(true);

    if (modo === 'registro') {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nombre, apellido } },
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

  async function enviarRecuperacion() {
    setRecuperarError(null);
    setRecuperarMensaje(null);

    if (!email.trim()) {
      setRecuperarError('Escribí tu email arriba primero.');
      return;
    }

    setRecuperarEnviando(true);
    const { error: recuperarErrorRes } =
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/cuenta/restablecer`,
      });
    if (recuperarErrorRes) setRecuperarError(recuperarErrorRes.message);
    else {
      setRecuperarMensaje(
        'Si ese correo tiene una cuenta, te enviamos un enlace para restablecer la contraseña.',
      );
    }
    setRecuperarEnviando(false);
  }

  async function guardarPerfil(e: FormEvent) {
    e.preventDefault();
    setPerfilError(null);
    setPerfilMensaje(null);

    if (!perfilNombre.trim() || !perfilApellido.trim()) {
      setPerfilError('Nombre y apellido son obligatorios.');
      return;
    }

    setPerfilGuardando(true);
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        nombre: perfilNombre.trim(),
        apellido: perfilApellido.trim(),
        telefono: perfilTelefono.trim() || null,
        direccion: perfilDireccion.trim() || null,
      },
    });
    if (updateError) setPerfilError(updateError.message);
    else setPerfilMensaje('Datos actualizados.');
    setPerfilGuardando(false);
  }

  async function guardarEmail(e: FormEvent) {
    e.preventDefault();
    setEmailError(null);
    setEmailMensaje(null);

    if (!nuevoEmail.trim()) {
      setEmailError('El correo no puede quedar vacío.');
      return;
    }

    setEmailGuardando(true);
    const { error: updateError } = await supabase.auth.updateUser({
      email: nuevoEmail.trim(),
    });
    if (updateError) setEmailError(updateError.message);
    else {
      setEmailMensaje(
        'Listo. Si tu correo requiere confirmación, revisá tu bandeja de entrada.',
      );
    }
    setEmailGuardando(false);
  }

  async function guardarPassword(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordMensaje(null);

    if (nuevaPassword.length < 6) {
      setPasswordError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (nuevaPassword !== confirmarPassword) {
      setPasswordError('Las contraseñas no coinciden.');
      return;
    }

    setPasswordGuardando(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password: nuevaPassword,
    });
    if (updateError) {
      setPasswordError(updateError.message);
    } else {
      setPasswordMensaje('Contraseña actualizada.');
      setNuevaPassword('');
      setConfirmarPassword('');
    }
    setPasswordGuardando(false);
  }

  if (cargandoSesion) {
    return <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6" />;
  }

  if (session) {
    const nombreCompleto = perfilNombre
      ? `${perfilNombre} ${perfilApellido}`.trim()
      : session.user.email;

    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-orange text-xl font-bold text-white">
            {iniciales(perfilNombre, perfilApellido, session.user.email ?? '')}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {nombreCompleto}
            </h1>
            <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
              {session.user.email}
            </p>
          </div>
          <button
            type="button"
            onClick={cerrarSesion}
            className="shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Cerrar sesión
          </button>
        </div>

        <div className="mt-8 space-y-6">
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Datos personales
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Se usan para identificarte y agilizar tus pedidos.
            </p>
            <form onSubmit={guardarPerfil} className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium">Nombre</label>
                  <input
                    required
                    value={perfilNombre}
                    onChange={(e) => setPerfilNombre(e.target.value)}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Apellido</label>
                  <input
                    required
                    value={perfilApellido}
                    onChange={(e) => setPerfilApellido(e.target.value)}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium">
                    Teléfono (opcional)
                  </label>
                  <input
                    value={perfilTelefono}
                    onChange={(e) => setPerfilTelefono(e.target.value)}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">
                    Dirección (opcional)
                  </label>
                  <input
                    value={perfilDireccion}
                    onChange={(e) => setPerfilDireccion(e.target.value)}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </div>
              </div>
              {perfilError && (
                <p className="text-sm text-red-600">{perfilError}</p>
              )}
              {perfilMensaje && (
                <p className="text-sm text-brand-orange">{perfilMensaje}</p>
              )}
              <button
                type="submit"
                disabled={perfilGuardando}
                className="rounded-lg bg-brand-orange px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {perfilGuardando ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Correo electrónico
            </h2>
            <form
              onSubmit={guardarEmail}
              className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
            >
              <div className="flex-1">
                <label className="block text-sm font-medium">Email</label>
                <input
                  required
                  type="email"
                  value={nuevoEmail}
                  onChange={(e) => setNuevoEmail(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </div>
              <button
                type="submit"
                disabled={emailGuardando}
                className="shrink-0 rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {emailGuardando ? 'Guardando…' : 'Actualizar correo'}
              </button>
            </form>
            {emailError && (
              <p className="mt-2 text-sm text-red-600">{emailError}</p>
            )}
            {emailMensaje && (
              <p className="mt-2 text-sm text-brand-orange">{emailMensaje}</p>
            )}
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Contraseña
            </h2>
            <form onSubmit={guardarPassword} className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
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
              </div>
              {passwordError && (
                <p className="text-sm text-red-600">{passwordError}</p>
              )}
              {passwordMensaje && (
                <p className="text-sm text-brand-orange">{passwordMensaje}</p>
              )}
              <button
                type="submit"
                disabled={passwordGuardando}
                className="rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {passwordGuardando ? 'Guardando…' : 'Cambiar contraseña'}
              </button>
            </form>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Mi cuenta
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Iniciá sesión o creá una cuenta para gestionar tus datos.
        </p>

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
          {modo === 'registro' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium">Nombre</label>
                <input
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Apellido</label>
                <input
                  required
                  value={apellido}
                  onChange={(e) => setApellido(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
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
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>

          {modo === 'login' && (
            <div>
              <button
                type="button"
                onClick={enviarRecuperacion}
                disabled={recuperarEnviando}
                className="text-sm text-brand-orange underline disabled:opacity-50"
              >
                {recuperarEnviando
                  ? 'Enviando…'
                  : '¿Olvidaste tu contraseña?'}
              </button>
              {recuperarError && (
                <p className="mt-1 text-sm text-red-600">{recuperarError}</p>
              )}
              {recuperarMensaje && (
                <p className="mt-1 text-sm text-brand-orange">
                  {recuperarMensaje}
                </p>
              )}
            </div>
          )}

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
    </div>
  );
}
