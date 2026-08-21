'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
import { formatPrecio } from '@/lib/formato';

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

  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [telefono, setTelefono] = useState('');
  const [modalidad, setModalidad] = useState<'domicilio' | 'retiro'>('domicilio');
  const [direccion, setDireccion] = useState('');
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'transferencia' | 'tarjeta'>(
    'efectivo',
  );
  const [notas, setNotas] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Una sola clave por intento de checkout (no por click) — si el mismo
  // submit dispara dos requests (doble clic más rápido que el disabled del
  // botón, o un reintento de red), el backend descarta el segundo insert
  // en vez de crear un pedido duplicado.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

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
          cliente: { nombre, apellido, telefono, direccion: direccion || undefined },
          modalidad,
          direccion_entrega: modalidad === 'domicilio' ? direccion : undefined,
          metodo_pago: metodoPago,
          notas: notas || undefined,
          items: items.map((i) => ({
            variante_id: i.varianteId,
            cantidad: i.cantidad,
          })),
          idempotency_key: idempotencyKey,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? 'No se pudo crear el pedido.');
      }

      const pedido = await res.json();
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
        <div className="mt-2 flex justify-between border-t border-zinc-200 pt-2 font-semibold dark:border-zinc-800">
          <span>Total</span>
          <span className="text-brand-orange">{formatPrecio(total)}</span>
        </div>
      </div>

      <form onSubmit={enviarPedido} className="animate-fade-up delay-2 mt-6 space-y-4">
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

        <div>
          <label className="block text-sm font-medium">
            Teléfono (WhatsApp)
          </label>
          <input
            required
            type="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            className={inputClass}
          />
        </div>

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
