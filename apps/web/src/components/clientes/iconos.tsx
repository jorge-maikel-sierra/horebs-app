import type { ReactNode } from 'react';

function Svg({
  children,
  tamano = 16,
}: {
  children: ReactNode;
  tamano?: number;
}) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

export const IconLupa = () => (
  <Svg>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Svg>
);
export const IconX = () => (
  <Svg tamano={14}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
export const IconWhatsapp = () => (
  <Svg tamano={18}>
    <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 20l1-5.4A8.5 8.5 0 1 1 21 11.5Z" />
    <path d="M8.5 10.5c.3 2.2 2.3 4.2 4.5 4.5" />
  </Svg>
);
export const IconPapelera = () => (
  <Svg tamano={18}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3" />
  </Svg>
);
export const IconEstrella = ({ tamano = 14 }: { tamano?: number }) => (
  <svg
    width={tamano}
    height={tamano}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className="shrink-0"
  >
    <path d="m12 2.8 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.6l-5.8 3.1 1.1-6.5L2.6 9.6l6.5-.9L12 2.8Z" />
  </svg>
);
export const IconUsuarioMas = () => (
  <Svg tamano={20}>
    <circle cx="10" cy="8" r="3.5" />
    <path d="M3 20c0-3.9 3.1-7 7-7 1.3 0 2.5.4 3.5 1M18 14v6M15 17h6" />
  </Svg>
);
export const IconChequeo = () => (
  <Svg tamano={20}>
    <circle cx="10" cy="8" r="3.5" />
    <path d="M3 20c0-3.9 3.1-7 7-7 1.3 0 2.5.4 3.5 1M15 18l2 2 4-4" />
  </Svg>
);
export const IconFlechaIzq = () => (
  <Svg>
    <path d="M15 6l-6 6 6 6" />
  </Svg>
);
export const IconFlechaDer = () => (
  <Svg>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);
export const IconTelefono = ({ tamano = 13 }: { tamano?: number }) => (
  <Svg tamano={tamano}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z" />
  </Svg>
);
export const IconPin = ({ tamano = 13 }: { tamano?: number }) => (
  <Svg tamano={tamano}>
    <path d="M12 21s-6-5.6-6-10.5a6 6 0 1 1 12 0C18 15.4 12 21 12 21Z" />
    <circle cx="12" cy="10.5" r="2" />
  </Svg>
);
export const IconCorreo = ({ tamano = 13 }: { tamano?: number }) => (
  <Svg tamano={tamano}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </Svg>
);

export const IconLapiz = () => (
  <Svg tamano={16}>
    <path d="M4 20h4L19 9l-4-4L4 16v4z" />
    <path d="m13.5 6.5 4 4" />
  </Svg>
);
export const IconId = ({ tamano = 16 }: { tamano?: number }) => (
  <Svg tamano={tamano}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="9" cy="11" r="2" />
    <path d="M6.5 16c.4-1.3 1.4-2 2.5-2s2.1.7 2.5 2M14 10h4M14 14h3" />
  </Svg>
);
export const IconVolver = () => (
  <Svg>
    <path d="M15 6l-6 6 6 6" />
  </Svg>
);
