'use client';

import { useEffect, useRef } from 'react';
import { crearSpriteBrillo } from './sprites';

type Brasa = {
  x: number;
  y: number;
  deriva: number;
  subida: number;
  tamano: number;
  vida: number;
  duracion: number;
  fase: number;
  calida: boolean;
};

const RADIO_CURSOR = 130;

/**
 * Brasas que suben desde la boca del horno. Canvas con un sprite
 * pre-renderizado (sin shadowBlur por partícula) y mezcla aditiva, así
 * aguanta ~120 brasas a 60 fps en un móvil de gama media. Las brasas se
 * apartan del cursor y la animación se pausa cuando el hero sale de
 * pantalla.
 */
export default function BrasasHorno({ retrasoMs = 0 }: { retrasoMs?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const sprites = { calida: crearSpriteBrillo('255, 217, 61'), viva: crearSpriteBrillo('255, 107, 53') };

    let ancho = 0;
    let alto = 0;
    let brasas: Brasa[] = [];
    const cursor = { x: -9999, y: -9999 };

    function nuevaBrasa(enCualquierAltura = false): Brasa {
      return {
        x: Math.random() * ancho,
        y: enCualquierAltura ? Math.random() * alto : alto + Math.random() * 40,
        deriva: (Math.random() - 0.5) * 18,
        subida: 28 + Math.random() * 62,
        tamano: 1.2 + Math.random() * 3.2,
        vida: enCualquierAltura ? Math.random() : 0,
        duracion: 3.5 + Math.random() * 4.5,
        fase: Math.random() * Math.PI * 2,
        calida: Math.random() > 0.55,
      };
    }

    function redimensionar() {
      const rect = canvas!.getBoundingClientRect();
      ancho = rect.width;
      alto = rect.height;
      canvas!.width = ancho * dpr;
      canvas!.height = alto * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cantidad = Math.round((ancho * alto) / 11000);
      brasas = Array.from({ length: Math.max(30, Math.min(cantidad, 120)) }, () =>
        nuevaBrasa(true),
      );
    }

    function dibujar(t: number) {
      ctx!.clearRect(0, 0, ancho, alto);
      ctx!.globalCompositeOperation = 'lighter';
      for (const b of brasas) {
        // Entra suave, se apaga lento y titila como una brasa de verdad.
        const entrada = Math.min(b.vida / 0.15, 1);
        const salida = Math.min((1 - b.vida) / 0.45, 1);
        const titileo = 0.7 + 0.3 * Math.sin(t * 0.013 + b.fase * 3);
        ctx!.globalAlpha = Math.max(0, entrada * salida * titileo);
        const lado = b.tamano * 7;
        ctx!.drawImage(
          b.calida ? sprites.calida : sprites.viva,
          b.x - lado / 2,
          b.y - lado / 2,
          lado,
          lado,
        );
      }
      ctx!.globalAlpha = 1;
      ctx!.globalCompositeOperation = 'source-over';
    }

    function avanzar(dt: number, t: number) {
      for (const b of brasas) {
        b.vida += dt / b.duracion;
        b.y -= b.subida * dt;
        b.x += (b.deriva + Math.sin(t * 0.0015 + b.fase) * 14) * dt;

        const dx = b.x - cursor.x;
        const dy = b.y - cursor.y;
        const distancia = Math.hypot(dx, dy);
        if (distancia < RADIO_CURSOR && distancia > 0.1) {
          const empuje = ((RADIO_CURSOR - distancia) / RADIO_CURSOR) * 220 * dt;
          b.x += (dx / distancia) * empuje;
          b.y += (dy / distancia) * empuje;
        }

        if (b.vida >= 1 || b.y < -20) Object.assign(b, nuevaBrasa());
      }
    }

    function moverCursor(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      cursor.x = e.clientX - rect.left;
      cursor.y = e.clientY - rect.top;
    }
    function soltarCursor() {
      cursor.x = -9999;
      cursor.y = -9999;
    }

    redimensionar();
    window.addEventListener('resize', redimensionar);

    if (reducir) {
      dibujar(0);
      return () => window.removeEventListener('resize', redimensionar);
    }

    window.addEventListener('pointermove', moverCursor, { passive: true });
    document.addEventListener('pointerleave', soltarCursor);

    let raf = 0;
    let ultimo = performance.now();
    function bucle(ahora: number) {
      const dt = Math.min((ahora - ultimo) / 1000, 0.05);
      ultimo = ahora;
      avanzar(dt, ahora);
      dibujar(ahora);
      raf = requestAnimationFrame(bucle);
    }

    // Sin animar fuera de pantalla: el resto de la home no paga este costo.
    const observador = new IntersectionObserver(([entrada]) => {
      cancelAnimationFrame(raf);
      if (entrada.isIntersecting) {
        ultimo = performance.now();
        raf = requestAnimationFrame(bucle);
      }
    });
    // Con retraso, las brasas esperan a que termine la entrada de la pizza:
    // así no compiten por el hilo principal durante la animación del hero.
    const arranque = window.setTimeout(() => observador.observe(canvas), retrasoMs);

    return () => {
      window.clearTimeout(arranque);
      observador.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', redimensionar);
      window.removeEventListener('pointermove', moverCursor);
      document.removeEventListener('pointerleave', soltarCursor);
    };
  }, [retrasoMs]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  );
}
