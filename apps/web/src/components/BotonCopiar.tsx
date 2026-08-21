'use client';

import { useState } from 'react';

function IconCopiar() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconListo() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export default function BotonCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      // Sin permiso de portapapeles — el número ya está visible para copiar a mano.
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      className="btn-press flex shrink-0 items-center gap-1.5 rounded-md border border-[#820AD1]/30 bg-[#820AD1]/10 px-2.5 py-1.5 text-xs font-semibold text-[#820AD1] transition-colors hover:bg-[#820AD1]/20 dark:border-[#c084fc]/30 dark:bg-[#c084fc]/10 dark:text-[#c084fc] dark:hover:bg-[#c084fc]/20"
    >
      {copiado ? <IconListo /> : <IconCopiar />}
      {copiado ? 'Copiado' : 'Copiar'}
    </button>
  );
}
