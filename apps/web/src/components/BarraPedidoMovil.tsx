'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { whatsappUrl } from '@/lib/negocio';
import WhatsappCta from '@/components/WhatsappCta';

/**
 * Barra fija abajo, solo en mobile, con los dos caminos para pedir. Aparece
 * cuando el hero (y sus CTA) ya salió de pantalla, para que el pedido quede
 * siempre a un toque en una home de varias pantallas de alto. En desktop
 * no hace falta: el header ya tiene Catálogo y Carrito a la vista.
 */
export default function BarraPedidoMovil({ idHero }: { idHero: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById(idHero);
    if (!hero) return;
    // Se oculta otra vez al llegar al footer: ahí ya están los contactos y
    // la barra taparía su última línea.
    const footer = document.querySelector('footer');
    const enPantalla = new Map<Element, boolean>();
    const observer = new IntersectionObserver((entries) => {
      for (const e of entries) enPantalla.set(e.target, e.isIntersecting);
      setVisible(!enPantalla.get(hero) && !(footer && enPantalla.get(footer)));
    });
    observer.observe(hero);
    if (footer) observer.observe(footer);
    return () => observer.disconnect();
  }, [idHero]);

  return (
    <div
      // Fuera de pantalla no se puede enfocar ni la anuncian los lectores.
      inert={!visible}
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200/70 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.25)] backdrop-blur-md transition-transform duration-300 motion-reduce:transition-none sm:hidden dark:border-zinc-800/70 dark:bg-zinc-950/95 ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="mx-auto flex max-w-md gap-3">
        <Link
          href="/catalogo"
          className="btn-press btn-gradient flex-1 rounded-lg px-4 py-3 text-center font-semibold text-white"
        >
          Pedir online
        </Link>
        <WhatsappCta
          href={whatsappUrl('¡Hola! Quiero hacer un pedido.')}
          className="btn-press flex-1 rounded-lg border border-zinc-300 px-4 py-3 text-center font-semibold text-zinc-900 dark:border-zinc-700 dark:text-zinc-50"
        >
          Por WhatsApp
        </WhatsappCta>
      </div>
    </div>
  );
}
