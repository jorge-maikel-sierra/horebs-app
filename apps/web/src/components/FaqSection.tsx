'use client';

import { useState } from 'react';
import { whatsappUrl } from '@/lib/negocio';
import { FAQS, PREGUNTAS_DESTACADAS } from '@/lib/faqs';
import WhatsappCta from '@/components/WhatsappCta';

export default function FaqSection() {
  const [abierta, setAbierta] = useState<number | null>(0);
  const [verTodas, setVerTodas] = useState(false);

  return (
    <section aria-labelledby="titulo-faq" className="px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <h2 id="titulo-faq" className="text-center text-2xl font-bold text-zinc-900 sm:text-3xl dark:text-zinc-50">
          Preguntas frecuentes
        </h2>
        <p className="mx-auto mt-2 max-w-md text-center text-zinc-600 dark:text-zinc-400">
          Lo que más nos preguntan antes de pedir.
        </p>

        <div className="mt-8 space-y-3">
          {FAQS.map((faq, i) => {
            const abiertaActual = abierta === i;
            const idPanel = `faq-respuesta-${i}`;
            return (
              <div
                key={faq.pregunta}
                // Las no destacadas quedan en el HTML (el JSON-LD de FAQ de la
                // home las declara) pero ocultas hasta "Ver las N preguntas".
                hidden={!verTodas && i >= PREGUNTAS_DESTACADAS}
                className="card-gradient overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800"
              >
                <button
                  type="button"
                  onClick={() => setAbierta(abiertaActual ? null : i)}
                  aria-expanded={abiertaActual}
                  aria-controls={idPanel}
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
                    aria-hidden="true"
                    className={`shrink-0 text-accent-ink transition-transform duration-300 motion-reduce:transition-none ${
                      abiertaActual ? 'rotate-180' : ''
                    }`}
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                <div
                  id={idPanel}
                  // Cerrada sigue en el DOM para animar la altura; inert la
                  // saca del árbol de accesibilidad y del orden de Tab.
                  inert={!abiertaActual}
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

        {FAQS.length > PREGUNTAS_DESTACADAS && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setVerTodas((v) => !v)}
              aria-expanded={verTodas}
              className="btn-press rounded-lg px-4 py-2.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              {verTodas
                ? 'Ver menos preguntas'
                : `Ver las ${FAQS.length} preguntas`}
            </button>
          </div>
        )}

        <p className="mt-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          ¿Tienes otra duda?{' '}
          <WhatsappCta
            href={whatsappUrl('¡Hola! Tengo una pregunta.')}
            className="font-semibold text-accent-ink underline-offset-2 transition-colors hover:underline"
          >
            Escríbenos por WhatsApp
          </WhatsappCta>
          .
        </p>
      </div>
    </section>
  );
}
