'use client';

import { useState } from 'react';
import { NEGOCIO, whatsappUrl } from '@/lib/negocio';
import { FAQS, PREGUNTAS_DESTACADAS } from '@/lib/faqs';
import WhatsappCta from '@/components/WhatsappCta';

export default function FaqSection() {
  const [abierta, setAbierta] = useState<number | null>(0);
  const [verTodas, setVerTodas] = useState(false);

  return (
    <section
      aria-labelledby="titulo-faq"
      className="border-t border-[var(--carta-linea)] px-6 py-24 sm:py-32"
    >
      <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-32">
            <p className="flex items-center gap-3 text-xs font-semibold tracking-[0.25em] text-accent-ink uppercase">
              Antes de pedir
              <span aria-hidden="true" className="h-px w-8 bg-current opacity-50" />
            </p>
            <h2
              id="titulo-faq"
              className="font-display mt-5 text-balance text-4xl leading-[1.05] text-zinc-900 sm:text-5xl dark:text-zinc-50"
            >
              Preguntas frecuentes
            </h2>
            <p className="mt-5 max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
              Domicilio, pagos y horarios: lo que más nos preguntan antes de
              hacer un pedido.
            </p>

            <div className="mt-10 max-w-md rounded-3xl border border-[var(--carta-linea)] bg-[var(--carta-tarjeta)] p-6">
              <p className="font-display text-xl text-zinc-900 dark:text-zinc-50">
                ¿Tienes otra duda?
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                Escríbenos y te respondemos por WhatsApp al {NEGOCIO.whatsapp}.
              </p>
              <WhatsappCta
                href={whatsappUrl('¡Hola! Tengo una pregunta.')}
                className="btn-press mt-5 inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-125"
              >
                Escríbenos por WhatsApp
                <span aria-hidden="true">→</span>
              </WhatsappCta>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7">
          <ul className="border-t border-[var(--carta-linea)]">
            {FAQS.map((faq, i) => {
              const abiertaActual = abierta === i;
              const idPanel = `faq-respuesta-${i}`;
              return (
                <li
                  key={faq.pregunta}
                  // Las no destacadas quedan en el HTML (el JSON-LD de FAQ de la
                  // home las declara) pero ocultas hasta "Ver las N preguntas".
                  hidden={!verTodas && i >= PREGUNTAS_DESTACADAS}
                  className="border-b border-[var(--carta-linea)]"
                >
                  <h3>
                    <button
                      type="button"
                      onClick={() => setAbierta(abiertaActual ? null : i)}
                      aria-expanded={abiertaActual}
                      aria-controls={idPanel}
                      className="group flex w-full items-baseline gap-5 py-6 text-left"
                    >
                      <span
                        aria-hidden="true"
                        className="font-display w-7 shrink-0 text-sm text-accent-ink tabular-nums"
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="flex-1 text-lg font-semibold text-zinc-900 transition-colors group-hover:text-accent-ink dark:text-zinc-50">
                        {faq.pregunta}
                      </span>
                      <span
                        aria-hidden="true"
                        className={`flex h-8 w-8 shrink-0 translate-y-1 items-center justify-center rounded-full border transition-colors ${
                          abiertaActual
                            ? 'border-transparent bg-brand-orange-700 text-white'
                            : 'border-[var(--carta-linea)] text-zinc-500 dark:text-zinc-400'
                        }`}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="faq-signo h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        >
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      </span>
                    </button>
                  </h3>
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
                      <p className="max-w-xl pr-12 pb-7 pl-12 leading-7 text-zinc-600 dark:text-zinc-400">
                        {faq.respuesta}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {FAQS.length > PREGUNTAS_DESTACADAS && (
            <button
              type="button"
              onClick={() => setVerTodas((v) => !v)}
              aria-expanded={verTodas}
              className="btn-press mt-8 inline-flex items-center gap-2 rounded-full border border-[var(--carta-linea)] bg-[var(--carta-tarjeta)] px-5 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:border-accent-ink hover:text-accent-ink dark:text-zinc-50"
            >
              {verTodas ? 'Ver menos preguntas' : `Ver las ${FAQS.length} preguntas`}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
