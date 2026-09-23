'use client';

import type { ReactNode } from 'react';
import { trackContact } from '@/lib/analytics';

export default function WhatsappCta({
  href,
  className,
  ariaLabel,
  children,
}: {
  href: string;
  className?: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackContact()}
      aria-label={ariaLabel}
      className={className}
    >
      {children}
    </a>
  );
}
