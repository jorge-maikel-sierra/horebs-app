import type { CSSProperties } from 'react';
import { FAQS } from '@/lib/faqs';
import { faqJsonLd, jsonLdScript } from '@/lib/json-ld';
import { whatsappUrl } from '@/lib/negocio';
import WhatsappCta from '@/components/WhatsappCta';

function escalon(d: number) {
  return { '--d': d } as CSSProperties;
}

/**
 * Las preguntas frecuentes como texto corrido, igual que las notas al final
 * de un programa: la pregunta abre el párrafo en negrita y la respuesta
 * sigue en la misma línea. Todo queda a la vista de una vez, sin acordeón,
 * y coincide con el JSON-LD de FAQ.
 */
export default function PreguntasLectura() {
  return (
    <section id="preguntas" aria-labelledby="titulo-preguntas" className="seccion bg-[var(--superficie)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd(FAQS)) }}
      />
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-x-[var(--margen)]">
        <div data-entrada className="min-w-0 lg:sticky lg:top-[calc(var(--alto-header)+2rem)] lg:col-span-3 lg:self-start">
          <h2 id="titulo-preguntas" style={escalon(0)} className="entra t-titulo">
            Antes de pedir
          </h2>
          <p style={escalon(1)} className="entra t-cuerpo mt-5">
            ¿Te queda otra duda?{' '}
            <WhatsappCta
              href={whatsappUrl('¡Hola! Tengo una pregunta.')}
              className="enlace font-semibold"
            >
              Escríbenos por WhatsApp
            </WhatsappCta>
            .
          </p>
        </div>

        <dl
          data-entrada
          className="t-cuerpo min-w-0 md:columns-2 md:gap-x-14 lg:col-span-8 lg:col-start-5"
        >
          {FAQS.map((faq, i) => (
            <div
              key={faq.pregunta}
              style={escalon(Math.min(i, 6))}
              className="entra mb-5 break-inside-avoid"
            >
              <dt className="inline font-semibold">{faq.pregunta}</dt>{' '}
              <dd className="inline">{faq.respuesta}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
