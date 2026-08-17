import type { Metadata } from 'next';
import { NEGOCIO } from '@/lib/negocio';

export const metadata: Metadata = {
  title: 'Política de privacidad | Pizzería Horebs',
  description:
    'Cómo Pizzería Horebs recopila, usa y protege tus datos al pedir por el sitio, WhatsApp, Messenger o Instagram.',
  alternates: { canonical: '/politica-privacidad' },
};

export default function PoliticaPrivacidadPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
        Política de privacidad
      </h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Última actualización: agosto de 2026
      </p>

      <div className="mt-10 space-y-8 text-zinc-700 dark:text-zinc-300">
        <section>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Quiénes somos
          </h2>
          <p className="mt-3">
            {NEGOCIO.nombre} es un negocio de pizzería ubicado en{' '}
            {NEGOCIO.direccion}. Esta política describe cómo tratamos los
            datos de las personas que nos contactan o hacen pedidos a través
            de nuestro sitio web ({NEGOCIO.sitio}), WhatsApp, Messenger o
            Instagram.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Qué datos recopilamos
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong>Datos de contacto:</strong> nombre, apellido, número de
              teléfono, correo electrónico (si creás una cuenta) y dirección
              de entrega cuando pedís a domicilio.
            </li>
            <li>
              <strong>Datos del pedido:</strong> productos elegidos,
              cantidades, modalidad (local, retiro o domicilio) y método de
              pago que elegís (efectivo, transferencia o tarjeta) — no
              procesamos ni guardamos números de tarjeta.
            </li>
            <li>
              <strong>Mensajes de WhatsApp, Messenger e Instagram:</strong>{' '}
              el contenido de los mensajes que nos escribís, tu número o
              nombre de perfil, y si tu conversación llegó desde un anuncio,
              para poder responderte y medir qué anuncios funcionan.
            </li>
            <li>
              <strong>Datos de uso del sitio:</strong> páginas visitadas y
              métricas de rendimiento, de forma agregada y sin identificarte
              individualmente.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Para qué usamos tus datos
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Procesar y confirmar tus pedidos.</li>
            <li>
              Responder tus mensajes por WhatsApp, Messenger o Instagram —
              incluida la respuesta automática de nuestro asistente virtual
              para consultas de menú, horario y estado de pedido.
            </li>
            <li>
              Enviarte confirmaciones de pedido por correo o WhatsApp cuando
              corresponda.
            </li>
            <li>
              Medir el rendimiento de nuestras campañas publicitarias en
              Meta (Facebook e Instagram).
            </li>
            <li>Mejorar nuestro sitio y catálogo.</li>
          </ul>
          <p className="mt-3">
            No vendemos tus datos a terceros. No enviamos mensajes
            promocionales por WhatsApp fuera de una conversación que vos
            iniciaste, salvo que lo autorices explícitamente.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Con quién compartimos datos
          </h2>
          <p className="mt-3">
            Usamos los siguientes proveedores para operar el negocio, cada
            uno con acceso limitado a lo necesario para su función:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong>Meta</strong> (WhatsApp Business Platform, Messenger e
              Instagram) — para enviar y recibir tus mensajes.
            </li>
            <li>
              <strong>Supabase</strong> — almacenamiento de la base de datos
              de clientes, pedidos y catálogo.
            </li>
            <li>
              <strong>Vercel</strong> — hosting del sitio web y métricas de
              rendimiento agregadas.
            </li>
            <li>
              <strong>Railway</strong> — hosting de nuestro servidor
              (API/bot).
            </li>
            <li>
              <strong>Resend</strong> — envío de correos de confirmación de
              pedido.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Cuánto tiempo guardamos tus datos
          </h2>
          <p className="mt-3">
            Guardamos tus datos mientras tengas una relación activa con
            nosotros (pedidos recientes o cuenta activa) y el tiempo
            adicional necesario para cumplir obligaciones contables o
            legales.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Tus derechos
          </h2>
          <p className="mt-3">
            Podés pedirnos en cualquier momento que te mostremos, corrijamos
            o eliminemos tus datos personales, escribiéndonos por WhatsApp
            al {NEGOCIO.whatsapp} o al correo{' '}
            <a
              href="mailto:jorgemaikelsierraamaya@gmail.com"
              className="text-brand-orange hover:underline"
            >
              jorgemaikelsierraamaya@gmail.com
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Cambios a esta política
          </h2>
          <p className="mt-3">
            Podemos actualizar esta política cuando cambien nuestras
            prácticas o los requisitos legales. La fecha de la última
            actualización figura al inicio de esta página.
          </p>
        </section>
      </div>
    </div>
  );
}
