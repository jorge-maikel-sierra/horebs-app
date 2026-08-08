import Link from 'next/link';
import { whatsappUrl } from '@/lib/negocio';

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

function formatPrecio(precio: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(precio);
}

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
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
        ¡Pedido recibido!
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Pedido #{pedido.id.slice(0, 8)} — confirmalo por WhatsApp para que el
        local empiece a prepararlo.
      </p>

      <div className="mt-6 rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
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
        className="mt-6 block w-full rounded-lg bg-green-600 py-3 text-center font-semibold text-white transition hover:opacity-90"
      >
        Confirmar por WhatsApp
      </a>

      <Link
        href="/catalogo"
        className="mt-3 block text-center text-sm text-zinc-500 hover:text-brand-orange dark:text-zinc-400"
      >
        Seguir comprando
      </Link>
    </div>
  );
}
