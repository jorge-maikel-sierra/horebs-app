'use client';

import { useEffect, useRef } from 'react';

type Drop = {
  x: number;
  y: number;
  len: number;
  speed: number;
  opacity: number;
  hue: 'orange' | 'yellow';
};

const COLORS = {
  orange: '255, 107, 53',
  yellow: '255, 217, 61',
};

export default function HeroEffect() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let width = 0;
    let height = 0;
    let drops: Drop[] = [];

    function makeDrop(randomY = false): Drop {
      return {
        x: Math.random() * width,
        y: randomY ? Math.random() * height : -20,
        len: 14 + Math.random() * 26,
        speed: 90 + Math.random() * 140,
        opacity: 0.25 + Math.random() * 0.45,
        hue: Math.random() > 0.65 ? 'yellow' : 'orange',
      };
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round((width * height) / 9000);
      drops = Array.from({ length: Math.max(24, Math.min(count, 90)) }, () =>
        makeDrop(true),
      );
    }

    function draw() {
      ctx!.clearRect(0, 0, width, height);
      for (const d of drops) {
        const gradient = ctx!.createLinearGradient(d.x, d.y - d.len, d.x, d.y);
        const rgb = COLORS[d.hue];
        gradient.addColorStop(0, `rgba(${rgb}, 0)`);
        gradient.addColorStop(1, `rgba(${rgb}, ${d.opacity})`);
        ctx!.strokeStyle = gradient;
        ctx!.lineWidth = 1.4;
        ctx!.beginPath();
        ctx!.moveTo(d.x, d.y - d.len);
        ctx!.lineTo(d.x, d.y);
        ctx!.stroke();
      }
    }

    resize();
    window.addEventListener('resize', resize);

    if (reduceMotion) {
      draw();
      return () => window.removeEventListener('resize', resize);
    }

    let last = performance.now();
    let raf = 0;
    function loop(now: number) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      for (const d of drops) {
        d.y += d.speed * dt;
        if (d.y - d.len > height) Object.assign(d, makeDrop());
      }
      draw();
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  );
}
