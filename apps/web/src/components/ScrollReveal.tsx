'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

export default function ScrollReveal({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      // rootMargin dispara el reveal ~300px antes de que el elemento entre
      // en pantalla, para que ya esté visible cuando el usuario llega a él
      // scrolleando, en vez de "aparecer con demora".
      { threshold: 0.01, rootMargin: '0px 0px 300px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? 'reveal-visible' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
