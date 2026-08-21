'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useRol } from '@/lib/use-rol';

type Modo = 'login' | 'registro';

const inputClass =
  'mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 outline-none transition-colors focus:border-brand-orange dark:border-zinc-700 dark:bg-zinc-950';

function iniciales(nombre: string, apellido: string, email: string) {
  const n = nombre.trim();
  const a = apellido.trim();
  if (n) return (n[0] + (a[0] ?? '')).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

function IconGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C33.9 6.1 29.2 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5Z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C33.9 6.1 29.2 4 24 4c-7.6 0-14.1 4.3-17.7 10.7Z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.1 0 9.8-2 13.3-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44Z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C40.7 36.3 44 30.9 44 24c0-1.3-.1-2.7-.4-3.5Z"
      />
    </svg>
  );
}

async function iniciarConGoogle() {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/cuenta` },
  });
}

export default function CuentaPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const { rol } = useRol();

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
    // Primer login con Google: no hay meta.nombre/apellido propios
    // todavía (esas claves las llenamos nosotros en el registro por
    // email), pero Google sí manda full_name/name — se usa como default
    // hasta que la persona guarde sus datos desde acá.
    const nombreGoogle: string = meta.full_name ?? meta.name ?? '';
    const [nombreDefault, ...restoDefault] = nombreGoogle.split(' ');
    setPerfilNombre(meta.nombre ?? nombreDefault ?? '');
    setPerfilApellido(meta.apellido ?? restoDefault.join(' '));
    setPerfilTelefono(meta.telefono ?? '');
    setPerfilDireccion(meta.direccion ?? '');
    setNuevoEmail(session.user.email ?? '');
  }, [session]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMensaje(null);
    setEnviando(true);

    const emailLimpio = email.trim();
    const passwordLimpia = password.trim();

    if (modo === 'registro') {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: emailLimpio,
        password: passwordLimpia,
        options: { data: { nombre: nombre.trim(), apellido: apellido.trim() } },
      });
      if (signUpError) {
        setError(signUpError.message);
      } else if (!data.session) {
        setMensaje(
          'Cuenta creada. Revisá tu correo para confirmarla antes de iniciar sesión.',
        );
      }
    } else {
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: emailLimpio,
          password: passwordLimpia,
        });
      if (signInError) {
        setError(signInError.message);
      } else if (signInData.user) {
        // Personal (admin o empleado) va directo al panel — el resto se
        // queda en /cuenta como cualquier cliente.
        const { data: perfil } = await supabase
          .from('perfiles_staff')
          .select('rol')
          .eq('id', signInData.user.id)
          .maybeSingle();
        if (perfil?.rol) router.push('/admin');
      }
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
    // Solo la trae Google (login por email no tiene foto) — el avatar
    // vive únicamente en user_metadata, no hay carga manual todavía.
    const avatarUrl: string | undefined =
      session.user.user_metadata?.avatar_url ?? session.user.user_metadata?.picture;

    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="animate-fade-up flex flex-wrap items-center gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL externa de Google, no vale la pena optimizarla con next/image.
            <img
              src={avatarUrl}
              alt=""
              className="animate-pop-in h-16 w-16 shrink-0 rounded-full object-cover shadow-sm"
            />
          ) : (
            <div className="btn-gradient animate-pop-in flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white shadow-sm">
              {iniciales(perfilNombre, perfilApellido, session.user.email ?? '')}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {nombreCompleto}
            </h1>
            <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
              {session.user.email}
            </p>
          </div>
          {(rol === 'admin' || rol === 'empleado') && (
            <Link
              href="/admin"
              className="btn-press shrink-0 rounded-lg btn-gradient px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Panel de administración
            </Link>
          )}
          <button
            type="button"
            onClick={cerrarSesion}
            className="btn-press shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Cerrar sesión
          </button>
        </div>

        <div className="mt-8 space-y-6">
          <section className="card-interactive card-gradient animate-fade-up delay-1 rounded-2xl border border-zinc-200 p-6 shadow-sm dark:border-zinc-800">
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
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Apellido</label>
                  <input
                    required
                    value={perfilApellido}
                    onChange={(e) => setPerfilApellido(e.target.value)}
                    className={inputClass}
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
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">
                    Dirección (opcional)
                  </label>
                  <input
                    value={perfilDireccion}
                    onChange={(e) => setPerfilDireccion(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
              {perfilError && (
                <p className="animate-fade-up text-sm text-red-600 dark:text-red-400">{perfilError}</p>
              )}
              {perfilMensaje && (
                <p className="animate-fade-up text-sm text-brand-orange">{perfilMensaje}</p>
              )}
              <button
                type="submit"
                disabled={perfilGuardando}
                className="btn-press rounded-lg btn-gradient px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {perfilGuardando ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </form>
          </section>

          <section className="card-interactive card-gradient animate-fade-up delay-2 rounded-2xl border border-zinc-200 p-6 shadow-sm dark:border-zinc-800">
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
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                disabled={emailGuardando}
                className="btn-press shrink-0 rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {emailGuardando ? 'Guardando…' : 'Actualizar correo'}
              </button>
            </form>
            {emailError && (
              <p className="animate-fade-up mt-2 text-sm text-red-600 dark:text-red-400">{emailError}</p>
            )}
            {emailMensaje && (
              <p className="animate-fade-up mt-2 text-sm text-brand-orange">{emailMensaje}</p>
            )}
          </section>

          <section className="card-interactive card-gradient animate-fade-up delay-3 rounded-2xl border border-zinc-200 p-6 shadow-sm dark:border-zinc-800">
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
                    className={inputClass}
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
                    className={inputClass}
                  />
                </div>
              </div>
              {passwordError && (
                <p className="animate-fade-up text-sm text-red-600 dark:text-red-400">{passwordError}</p>
              )}
              {passwordMensaje && (
                <p className="animate-fade-up text-sm text-brand-orange">{passwordMensaje}</p>
              )}
              <button
                type="submit"
                disabled={passwordGuardando}
                className="btn-press rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
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
      <div className="card-interactive card-gradient animate-fade-up rounded-2xl border border-zinc-200 p-8 shadow-sm dark:border-zinc-800">
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
            className={`pb-2 text-sm font-semibold transition-colors ${
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
            className={`pb-2 text-sm font-semibold transition-colors ${
              modo === 'registro'
                ? 'border-b-2 border-brand-orange text-brand-orange'
                : 'text-zinc-500 dark:text-zinc-400'
            }`}
          >
            Crear cuenta
          </button>
        </div>

        <button
          type="button"
          onClick={iniciarConGoogle}
          className="btn-press mt-6 flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-300 py-3 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          <IconGoogle />
          Continuar con Google
        </button>

        <div className="mt-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          <span className="text-xs text-zinc-400 dark:text-zinc-500">o con tu correo</span>
          <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        </div>

        <form onSubmit={enviar} className="mt-6 space-y-4">
          {modo === 'registro' && (
            <div className="animate-fade-up grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium">Nombre</label>
                <input
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Apellido</label>
                <input
                  required
                  value={apellido}
                  onChange={(e) => setApellido(e.target.value)}
                  className={inputClass}
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
              className={inputClass}
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
              className={inputClass}
            />
          </div>

          {modo === 'login' && (
            <div>
              <button
                type="button"
                onClick={enviarRecuperacion}
                disabled={recuperarEnviando}
                className="text-sm text-brand-orange underline transition-opacity disabled:opacity-50"
              >
                {recuperarEnviando
                  ? 'Enviando…'
                  : '¿Olvidaste tu contraseña?'}
              </button>
              {recuperarError && (
                <p className="animate-fade-up mt-1 text-sm text-red-600 dark:text-red-400">{recuperarError}</p>
              )}
              {recuperarMensaje && (
                <p className="animate-fade-up mt-1 text-sm text-brand-orange">
                  {recuperarMensaje}
                </p>
              )}
            </div>
          )}

          {error && <p className="animate-fade-up text-sm text-red-600 dark:text-red-400">{error}</p>}
          {mensaje && <p className="animate-fade-up text-sm text-brand-orange">{mensaje}</p>}

          <button
            type="submit"
            disabled={enviando}
            className="btn-press w-full rounded-lg btn-gradient py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
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
