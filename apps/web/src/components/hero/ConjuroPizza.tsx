'use client';

import Image from 'next/image';
import { useEffect, useRef, type ReactNode } from 'react';
import { crearPincel, crearSpriteBrillo, crearSpriteHumo } from './sprites';

// Coreografía (segundos desde que arranca el efecto).
const T_ESPIRAL = 2.5; // la estela baja de arriba hacia abajo
const T_FLORECE = 3.0; // un destello desde el centro cierra los huecos
const T_LISTO = 3.15; // aparece la foto real, nítida
const T_FUNDIDO = 0.55; // duración del fundido hacia la foto real
const PASOS = 900; // sellos de pincel a lo largo de la estela

const clamp = (x: number) => Math.min(1, Math.max(0, x));
function suave(a: number, b: number, x: number) {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

type Particula = {
  tipo: 'humo' | 'chispa';
  x: number;
  y: number;
  vx: number;
  vy: number;
  vida: number;
  dur: number;
  tam: number;
  alfa: number;
};

/** Contorno de arco: semicírculo arriba y esquinas suaves abajo. */
function trazarArco(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const r = w / 2;
  const br = w * 0.05;
  ctx.beginPath();
  ctx.moveTo(0, r);
  ctx.arc(r, r, r, Math.PI, 0);
  ctx.lineTo(w, h - br);
  ctx.arcTo(w, h, w - br, h, br);
  ctx.lineTo(br, h);
  ctx.arcTo(0, h, 0, h - br, br);
  ctx.closePath();
}

/**
 * La Pizza Horebs Especial se descubre como si saliera de la lámpara: una
 * estela de humo dorado baja en espiral desde arriba del hero y la foto
 * aparece por donde pasa. Todo es un canvas que se detiene (y se libera) a
 * los ~4 s; la foto real (<img>) queda debajo, nítida y accesible, y el
 * canvas solo hace de telón. Sin JS, o con "reducir movimiento", la foto
 * aparece sin espiral.
 */
export default function ConjuroPizza({ insignia }: { insignia?: ReactNode }) {
  const escenaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const escena = escenaRef.current;
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!escena || !canvas || !img) return;
    const ctx = canvas.getContext('2d');

    const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducir || !ctx) {
      escena.dataset.fase = 'listo';
      return;
    }

    let cancelado = false;
    let detener = () => {};
    img
      .decode()
      .catch(() => undefined)
      .then(() => {
        if (!cancelado) detener = iniciar();
      });

    function iniciar(): () => void {
      const lienzo = canvas!;
      const pantalla = ctx!;
      // offsetParent es null mientras el canvas está con display:none.
      lienzo.style.display = 'block';
      const sec = lienzo.closest('section');
      const padre = lienzo.offsetParent;
      if (!img!.naturalWidth || !sec || !(padre instanceof HTMLElement)) {
        lienzo.style.display = 'none';
        escena!.dataset.fase = 'listo';
        return () => {};
      }

      // El canvas cubre todo el hero para que la estela nazca en el borde
      // superior; la foto se pinta solo en el rectángulo de la escena.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const rs = sec.getBoundingClientRect();
      const rp = padre.getBoundingClientRect();
      const re = escena!.getBoundingClientRect();
      const W = rs.width;
      const H = rs.height;
      lienzo.style.left = `${rs.left - rp.left}px`;
      lienzo.style.top = `${rs.top - rp.top}px`;
      lienzo.style.width = `${W}px`;
      lienzo.style.height = `${H}px`;
      lienzo.width = Math.round(W * dpr);
      lienzo.height = Math.round(H * dpr);
      pantalla.setTransform(dpr, 0, 0, dpr, 0, 0);

      const S = { x: re.left - rs.left, y: re.top - rs.top, w: re.width, h: re.height };
      const esc = S.w / 520;

      const foto = document.createElement('canvas');
      foto.width = Math.round(S.w * dpr);
      foto.height = Math.round(S.h * dpr);
      const fctx = foto.getContext('2d')!;
      // La máscara va a media resolución: sus bordes ya son difusos y cuesta
      // la cuarta parte de píxeles.
      const mascara = document.createElement('canvas');
      mascara.width = Math.max(1, Math.round((S.w * dpr) / 2));
      mascara.height = Math.max(1, Math.round((S.h * dpr) / 2));
      const mctx = mascara.getContext('2d')!;
      const kM = mascara.width / S.w;

      const pincel = crearPincel();
      const humo = crearSpriteHumo('255, 196, 110');
      const brillo = crearSpriteBrillo('255, 217, 61');

      // "Cover" centrado, igual que object-cover del <img>. Se dibuja la imagen
      // completa escalada, sin rectángulo de origen: naturalWidth viene
      // corregido por la densidad del srcset y no coincide con los píxeles
      // reales del bitmap, así que un recorte de origen saldría equivocado.
      const nw = img!.naturalWidth;
      const nh = img!.naturalHeight;
      const escalaFoto = Math.max(S.w / nw, S.h / nh);
      const fw = nw * escalaFoto;
      const fh = nh * escalaFoto;
      const fx = (S.w - fw) / 2;
      const fy = (S.h - fh) / 2;

      function componerFoto() {
        fctx.setTransform(1, 0, 0, 1, 0, 0);
        fctx.globalCompositeOperation = 'source-over';
        fctx.clearRect(0, 0, foto.width, foto.height);
        fctx.save();
        fctx.scale(foto.width / S.w, foto.height / S.h);
        trazarArco(fctx, S.w, S.h);
        fctx.clip();
        fctx.drawImage(img!, fx, fy, fw, fh);
        fctx.restore();
        fctx.globalCompositeOperation = 'destination-in';
        fctx.drawImage(mascara, 0, 0, foto.width, foto.height);
        fctx.globalCompositeOperation = 'source-over';
      }

      function estampar(x: number, y: number, r: number) {
        mctx.drawImage(pincel, (x - r) * kM, (y - r) * kM, 2 * r * kM, 2 * r * kM);
      }

      // Hélice que baja desde el borde superior del hero: hilo fino arriba y
      // una espiral cada vez más ancha sobre la foto.
      const yTop = -12;
      const yBot = S.y + S.h * 1.02;
      const vueltas = (yBot - yTop) / (S.w * 0.42);
      function pos(p: number) {
        const amp = S.w * (0.05 + 0.46 * suave(0.04, 0.85, p));
        const ang = Math.PI * 2 * vueltas * p;
        return {
          x: S.x + S.w / 2 + amp * Math.cos(ang),
          y: yTop + (yBot - yTop) * p + S.w * 0.05 * Math.sin(ang),
        };
      }

      const particulas: Particula[] = [];
      function emitir(p: Particula) {
        if (particulas.length < 340) particulas.push(p);
      }
      const rnd = (a: number, b: number) => a + Math.random() * (b - a);

      // Rastro de luz: los últimos instantes de la cabeza, como pintar con luz.
      const rastro: { x: number; y: number; t: number }[] = [];
      let pPincel = 0;
      let acumHumo = 0;
      let acumChispa = 0;
      let estallido = false;
      let listoMarcado = false;
      let raf = 0;
      let terminado = false;
      const inicio = performance.now();
      let previo = inicio;

      escena!.dataset.fase = 'animando';

      function cuadro(ahora: number) {
        const t = (ahora - inicio) / 1000;
        const dt = Math.min((ahora - previo) / 1000, 0.05);
        previo = ahora;

        const x = clamp(t / T_ESPIRAL);
        const p = 0.5 * x + 0.5 * suave(0, 1, x);

        // 1) La estela abre la máscara.
        const r = 0.26 * S.w;
        while (pPincel < p) {
          pPincel += 1 / PASOS;
          const q = pos(Math.min(pPincel, 1));
          const lx = q.x - S.x;
          const ly = q.y - S.y;
          estampar(lx, ly, r * rnd(0.8, 1.1));
          estampar(lx + rnd(-0.25, 0.25) * r, ly + rnd(-0.25, 0.25) * r, r * rnd(0.7, 1.1));
        }

        // 2) Al terminar la espiral, un destello desde el centro cierra huecos.
        const b = clamp((t - T_ESPIRAL * 0.96) / (T_FLORECE - T_ESPIRAL * 0.96));
        if (b > 0) {
          const radio = (1 - (1 - b) * (1 - b)) * 0.58 * Math.hypot(S.w, S.h);
          estampar(S.w / 2, S.h / 2, radio);
        }
        if (b > 0.3 && !estallido) {
          estallido = true;
          for (let i = 0; i < 38; i++) {
            const a = Math.random() * Math.PI * 2;
            const v = rnd(150, 380) * esc;
            emitir({
              tipo: 'chispa',
              x: S.x + S.w / 2,
              y: S.y + S.h / 2,
              vx: Math.cos(a) * v,
              vy: Math.sin(a) * v,
              vida: 0,
              dur: rnd(0.6, 1.2),
              tam: rnd(10, 22) * esc,
              alfa: 1,
            });
          }
        }

        // 3) Humo y chispas nacen en la cabeza de la estela.
        const cabeza = pos(Math.min(p, 1));
        if (x < 1) {
          acumHumo += 90 * dt;
          while (acumHumo >= 1) {
            acumHumo -= 1;
            emitir({
              tipo: 'humo',
              x: cabeza.x + rnd(-10, 10) * esc,
              y: cabeza.y + rnd(-10, 10) * esc,
              vx: rnd(-18, 18) * esc,
              vy: rnd(-26, 6) * esc,
              vida: 0,
              dur: rnd(1.4, 2.4),
              tam: rnd(90, 170) * esc,
              alfa: rnd(0.34, 0.6),
            });
          }
          acumChispa += 110 * dt;
          while (acumChispa >= 1) {
            acumChispa -= 1;
            emitir({
              tipo: 'chispa',
              x: cabeza.x + rnd(-6, 6) * esc,
              y: cabeza.y + rnd(-6, 6) * esc,
              vx: rnd(-40, 40) * esc,
              vy: rnd(-20, 50) * esc,
              vida: 0,
              dur: rnd(0.5, 1.1),
              tam: rnd(7, 16) * esc,
              alfa: 1,
            });
          }
        }

        // 4) Pintar: foto enmascarada, luego luz aditiva por encima.
        pantalla.setTransform(dpr, 0, 0, dpr, 0, 0);
        pantalla.clearRect(0, 0, W, H);
        if (t < T_LISTO + T_FUNDIDO + 0.05) {
          componerFoto();
          pantalla.drawImage(foto, S.x, S.y, S.w, S.h);
        }
        pantalla.globalCompositeOperation = 'lighter';
        for (let i = particulas.length - 1; i >= 0; i--) {
          const q = particulas[i];
          q.vida += dt;
          const u = q.vida / q.dur;
          if (u >= 1) {
            particulas.splice(i, 1);
            continue;
          }
          q.x += q.vx * dt;
          q.y += q.vy * dt;
          if (q.tipo === 'humo') {
            q.vx *= 0.985;
            q.vy *= 0.985;
            const lado = q.tam * (1 + 1.3 * u);
            pantalla.globalAlpha = q.alfa * Math.pow(1 - u, 1.4) * Math.min(1, u / 0.12);
            pantalla.drawImage(humo, q.x - lado / 2, q.y - lado / 2, lado, lado);
          } else {
            q.vy += 90 * esc * dt;
            const lado = q.tam * (1 - 0.5 * u);
            pantalla.globalAlpha = 1 - u;
            pantalla.drawImage(brillo, q.x - lado / 2, q.y - lado / 2, lado, lado);
          }
        }
        if (x < 1) {
          rastro.push({ x: cabeza.x, y: cabeza.y, t });
        }
        while (rastro.length && t - rastro[0].t > 0.5) rastro.shift();
        pantalla.lineCap = 'round';
        for (let i = 1; i < rastro.length; i++) {
          const edad = 1 - (t - rastro[i].t) / 0.5;
          pantalla.globalAlpha = Math.max(0, edad) * 0.9;
          pantalla.strokeStyle = edad > 0.55 ? 'rgb(255, 236, 170)' : 'rgb(255, 150, 70)';
          pantalla.lineWidth = (1.5 + 4.5 * edad) * esc;
          pantalla.beginPath();
          pantalla.moveTo(rastro[i - 1].x, rastro[i - 1].y);
          pantalla.lineTo(rastro[i].x, rastro[i].y);
          pantalla.stroke();
        }
        if (x < 1) {
          pantalla.globalAlpha = 0.4;
          pantalla.drawImage(humo, cabeza.x - 110 * esc, cabeza.y - 110 * esc, 220 * esc, 220 * esc);
          pantalla.globalAlpha = 1;
          pantalla.drawImage(brillo, cabeza.x - 45 * esc, cabeza.y - 45 * esc, 90 * esc, 90 * esc);
        }
        if (b > 0 && b < 1) {
          const R = S.w * 0.95;
          pantalla.globalAlpha = Math.sin(Math.PI * b) * 0.5;
          pantalla.drawImage(humo, S.x + S.w / 2 - R, S.y + S.h / 2 - R, 2 * R, 2 * R);
        }
        pantalla.globalAlpha = 1;
        pantalla.globalCompositeOperation = 'source-over';

        if (!listoMarcado && t >= T_LISTO) {
          listoMarcado = true;
          escena!.dataset.fase = 'listo';
        }

        if (t >= T_LISTO + T_FUNDIDO + 0.05 && particulas.length === 0) {
          terminar();
          return;
        }
        raf = requestAnimationFrame(cuadro);
      }

      // Si cambia el tamaño, las medidas ya no sirven: se muestra la foto y listo.
      function alCambiar() {
        escena!.dataset.fase = 'listo';
        terminar();
      }
      function terminar() {
        if (terminado) return;
        terminado = true;
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', alCambiar);
        pantalla.clearRect(0, 0, W, H);
        lienzo.style.display = 'none';
      }

      window.addEventListener('resize', alCambiar);
      raf = requestAnimationFrame(cuadro);
      return terminar;
    }

    return () => {
      cancelado = true;
      detener();
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute z-0 hidden"
      />
      <div
        ref={escenaRef}
        className="conjuro-escena relative z-10 mx-auto aspect-[4/5] w-[min(46vw,172px)] sm:w-[min(50vw,300px)] lg:w-[min(32vw,440px)]"
      >
        <div
          aria-hidden="true"
          className="pizza-brillo absolute -inset-[18%] rounded-full"
        />
        <div className="conjuro-arco absolute inset-0 overflow-hidden">
          <div className="conjuro-zoom absolute inset-0">
            <Image
              ref={imgRef}
              src="/hero-pizza-especial.webp"
              alt="Pizza Horebs Especial: jamón, pollo, pimentón y queso fundido"
              fill
              priority
              sizes="(min-width: 1024px) 440px, (min-width: 640px) 300px, 172px"
              className="conjuro-foto object-cover"
            />
          </div>
        </div>
        <svg
          aria-hidden="true"
          viewBox="0 0 100 125"
          fill="none"
          className="conjuro-marco pointer-events-none absolute -inset-[2.5%] h-[105%] w-[105%] overflow-visible"
        >
          <defs>
            <linearGradient id="conjuro-oro" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#FFD93D" />
              <stop offset="1" stopColor="#FF6B35" />
            </linearGradient>
          </defs>
          <path
            className="conjuro-trazo"
            pathLength={1}
            d="M50 0A50 50 0 0 1 100 50L100 121Q100 125 96 125L4 125Q0 125 0 121L0 50A50 50 0 0 1 50 0Z"
            stroke="url(#conjuro-oro)"
            strokeWidth="0.6"
            strokeLinejoin="round"
          />
        </svg>
        {insignia && (
          <div className="conjuro-insignia absolute -bottom-5 left-1/2 z-20 -translate-x-1/2 sm:-bottom-3 sm:-left-8 sm:translate-x-0">
            {insignia}
          </div>
        )}
      </div>
    </>
  );
}
