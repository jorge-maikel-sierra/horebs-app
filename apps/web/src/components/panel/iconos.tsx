import type { ReactNode } from 'react';

function Svg({
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

export const IconAlerta = () => (
  <Svg>
    <path d="M12 3 2 20h20L12 3Z" />
    <path d="M12 10v4" />
    <circle cx="12" cy="17" r="0.5" fill="currentColor" />
  </Svg>
);

export const IconWhatsapp = () => (
  <Svg>
    <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 20l1-5.4A8.5 8.5 0 1 1 21 11.5Z" />
    <path d="M8.5 10.5c.3 2.2 2.3 4.2 4.5 4.5" />
  </Svg>
);

export const IconReloj = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </Svg>
);

export const IconMoneda = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v10M9.5 9.5c0-1.4 1.2-2.2 2.7-2.2 1.6 0 2.8.9 2.8 2 0 3-5.5 1.5-5.5 4.4 0 1.2 1.2 2.1 2.8 2.1 1.5 0 2.7-.8 2.7-2.2" />
  </Svg>
);

export const IconTicket = () => (
  <Svg>
    <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Z" />
    <path d="M9 6v12" strokeDasharray="2 2" />
  </Svg>
);

export const IconArticulos = () => (
  <Svg>
    <path d="M21 8 12 3 3 8l9 5 9-5Z" />
    <path d="M3 8v8l9 5 9-5V8" />
    <path d="M12 13v8" />
  </Svg>
);

export const IconCheck = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12 3 3 5-6" />
  </Svg>
);

export const IconFlechaDerecha = () => (
  <Svg tamano={16}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);
