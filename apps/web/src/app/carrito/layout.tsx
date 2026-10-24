import type { ReactNode } from 'react';
import { METADATA_PRIVADA } from '@/lib/seo';

// Página privada: no se indexa, pero Google puede seguir sus enlaces.
export const metadata = METADATA_PRIVADA;

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
