import type { CSSProperties } from 'react';

/**
 * Título que entra letra por letra. Es CSS puro (sin JS) para que el h1
 * se pinte con el HTML del servidor y no retrase el LCP. Los lectores de
 * pantalla leen la frase completa, no las letras sueltas.
 */
export default function TituloLetras({
  texto,
  destacar,
  className,
}: {
  texto: string;
  /** Palabra que va con el degradado de marca. */
  destacar?: string;
  className?: string;
}) {
  let indice = 0;
  return (
    <h1 className={className}>
      <span className="sr-only">{texto}</span>
      <span aria-hidden="true">
        {texto.split(' ').map((palabra, p) => (
          <span key={`${palabra}-${p}`}>
            {p > 0 && ' '}
            <span className="inline-block whitespace-nowrap">
              {[...palabra].map((letra, l) => (
                <span
                  key={l}
                  // El degradado va en cada letra: con background-clip en
                  // el padre, las letras transformadas no lo heredan.
                  className={`hero-letra ${palabra === destacar ? 'texto-fuego' : ''}`}
                  style={{ '--i': indice++ } as CSSProperties}
                >
                  {letra}
                </span>
              ))}
            </span>
          </span>
        ))}
      </span>
    </h1>
  );
}
