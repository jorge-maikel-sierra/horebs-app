'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Session } from '@supabase/supabase-js';
import { useCart } from '@/lib/cart-context';
import { formatPrecio } from '@/lib/formato';
import { supabase } from '@/lib/supabase';

function IconPaquete() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8 12 3 3 8l9 5 9-5Z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
  );
}

function IconTienda() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9 4 4h16l1 5" />
      <path d="M3 9a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0" />
      <path d="M5 9v10h14V9" />
      <path d="M9 19v-6h6v6" />
    </svg>
  );
}

function IconEfectivo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M6 9v.01M18 15v.01" />
    </svg>
  );
}

function IconTransferencia() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4v6h6" />
      <path d="M20 20v-6h-6" />
      <path d="M4.5 15a8 8 0 0 0 14.5 3.4M19.5 9A8 8 0 0 0 5 5.6" />
    </svg>
  );
}

function IconTarjeta() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <path d="M6 15h4" />
    </svg>
  );
}

type SaldoPuntos = {
  nombre: string;
  puntos: number;
  valorPuntoPesos: number;
  puntosMinimoCanje: number;
};

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
    options: { redirectTo: `${window.location.origin}/checkout` },
  });
}

function iniciales(nombre: string, correo: string) {
  const n = nombre.trim();
  if (n) return n.slice(0, 2).toUpperCase();
  return correo.slice(0, 2).toUpperCase();
}

function OpcionCard({
  selected,
  onClick,
  icon,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`btn-press card-interactive flex flex-1 flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-colors ${
        selected
          ? 'btn-gradient border-transparent text-white shadow-sm'
          : 'card-gradient border-zinc-200 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300'
      }`}
    >
      {icon}
      <span className="text-sm font-semibold">{label}</span>
    </button>
  );
}

