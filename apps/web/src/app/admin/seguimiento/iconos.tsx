import type { ReactNode } from 'react';
import type { Canal } from './tipos';

type PropsIcono = { className?: string };

function Svg({
  children,
  className = 'h-4 w-4',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export const IconEnviar = ({ className }: PropsIcono) => (
  <Svg className={className}>
    <path d="M22 2 11 13" />
    <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
  </Svg>
);

export const IconVolver = ({ className }: PropsIcono) => (
  <Svg className={className}>
    <path d="m15 18-6-6 6-6" />
  </Svg>
);

export const IconBuscar = ({ className }: PropsIcono) => (
  <Svg className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Svg>
);

export const IconAjustes = ({ className }: PropsIcono) => (
  <Svg className={className}>
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="8" cy="17" r="2" />
  </Svg>
);

export const IconBot = ({ className }: PropsIcono) => (
  <Svg className={className}>
    <rect x="4" y="8" width="16" height="12" rx="3" />
    <path d="M12 4v4M9 13v1.5M15 13v1.5" />
  </Svg>
);

export const IconPersona = ({ className }: PropsIcono) => (
  <Svg className={className}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
  </Svg>
);

export const IconCerrar = ({ className }: PropsIcono) => (
  <Svg className={className}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const IconFlechaAbajo = ({ className }: PropsIcono) => (
  <Svg className={className}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </Svg>
);

export const IconBandeja = ({ className }: PropsIcono) => (
  <Svg className={className}>
    <path d="M3 13h5l1.5 3h5L16 13h5" />
    <path d="M5 5h14l2 8v6H3v-6l2-8Z" />
  </Svg>
);

/** Distintivo del canal: un círculo del color de cada plataforma con su glifo. */
export function InsigniaCanal({
  canal,
  tamano = 'md',
}: {
  canal: Canal;
  tamano?: 'sm' | 'md';
}) {
  const caja = tamano === 'sm' ? 'h-6 w-6' : 'h-10 w-10';
  const glifo = tamano === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5';
  const fondo: Record<Canal, string> = {
    whatsapp: 'bg-[#1fa855]',
    messenger: 'bg-gradient-to-br from-[#0a7cff] to-[#a334fa]',
    instagram: 'bg-gradient-to-tr from-[#f9a43a] via-[#e1306c] to-[#7c3aed]',
  };
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full text-white ${caja} ${fondo[canal]}`}
    >
      {canal === 'whatsapp' && (
        <Svg className={glifo}>
          <path d="M20 12a8 8 0 0 1-11.9 7L4 20l1.1-4A8 8 0 1 1 20 12Z" />
          <path d="M9.5 9c.3 2.2 2.3 4.2 5 5l1-1.2-1.6-1-.8.5c-.7-.3-1.4-1-1.7-1.7l.5-.8-1-1.6L9.5 9Z" />
        </Svg>
      )}
      {canal === 'messenger' && (
        <Svg className={glifo}>
          <path d="M12 3a9 9 0 0 0-9 9c0 2.4 1 4.6 2.6 6.2V21l2.9-1.6c.8.2 1.6.4 2.5.4a9 9 0 0 0 0-18Z" />
          <path d="m7.5 13.5 3-3.2 2 1.8 3.5-3.1-3 3.4-2-1.8-3.5 2.9Z" />
        </Svg>
      )}
      {canal === 'instagram' && (
        <Svg className={glifo}>
          <rect x="4" y="4" width="16" height="16" rx="5" />
          <circle cx="12" cy="12" r="3.6" />
          <circle cx="16.8" cy="7.2" r=".6" fill="currentColor" />
        </Svg>
      )}
    </span>
  );
}
