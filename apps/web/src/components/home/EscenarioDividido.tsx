'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { NEGOCIO } from '@/lib/negocio';

export type FotoEscenario = { src: string; alt: string; posicion?: string };

/**
 * Media pantalla que no se mueve: la foto de la pizza queda fija mientras
 * la otra mitad se lee. Cada bloque de la columna marcado con
 * data-foto="n" trae su foto cuando cruza la mitad de la pantalla, con un
 * fundido lento. En el celular la foto va arriba y la columna sube por
 * encima de ella.
 */
export default function EscenarioDividido({
  fotos,
  children,
}: {
  fotos: FotoEscenario[];
  children: ReactNode;
}) {
  const columna = useRef<HTMLDivElement>(null);
  const [activa, setActiva] = useState(0);

  useEffect(() => {
    const bloques = columna.current?.querySelectorAll<HTMLElement>('[data-foto]');
    if (!bloques || bloques.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActiva(Number((e.target as HTMLElement).dataset.foto) || 0);
        }
      },
      // Una línea en la mitad de la pantalla: el bloque que la cruza manda.
      { rootMargin: '-50% 0px -50% 0px' },
    );
    bloques.forEach((b) => observer.observe(b));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="escenario">
      <div ref={columna} className="escenario-columna">
        {children}
      </div>

      <div className="escenario-foto">
        {fotos.map((foto, i) => (
          <div key={foto.src} className="escenario-capa" data-activa={i === activa}>
            <Image
              src={foto.src}
              alt={i === activa ? foto.alt : ''}
              fill
              priority={i === 0}
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
              style={{ objectPosition: foto.posicion ?? 'center' }}
            />
          </div>
        ))}
        <p className="t-chico absolute inset-x-0 bottom-0 z-10 flex min-h-14 flex-wrap items-center justify-between gap-x-6 gap-y-1 bg-[var(--background)] px-5 py-2 text-[var(--foreground)]">
          <span>{NEGOCIO.horario}</span>
          <span>{NEGOCIO.direccion.split(',')[0]}, Riohacha</span>
        </p>
      </div>
    </div>
  );
}
