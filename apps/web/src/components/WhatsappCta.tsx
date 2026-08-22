'use client';

import type { ReactNode } from 'react';
import { trackContact } from '@/lib/analytics';

export default function WhatsappCta({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackContact()}
      className={className}
    >
      {children}
    </a>
  );
}
