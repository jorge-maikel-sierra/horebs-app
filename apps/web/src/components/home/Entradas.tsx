'use client';

import { useEffect } from 'react';

/**
 * Activa la entrada escalonada de las secciones de la home ([data-entrada]
 * con hijos .entra). Las que ya están en pantalla al montar se marcan antes
 * de esconder nada, así la primera pantalla no parpadea; sin JS todo queda
 * visible porque el CSS solo esconde bajo .home[data-movimiento].
 */
export default function Entradas() {
  useEffect(() => {
    const home = document.querySelector<HTMLElement>('.home');
    if (!home) return;
    const secciones = [...home.querySelectorAll<HTMLElement>('[data-entrada]')];
    const alto = window.innerHeight;
    for (const s of secciones) {
      const r = s.getBoundingClientRect();
      if (r.top < alto && r.bottom > 0) s.classList.add('visto');
    }
    home.dataset.movimiento = '';

    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('visto');
          observer.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    );
    secciones.filter((s) => !s.classList.contains('visto')).forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  return null;
}
