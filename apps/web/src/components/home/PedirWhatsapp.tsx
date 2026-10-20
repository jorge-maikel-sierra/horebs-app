import type { CSSProperties } from 'react';
import Link from 'next/link';
import { NEGOCIO, URL_COMO_LLEGAR, whatsappUrl } from '@/lib/negocio';
import WhatsappCta from '@/components/WhatsappCta';
import EstadoAbierto from '@/components/EstadoAbierto';

function escalon(d: number) {
  return { '--d': d } as CSSProperties;
}

/**
 * El cierre de la home: una pantalla navy con el número de WhatsApp como
 * letra de cartel, de margen a margen, que es el canal donde se confirman
 * los pedidos. En las esquinas, dónde y cuándo, y el camino online.
 */
export default function PedirWhatsapp() {
  return (
    <section
      id="pedir"
      aria-labelledby="titulo-pedir"
      data-entrada
      className="superficie-oscura flex min-h-[80svh] flex-col justify-between gap-12 bg-brand-navy px-[var(--margen)] py-[clamp(3rem,6vw,5rem)] text-white"
    >
      <h2 id="titulo-pedir" style={escalon(0)} className="entra t-entrada max-w-[26ch]">
        Escríbenos por WhatsApp y te confirmamos el pedido.
      </h2>

      <WhatsappCta
        href={whatsappUrl('¡Hola! Quiero hacer un pedido.')}
        ariaLabel={`Pedir por WhatsApp al ${NEGOCIO.whatsapp} (se abre en una pestaña nueva)`}
        className="group block"
      >
        <span
          style={escalon(1)}
          className="entra t-cartel block tabular-nums transition-colors duration-300 group-hover:text-brand-yellow-500"
        >
          {NEGOCIO.whatsapp}
        </span>
      </WhatsappCta>

      <div className="t-cuerpo grid gap-10 sm:grid-cols-2 sm:items-end">
        <div style={escalon(2)} className="entra space-y-2">
          <EstadoAbierto className="font-semibold" />
          <p>{NEGOCIO.horario}</p>
          <p>{NEGOCIO.direccion}</p>
          <a
            href={URL_COMO_LLEGAR}
            target="_blank"
            rel="noopener noreferrer"
            className="enlace inline-block font-semibold text-brand-yellow-500"
          >
            Cómo llegar
            <span className="sr-only"> (se abre en Google Maps)</span>
          </a>
        </div>
        <div style={escalon(3)} className="entra flex flex-col gap-5 sm:items-end sm:text-right">
          <p className="max-w-[30ch]">¿Prefieres armarlo tú? Elige en la carta y paga en efectivo o por transferencia.</p>
          <Link href="/catalogo" className="boton boton-pedir self-start sm:self-end">
            Pedir online
          </Link>
          <p className="flex gap-6">
            <a href={NEGOCIO.instagram} target="_blank" rel="noopener noreferrer" className="enlace">
              Instagram
            </a>
            <a href={NEGOCIO.facebook} target="_blank" rel="noopener noreferrer" className="enlace">
              Facebook
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