export default function CheckoutPage() {
  const { items, total, clear } = useCart();
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [modalidad, setModalidad] = useState<'domicilio' | 'retiro'>('domicilio');
  const [direccion, setDireccion] = useState('');
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'transferencia' | 'tarjeta'>(
    'efectivo',
  );
  const [notas, setNotas] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saldoPuntos, setSaldoPuntos] = useState<SaldoPuntos | null>(null);
  const [usarPuntos, setUsarPuntos] = useState(false);
  // Una sola clave por intento de checkout (no por click) — si el mismo
  // submit dispara dos requests (doble clic más rápido que el disabled del
  // botón, o un reintento de red), el backend descarta el segundo insert
  // en vez de crear un pedido duplicado.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: subscripcion } = supabase.auth.onAuthStateChange(
      (_event, nuevaSesion) => setSession(nuevaSesion),
    );
    return () => subscripcion.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    const meta = session.user.user_metadata ?? {};
    // Mismo fallback que /cuenta: Google no manda las claves
    // nombre/apellido propias del registro por email, manda
    // full_name/name — se usan como default hasta que la persona las
    // edite (guardarPerfil en /cuenta o, acá, al confirmar el pedido).
    const nombreGoogle: string = meta.full_name ?? meta.name ?? '';
    const [nombreDefault, ...restoDefault] = nombreGoogle.split(' ');
    setNombre(meta.nombre ?? nombreDefault ?? '');
    setApellido(meta.apellido ?? restoDefault.join(' '));
    setCorreo(session.user.email ?? '');
    if (meta.telefono) setTelefono(meta.telefono);
  }, [session]);

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Checkout
        </h1>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          Tu carrito está vacío.{' '}
          <Link href="/catalogo" className="text-brand-orange underline">
            Volvé al catálogo
          </Link>
          .
        </p>
      </div>
    );
  }

  async function consultarSaldoPuntos() {
    const tel = telefono.trim();
    if (!tel) {
      setSaldoPuntos(null);
      setUsarPuntos(false);
      return;
    }
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
      const res = await fetch(`${apiUrl}/puntos/saldo?telefono=${encodeURIComponent(tel)}`);
      if (!res.ok) return;
      const saldo: SaldoPuntos | null = await res.json();
      setSaldoPuntos(saldo);
      if (!saldo || saldo.puntos < saldo.puntosMinimoCanje) setUsarPuntos(false);
    } catch {
      // Silencioso — la consulta de saldo es un extra, no debe frenar el checkout.
    }
  }

  const puedeCanjear = saldoPuntos !== null && saldoPuntos.puntos >= saldoPuntos.puntosMinimoCanje;
  const canjePuntos =
    puedeCanjear && saldoPuntos
      ? Math.min(saldoPuntos.puntos, Math.floor(total / saldoPuntos.valorPuntoPesos))
      : 0;
  const descuentoPuntos = usarPuntos ? canjePuntos * (saldoPuntos?.valorPuntoPesos ?? 0) : 0;
  const totalConDescuento = total - descuentoPuntos;

  async function enviarPedido(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (modalidad === 'domicilio' && !direccion.trim()) {
      setError('Falta la dirección de entrega.');
      return;
    }

    setEnviando(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
      const res = await fetch(`${apiUrl}/pedidos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente: { nombre, apellido, telefono, correo, direccion: direccion || undefined },
          modalidad,
          direccion_entrega: modalidad === 'domicilio' ? direccion : undefined,
          metodo_pago: metodoPago,
          notas: notas || undefined,
          items: items.map((i) => ({
            variante_id: i.varianteId,
            cantidad: i.cantidad,
          })),
          idempotency_key: idempotencyKey,
          usar_puntos: usarPuntos,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? 'No se pudo crear el pedido.');
      }

      const pedido = await res.json();
      // Fire-and-forget: si vino logueado, guarda/actualiza el teléfono
      // en el perfil para que el próximo checkout ya no lo pida (o lo
      // traiga corregido si lo cambió en este pedido).
      if (session) {
        supabase.auth.updateUser({ data: { telefono: telefono.trim() } });
      }
      clear();
      router.push(`/pedido/${pedido.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el pedido.');
      setEnviando(false);
    }
  }

  const inputClass =
    'mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 outline-none transition-colors focus:border-brand-orange dark:border-zinc-700 dark:bg-zinc-900';

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="animate-fade-up text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
        Checkout
      </h1>

      <div className="animate-fade-up delay-1 mt-4 rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        {items.map((i) => (
          <div key={i.varianteId} className="flex justify-between gap-3 py-0.5">
            <span>
              {i.cantidad}× {i.productoNombre} ({i.varianteNombre})
            </span>
            <span className="shrink-0">{formatPrecio(i.precio * i.cantidad)}</span>
          </div>
        ))}
        {descuentoPuntos > 0 && (
          <div className="flex justify-between gap-3 border-t border-zinc-100 py-1.5 pt-2 text-green-700 dark:border-zinc-800/60 dark:text-green-500">
            <span>Descuento · {canjePuntos} puntos</span>
            <span className="shrink-0">-{formatPrecio(descuentoPuntos)}</span>
          </div>
        )}
        <div className="mt-2 flex justify-between border-t border-zinc-200 pt-2 font-semibold dark:border-zinc-800">
          <span>Total</span>
          <span className="text-brand-orange">{formatPrecio(totalConDescuento)}</span>
        </div>
      </div>

      {session ? (
        <div className="animate-fade-up delay-2 mt-6 flex items-center gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <div className="btn-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white">
            {iniciales(nombre, correo)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {nombre ? `${nombre} ${apellido}`.trim() : correo}
            </p>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{correo}</p>
          </div>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="shrink-0 text-xs text-zinc-500 underline hover:text-brand-orange dark:text-zinc-400"
          >
            No soy yo
          </button>
        </div>
      ) : (
        <div className="animate-fade-up delay-2 mt-6">
          <button
            type="button"
            onClick={iniciarConGoogle}
            className="btn-press flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-300 py-3 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            <IconGoogle />
            Continuar con Google
          </button>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            <span className="text-xs text-zinc-400 dark:text-zinc-500">o con tus datos</span>
            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>
      )}

      <form onSubmit={enviarPedido} className="animate-fade-up delay-2 mt-6 space-y-4">
        {!session && (
          <div className="grid gap-4 sm:grid-cols-2">
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

        {session && !apellido.trim() && (
          <div>
            <label className="block text-sm font-medium">Apellido</label>
            <input
              required
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
              className={inputClass}
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium">
            Teléfono (WhatsApp)
          </label>
          <input
            required
            type="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            onBlur={consultarSaldoPuntos}
            className={inputClass}
          />
        </div>

        {!session && (
          <div>
            <label className="block text-sm font-medium">Correo electrónico</label>
            <input
              required
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              className={inputClass}
            />
          </div>
        )}

        {puedeCanjear && (
          <div className="animate-fade-up flex items-center justify-between gap-3 rounded-lg border border-brand-orange/25 bg-brand-orange/[0.06] px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-orange text-sm">
                ⭐
              </span>
              <label htmlFor="usar-puntos" className="text-sm text-zinc-700 dark:text-zinc-300">
                Tenés{' '}
                <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {saldoPuntos?.puntos} puntos
                </span>
                . Usar {canjePuntos} para un descuento de{' '}
                <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {formatPrecio(canjePuntos * (saldoPuntos?.valorPuntoPesos ?? 0))}
                </span>
                .
              </label>
            </div>
            <input
              id="usar-puntos"
              type="checkbox"
              checked={usarPuntos}
              onChange={(e) => setUsarPuntos(e.target.checked)}
              className="h-5 w-5 shrink-0 accent-brand-orange"
            />
          </div>
        )}

        <div>
          <span className="block text-sm font-medium">Modalidad</span>
          <div className="mt-2 flex gap-3">
            <OpcionCard
              selected={modalidad === 'domicilio'}
              onClick={() => setModalidad('domicilio')}
              icon={<IconPaquete />}
              label="Domicilio"
            />
            <OpcionCard
              selected={modalidad === 'retiro'}
              onClick={() => setModalidad('retiro')}
              icon={<IconTienda />}
              label="Retiro en local"
            />
          </div>
        </div>

        {modalidad === 'domicilio' && (
          <div className="animate-fade-up">
            <label className="block text-sm font-medium">
              Dirección de entrega
            </label>
            <input
              required
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              className={inputClass}
            />
          </div>
        )}

        <div>
          <span className="block text-sm font-medium">Método de pago</span>
          <div className="mt-2 grid grid-cols-3 gap-3">
            <OpcionCard
              selected={metodoPago === 'efectivo'}
              onClick={() => setMetodoPago('efectivo')}
              icon={<IconEfectivo />}
              label="Efectivo"
            />
            <OpcionCard
              selected={metodoPago === 'transferencia'}
              onClick={() => setMetodoPago('transferencia')}
              icon={<IconTransferencia />}
              label="Transferencia"
            />
            <OpcionCard
              selected={metodoPago === 'tarjeta'}
              onClick={() => setMetodoPago('tarjeta')}
              icon={<IconTarjeta />}
              label="Tarjeta"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">
            Notas (opcional)
          </label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            className={inputClass}
          />
        </div>

        {error && (
          <p className="animate-fade-up text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="btn-press flex w-full items-center justify-center gap-2 rounded-lg btn-gradient py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {enviando && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          )}
          {enviando ? 'Enviando…' : 'Confirmar pedido'}
        </button>
      </form>
    </div>
  );
}
