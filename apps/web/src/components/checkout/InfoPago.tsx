import { NEGOCIO } from '@/lib/negocio';

export type MetodoPago = 'efectivo' | 'transferencia' | 'tarjeta';

/**
 * Qué implica cada método, dicho en el momento de elegirlo. Los textos
 * siguen a la página de confirmación (/pedido/[id]): el cliente confirma
 * por WhatsApp y, si transfiere, manda ahí el comprobante. Los pedidos web
 * con tarjeta no generan link de Bold (eso es del bot): el equipo cobra a
 * mano, por eso no se promete un link.
 */
export default function InfoPago({ metodo }: { metodo: MetodoPago }) {
  return (
    <div
      key={metodo}
      aria-live="polite"
      className="animate-entrada-seccion mt-3 rounded-xl bg-zinc-100/80 px-3.5 py-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
    >
      {metodo === 'efectivo' && (
        <p>
          Pagas al recibir. Si vas a necesitar cambio, cuéntanos en las notas con cuánto pagas.
        </p>
      )}
      {metodo === 'transferencia' && (
        <p>
          Transfiere a <strong className="font-semibold text-zinc-900 dark:text-zinc-50">{NEGOCIO.transferencia.banco}</strong>,
          llave{' '}
          <strong className="font-semibold text-zinc-900 tabular-nums dark:text-zinc-50">
            {NEGOCIO.transferencia.llave}
          </strong>
          , y manda el comprobante cuando confirmes el pedido por WhatsApp.
        </p>
      )}
      {metodo === 'tarjeta' && (
        <p>Cuando confirmes el pedido por WhatsApp te decimos cómo pagar con tarjeta.</p>
      )}
    </div>
  );
}
