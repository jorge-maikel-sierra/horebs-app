import type { ReactNode } from 'react';

function Icono({
  children,
  tamano = 18,
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

export const IconoMas = () => (
  <Icono>
    <path d="M12 5v14M5 12h14" />
  </Icono>
);
export const IconoLupa = () => (
  <Icono tamano={16}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icono>
);
export const IconoFlecha = () => (
  <Icono>
    <path d="M15 6l-6 6 6 6" />
  </Icono>
);
export const IconoEditar = () => (
  <Icono>
    <path d="M4 20h4L19 9l-4-4L4 16v4z" />
    <path d="m13.5 6.5 4 4" />
  </Icono>
);
export const IconoPapelera = () => (
  <Icono>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3" />
  </Icono>
);
export const IconoExterno = () => (
  <Icono>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </Icono>
);
export const IconoDocumento = () => (
  <Icono tamano={22}>
    <path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
    <path d="M14 3v5h5M9 13h6M9 17h6" />
  </Icono>
);
export const IconoImagen = () => (
  <Icono tamano={22}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m21 16-5-5-8 8" />
  </Icono>
);
export const IconoLista = () => (
  <Icono tamano={16}>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4.5" cy="6" r="1" />
    <circle cx="4.5" cy="12" r="1" />
    <circle cx="4.5" cy="18" r="1" />
  </Icono>
);
export const IconoListaNumerada = () => (
  <Icono tamano={16}>
    <path d="M10 6h10M10 12h10M10 18h10M4 5l1-1v4M4 14.5c.5-1 2-1 2 0s-2 1.5-2 2.5h2.2" />
  </Icono>
);
export const IconoCita = () => (
  <Icono tamano={16}>
    <path d="M6 17a3 3 0 0 1-3-3v-3a5 5 0 0 1 5-5M16 17a3 3 0 0 1-3-3v-3a5 5 0 0 1 5-5" />
  </Icono>
);
export const IconoEnlace = () => (
  <Icono tamano={16}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1" />
  </Icono>
);
