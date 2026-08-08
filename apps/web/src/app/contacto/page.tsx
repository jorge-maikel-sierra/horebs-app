import { NEGOCIO, whatsappUrl } from '@/lib/negocio';

export default function ContactoPage() {
  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
        Contacto
      </h1>

      <dl className="mt-6 space-y-4 text-zinc-700 dark:text-zinc-300">
        <div>
          <dt className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            Dirección
          </dt>
          <dd className="text-lg">{NEGOCIO.direccion}</dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            Horario
          </dt>
          <dd className="text-lg">{NEGOCIO.horario}</dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            WhatsApp
          </dt>
          <dd className="text-lg">{NEGOCIO.whatsapp}</dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            Redes sociales
          </dt>
          <dd className="flex gap-4 text-lg">
            <a
              href={NEGOCIO.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-orange underline"
            >
              Facebook
            </a>
            <a
              href={NEGOCIO.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-orange underline"
            >
              Instagram
            </a>
          </dd>
        </div>
      </dl>

      <a
        href={whatsappUrl('¡Hola! Quiero hacer un pedido.')}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 block w-full rounded-lg bg-green-600 py-3 text-center font-semibold text-white transition hover:opacity-90"
      >
        Escribinos por WhatsApp
      </a>

      <div className="mt-8 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <iframe
          title="Ubicación de Pizzería Horebs"
          src={NEGOCIO.mapaEmbedUrl}
          className="h-72 w-full"
          loading="lazy"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </div>
  );
}
