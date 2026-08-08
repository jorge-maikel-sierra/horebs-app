'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
import { formatPrecio } from '@/lib/formato';

export default function CheckoutPage() {
  const { items, total, clear } = useCart();
  const router = useRouter();

  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [modalidad, setModalidad] = useState<'domicilio' | 'retiro'>('domicilio');
  const [direccion, setDireccion] = useState('');
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'transferencia' | 'tarjeta'>(
    'efectivo',
  );
  const [notas, setNotas] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          cliente: { nombre, telefono, direccion: direccion || undefined },
          modalidad,
          direccion_entrega: modalidad === 'domicilio' ? direccion : undefined,
          metodo_pago: metodoPago,
          notas: notas || undefined,
          items: items.map((i) => ({
            variante_id: i.varianteId,
            cantidad: i.cantidad,
          })),
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

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
        Checkout
      </h1>

      <div className="mt-4 rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
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

      <form onSubmit={enviarPedido} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium">Nombre</label>
          <input
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
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
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div>
          <span className="block text-sm font-medium">Modalidad</span>
          <div className="mt-1 flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="modalidad"
                checked={modalidad === 'domicilio'}
                onChange={() => setModalidad('domicilio')}
              />
              Domicilio
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="modalidad"
                checked={modalidad === 'retiro'}
                onChange={() => setModalidad('retiro')}
              />
              Retiro en local
            </label>
          </div>
        </div>

        {modalidad === 'domicilio' && (
          <div>
            <label className="block text-sm font-medium">
              Dirección de entrega
            </label>
            <input
              required
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
        )}

        <div>
          <span className="block text-sm font-medium">Método de pago</span>
          <div className="mt-1 flex flex-wrap gap-4">
            {(['efectivo', 'transferencia', 'tarjeta'] as const).map((m) => (
              <label key={m} className="flex items-center gap-2 text-sm capitalize">
                <input
                  type="radio"
                  name="metodoPago"
                  checked={metodoPago === m}
                  onChange={() => setMetodoPago(m)}
                />
                {m}
              </label>
            ))}
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
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-lg bg-brand-orange py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {enviando ? 'Enviando…' : 'Confirmar pedido'}
        </button>
      </form>
    </div>
  );
}
