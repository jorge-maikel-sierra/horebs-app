'use client';

import { useLayoutEffect, useRef } from 'react';
import { animate, useReducedMotion } from 'motion/react';

const DURACION_S = 0.7;

/**
 * Cifra principal de una sección: al aparecer cuenta desde cero y al cambiar
 * de período cuenta desde el valor anterior, así el salto se lee como "subió"
 * o "bajó" y no como un parpadeo. Usar solo en la cifra protagonista.
 * El texto lo escribe solo este efecto (React no pinta hijos) para no
 * re-renderizar en cada cuadro ni pelear con React por el nodo de texto.
 * Los lectores de pantalla leen una copia oculta con el valor final.
 */
export default function NumeroAnimado({
  valor,
  formato,
  formatoParcial,
  className,
}: {
  valor: number;
  formato: (n: number) => string;
  /** Formato de los cuadros intermedios (ej. sin decimales); el último usa `formato`. */
  formatoParcial?: (n: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const previo = useRef<number | null>(null);
  const reducir = useReducedMotion();

  // Layout effect: el primer valor se escribe antes de pintar, sin un
  // cuadro vacío ni un salto del número final al anterior.
  useLayoutEffect(() => {
    const nodo = ref.current;
    if (!nodo) return;
    // La primera vez cuenta desde cero: es la cifra que abre la sección.
    const desde = previo.current ?? 0;
    previo.current = valor;
    if (reducir || desde === valor) {
      nodo.textContent = formato(valor);
      return;
    }
    nodo.textContent = formato(desde);
    const control = animate(desde, valor, {
      duration: DURACION_S,
      ease: [0.23, 1, 0.32, 1],
      onUpdate: (v) => {
        nodo.textContent = (formatoParcial ?? formato)(v);
      },
      onComplete: () => {
        nodo.textContent = formato(valor);
      },
    });
    return () => control.stop();
  }, [valor, formato, formatoParcial, reducir]);

  return (
    <>
      <span ref={ref} aria-hidden="true" className={className} />
      <span className="sr-only">{formato(valor)}</span>
    </>
  );
}
