import type { ReactNode } from 'react';

function Icono({ children, tamano = 18 }: { children: ReactNode; tamano?: number }) {
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
    >
      {children}
    </svg>
  );
}

export function IconMoneda() {
  return (
    <Icono>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 9.5c0-1.4 1.2-2.2 2.7-2.2 1.6 0 2.8.9 2.8 2 0 3-5.5 1.5-5.5 4.4 0 1.2 1.2 2.1 2.8 2.1 1.5 0 2.7-.8 2.7-2.2" />
    </Icono>
  );
}

export function IconTendencia() {
  return (
    <Icono>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </Icono>
  );
}

export function IconPedidos() {
  return (
    <Icono>
      <path d="M7 3h10a1 1 0 0 1 1 1v16l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1Z" />
      <path d="M9 8h6M9 12h6" />
    </Icono>
  );
}

export function IconArticulos() {
  return (
    <Icono>
      <path d="M21 8 12 3 3 8l9 5 9-5Z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </Icono>
  );
}

export function IconTicket() {
  return (
    <Icono>
      <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Z" />
      <path d="M9 6v12" strokeDasharray="2 2" />
    </Icono>
  );
}

export function IconMoto() {
  return (
    <Icono>
      <circle cx="6" cy="17" r="3" />
      <circle cx="18" cy="17" r="3" />
      <path d="M6 17 9 9h4l2 4h3" />
      <path d="M9 9 8 6H6" />
    </Icono>
  );
}

export function IconClienteNuevo() {
  return (
    <Icono>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M18 8v6M15 11h6" />
    </Icono>
  );
}

export function IconClienteRecurrente() {
  return (
    <Icono>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M17 8a3 3 0 1 1-1 5.8" />
      <path d="M20 8v3h-3" />
    </Icono>
  );
}

export function IconChat() {
  return (
    <Icono tamano={20}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Icono>
  );
}
