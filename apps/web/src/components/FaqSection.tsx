'use client';

import { useState } from 'react';
import { whatsappUrl } from '@/lib/negocio';
import { FAQS } from '@/lib/faqs';

export default function FaqSection() {
  const [abierta, setAbierta] = useState<number | null>(0);

  return (
    <section className="px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <h2 className="text-center text-2xl font-bold text-zinc-900 sm:text-3xl dark:text-zinc-50">
          Preguntas frecuentes
        </h2>
        <p className="mx-auto mt-2 max-w-md text-center text-zinc-600 dark:text-zinc-400">
          Lo que más nos preguntan antes de pedir.
        </p>

        <div className="mt-8 space-y-3">
          {FAQS.map((faq, i) => {
            const abiertaActual = abierta === i;
            return (
              <div
                key={faq.pregunta}
                className="card-gradient overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800"
              >
                <button
                  type="button"
                  onClick={() => setAbierta(abiertaActual ? null : i)}
                  aria-expanded={abiertaActual}
                  className="btn-press flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-zinc-900 dark:text-zinc-50"
                >
                  {faq.pregunta}
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`shrink-0 text-brand-orange transition-transform duration-300 motion-reduce:transition-none ${
                      abiertaActual ? 'rotate-180' : ''
                    }`}
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                <div
                  className={`grid transition-all duration-300 ease-out motion-reduce:transition-none ${
                    abiertaActual ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-4 text-sm text-zinc-600 dark:text-zinc-400">
                      {faq.respuesta}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          ¿Tenés otra duda?{' '}
          <a
            href={whatsappUrl('¡Hola! Tengo una pregunta.')}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-brand-orange transition-colors hover:text-brand-orange/80"
          >
            Escribinos por WhatsApp
          </a>
          .
        </p>
      </div>
    </section>
  );
}
