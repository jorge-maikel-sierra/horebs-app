'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

/**
 * Rota entre frases con un giro tipo letrero. La primera se renderiza en
 * el servidor ya visible; las siguientes entran tras hidratar.
 */
export default function PalabraRotativa({
  palabras,
  intervalo = 2600,
}: {
  palabras: readonly string[];
  intervalo?: number;
}) {
  const reducir = useReducedMotion();
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    if (reducir) return;
    const id = window.setInterval(
      () => setIndice((i) => (i + 1) % palabras.length),
      intervalo,
    );
    return () => window.clearInterval(id);
  }, [reducir, palabras.length, intervalo]);

  return (
    // inline-grid es atómico: si la frase no cabe al lado de "Pizza", baja
    // entera a la línea siguiente en vez de partirse.
    <span className="relative inline-grid overflow-hidden whitespace-nowrap align-bottom [perspective:600px]">
      {/* Reserva el ancho de la frase más larga para que el texto no salte. */}
      {palabras.map((p) => (
        <span key={p} aria-hidden="true" className="invisible col-start-1 row-start-1">
          {p}
        </span>
      ))}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={palabras[indice]}
          className="col-start-1 row-start-1 justify-self-start bg-gradient-to-r from-brand-yellow to-brand-orange bg-clip-text text-transparent"
          initial={{ y: '90%', rotateX: -80, opacity: 0 }}
          animate={{ y: '0%', rotateX: 0, opacity: 1 }}
          exit={{ y: '-90%', rotateX: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        >
          {palabras[indice]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
