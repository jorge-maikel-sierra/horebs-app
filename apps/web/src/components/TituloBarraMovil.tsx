'use client';

import { useEffect, useState } from 'react';

/** Alto de la barra fija de teléfono (py-3 + botones de 36px + borde). */
const ALTO_BARRA_PX = 61;

/**
 * Título de la barra superior en teléfono, como el "título grande" de iOS:
 * si la página marca su encabezado con `data-titulo-pagina`, el nombre
 * aparece en la barra solo cuando ese encabezado se va por debajo de ella,
 * así no se lee dos veces. Sin encabezado marcado, se ve siempre.
 * El llamador le pone `key={pathname}`: cada página arranca de cero.
 */
export default function TituloBarraMovil({ titulo }: { titulo: string }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let observador: IntersectionObserver | null = null;

    function observar(h1: Element) {
      observador = new IntersectionObserver(
        ([e]) => setVisible(!e.isIntersecting),
        { rootMargin: `-${ALTO_BARRA_PX}px 0px 0px 0px` },
      );
      observador.observe(h1);
    }

    // La página puede montar su encabezado después (sesión, Suspense):
    // se espera a que aparezca en vez de suponer que no existe.
    const buscar = () => document.querySelector('[data-titulo-pagina]');
    const inicial = buscar();
    if (inicial) {
      observar(inicial);
      return () => observador?.disconnect();
    }
    const mutaciones = new MutationObserver(() => {
      const h1 = buscar();
      if (!h1) return;
      mutaciones.disconnect();
      observar(h1);
    });
    mutaciones.observe(document.body, { childList: true, subtree: true });
    return () => {
      mutaciones.disconnect();
      observador?.disconnect();
    };
  }, []);

  return (
    <span
      aria-hidden={!visible}
      className={`truncate text-sm font-bold text-zinc-900 transition-[opacity,translate] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none dark:text-zinc-50 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'
      }`}
    >
      {titulo}
    </span>
  );
}
