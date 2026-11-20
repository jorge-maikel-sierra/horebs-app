import type { Metadata } from 'next';
import Link from 'next/link';
import { formatPrecio } from '@/lib/formato';
import { NEGOCIO } from '@/lib/negocio';
import { openGraphPagina } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Términos y condiciones | Pizzería Horebs',
  description:
    'Condiciones para pedir en Pizzería Horebs: precios, domicilios en Riohacha, horarios, medios de pago, programa de puntos, asistente virtual y reseñas.',
  alternates: { canonical: '/terminos' },
  openGraph: openGraphPagina('/terminos'),
};

const TITULO = 'text-xl font-semibold text-zinc-900 dark:text-zinc-50';

export default function TerminosPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
        Términos y condiciones
      </h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Última actualización: noviembre de 2026
      </p>

      <div className="mt-10 space-y-8 text-zinc-700 dark:text-zinc-300">
        <section>
          <h2 className={TITULO}>Quiénes somos</h2>
          <p className="mt-3">
            {NEGOCIO.nombre} es una pizzería ubicada en {NEGOCIO.direccion}.
            Estos términos aplican a los pedidos que haces en nuestro sitio web
            ({NEGOCIO.sitio}), en el local, por WhatsApp, Messenger o Instagram,
            y al uso de nuestros canales de atención. Al hacer un pedido
            aceptas estas condiciones y nuestra{' '}
            <Link href="/politica-privacidad" className="text-accent-ink hover:underline">
              política de privacidad
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className={TITULO}>Pedidos y horario</h2>
          <p className="mt-3">
            Atendemos {NEGOCIO.horario.toLowerCase()} (hora de Colombia). Un
            pedido queda confirmado cuando te enviamos la confirmación con su
            número y su total. Si necesitas cambiar o cancelar un pedido,
            escríbenos por WhatsApp al {NEGOCIO.whatsapp} lo antes posible: una
            vez está en preparación puede que ya no sea posible.
          </p>
        </section>

        <section>
          <h2 className={TITULO}>Precios y promociones</h2>
          <p className="mt-3">
            Los precios están en pesos colombianos. Pueden cambiar sin previo aviso; el precio que aplica
            es el que aparece en la confirmación de tu pedido. Cada promoción
            rige solo en los días, horarios, canales y productos que indica.
          </p>
        </section>

        <section>
          <h2 className={TITULO}>Domicilios</h2>
          <p className="mt-3">
            Llevamos pedidos a la zona urbana de Riohacha. El domicilio cuesta{' '}
            {formatPrecio(NEGOCIO.costoDomicilio)} y se suma al total del
            pedido. Para entregar necesitamos una dirección escrita completa y
            un teléfono de contacto; los tiempos de entrega son aproximados y
            pueden variar según la demanda y el clima.
          </p>
        </section>

        <section>
          <h2 className={TITULO}>Medios de pago</h2>
          <p className="mt-3">
            Recibimos efectivo, transferencia bancaria y tarjeta. El pago con
            tarjeta se hace en la pasarela de nuestro proveedor de pagos (Bold)
            mediante un enlace de un solo uso: nosotros no vemos ni guardamos
            los datos de tu tarjeta. El comprobante que entregamos no es una
            factura electrónica.
          </p>
        </section>

        <section>
          <h2 className={TITULO}>Programa de puntos</h2>
          <p className="mt-3">
            Ganas 1 punto por cada $1.000 de compra. Cada punto vale $50 de
            descuento y puedes canjearlos desde 100 puntos. Los puntos vencen a
            los 12 meses sin compras que los generen.
          </p>
        </section>

        <section>
          <h2 className={TITULO}>Asistente virtual y reseñas</h2>
          <p className="mt-3">
            En WhatsApp, Messenger e Instagram te puede responder un asistente
            virtual automático; en cualquier momento puedes pedir que te
            atienda una persona del equipo. Las reseñas que dejas en nuestro
            Perfil de Empresa en Google son públicas y podemos responderlas
            públicamente, a veces con un mensaje automático de agradecimiento.
          </p>
        </section>

        <section>
          <h2 className={TITULO}>Quejas y reclamos</h2>
          <p className="mt-3">
            Si algo no salió bien con tu pedido, escríbenos por WhatsApp al{' '}
            {NEGOCIO.whatsapp} y lo revisamos contigo. Tus derechos como
            consumidor se rigen por el Estatuto del Consumidor (Ley 1480 de
            2011) y demás normas de Colombia.
          </p>
        </section>

        <section>
          <h2 className={TITULO}>Cambios a estos términos</h2>
          <p className="mt-3">
            Podemos actualizar estos términos. La versión vigente es la
            publicada en esta página, con la fecha de su última actualización.
          </p>
        </section>
      </div>
    </div>
  );
}
