import Link from 'next/link';
import { whatsappUrl } from '@/lib/negocio';
import { formatPrecio } from '@/lib/formato';

type PedidoItem = {
  producto_nombre: string;
  variante_nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
};

type Pedido = {
  id: string;
  cliente: { nombre: string; telefono: string };
  modalidad: string;
  direccion_entrega: string | null;
  metodo_pago: string;
  estado: string;
  total: number;
  notas: string | null;
  items: PedidoItem[];
};


async function getPedido(id: string): Promise<Pedido | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
  const res = await fetch(`${apiUrl}/pedidos/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

function mensajeWhatsapp(pedido: Pedido): string {
  const lineas = [
    `¡Hola! Quiero confirmar mi pedido #${pedido.id.slice(0, 8)}:`,
    '',
    ...pedido.items.map(
      (i) => `• ${i.cantidad}x ${i.producto_nombre} (${i.variante_nombre})`,
    ),
    '',
    `Total: ${formatPrecio(pedido.total)}`,
    `Modalidad: ${pedido.modalidad === 'domicilio' ? 'Domicilio' : 'Retiro en local'}`,
    ...(pedido.modalidad === 'domicilio' && pedido.direccion_entrega
      ? [`Dirección: ${pedido.direccion_entrega}`]
      : []),
    `Método de pago: ${pedido.metodo_pago}`,
    `Nombre: ${pedido.cliente.nombre}`,
  ];
  return lineas.join('\n');
}

export default async function PedidoConfirmacionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pedido = await getPedido(id);

  if (!pedido) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Pedido no encontrado
        </h1>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          Revisá el enlace o volvé al{' '}
          <Link href="/catalogo" className="text-brand-orange underline">
            catálogo
          </Link>
          .
        </p>
      </div>
    );
  }

  const urlWhatsapp = whatsappUrl(mensajeWhatsapp(pedido));

  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
        <span
          className="absolute inset-0 rounded-full bg-green-500/25"
          style={{ animation: 'ring-pop 0.7s ease-out 0.15s both' }}
        />
        <svg width="72" height="72" viewBox="0 0 72 72" className="relative">
          <circle
            cx="36"
            cy="36"
            r="33"
            fill="none"
            stroke="#1F9D55"
            strokeWidth="4"
            pathLength="1"
            style={{
              strokeDasharray: 1,
              strokeDashoffset: 1,
              animation: 'draw-check 0.6s ease-out forwards',
            }}
          />
          <path
            d="M21 37 L31.5 47.5 L51 26"
            fill="none"
            stroke="#1F9D55"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength="1"
            style={{
              strokeDasharray: 1,
              strokeDashoffset: 1,
              animation: 'draw-check 0.35s ease-out 0.55s forwards',
            }}
          />
        </svg>
      </div>

      <h1 className="animate-fade-up delay-1 mt-4 text-center text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
        ¡Pedido recibido!
      </h1>
      <p className="animate-fade-up delay-2 mt-2 text-center text-zinc-600 dark:text-zinc-400">
        Pedido #{pedido.id.slice(0, 8)} — confirmalo por WhatsApp para que el
        local empiece a prepararlo.
      </p>

      <div className="animate-fade-up delay-3 mt-6 rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        {pedido.items.map((i, idx) => (
          <div key={idx} className="flex justify-between gap-3 py-0.5">
            <span>
              {i.cantidad}× {i.producto_nombre} ({i.variante_nombre})
            </span>
            <span className="shrink-0">{formatPrecio(i.subtotal)}</span>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t border-zinc-200 pt-2 font-semibold dark:border-zinc-800">
          <span>Total</span>
          <span className="text-brand-orange">{formatPrecio(pedido.total)}</span>
        </div>
        <dl className="mt-3 space-y-2 text-zinc-600 dark:text-zinc-400">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
            <dt className="shrink-0">Modalidad</dt>
            <dd className="sm:text-right">
              {pedido.modalidad === 'domicilio' ? 'Domicilio' : 'Retiro en local'}
            </dd>
          </div>
          {pedido.modalidad === 'domicilio' && pedido.direccion_entrega && (
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
              <dt className="shrink-0">Dirección</dt>
              <dd className="sm:text-right">{pedido.direccion_entrega}</dd>
            </div>
          )}
          <div className="flex flex-col gap-0.5 capitalize sm:flex-row sm:justify-between sm:gap-4">
            <dt className="shrink-0">Método de pago</dt>
            <dd className="sm:text-right">{pedido.metodo_pago}</dd>
          </div>
        </dl>
      </div>

      <a
        href={urlWhatsapp}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-press animate-fade-up delay-4 mt-6 block w-full rounded-lg bg-green-600 py-3 text-center font-semibold text-white transition-opacity hover:opacity-90"
      >
        Confirmar por WhatsApp
      </a>

      <Link
        href="/catalogo"
        className="animate-fade-up delay-4 mt-3 block text-center text-sm text-zinc-500 transition-colors hover:text-brand-orange dark:text-zinc-400"
      >
        Seguir comprando
      </Link>
    </div>
  );
}
