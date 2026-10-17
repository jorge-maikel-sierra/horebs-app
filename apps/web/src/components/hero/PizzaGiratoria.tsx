'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
} from 'motion/react';

// Grados por segundo en reposo; el scroll suma (o resta, si se sube) giro.
const GIRO_BASE = 7;
const GIRO_MAXIMO = 260;
const TEXTO_ANILLO = 'RECIÉN HORNEADA · MASA ARTESANAL · HECHA EN RIOHACHA · ';

const VAPORES = [
  { x: '34%', retraso: 0, ancho: 'w-24' },
  { x: '58%', retraso: 1.4, ancho: 'w-28' },
  { x: '46%', retraso: 2.8, ancho: 'w-20' },
];

/**
 * La pizza del hero: aterriza al cargar (CSS, no espera a hidratar), gira
 * sola y acelera con la velocidad del scroll, se inclina hacia el cursor y
 * suelta vapor. Con "reducir movimiento" queda quieta.
 */
export default function PizzaGiratoria() {
  const reducir = useReducedMotion();
  const contenedor = useRef<HTMLDivElement>(null);

  const { scrollY } = useScroll();
  const velocidadScroll = useSpring(useVelocity(scrollY), {
    damping: 50,
    stiffness: 260,
  });

  const giro = useMotionValue(0);
  useAnimationFrame((_, delta) => {
    if (reducir) return;
    const extra = Math.max(
      -GIRO_MAXIMO,
      Math.min(GIRO_MAXIMO, velocidadScroll.get() * 0.12),
    );
    giro.set(giro.get() + ((GIRO_BASE + extra) * delta) / 1000);
  });
  const giroAnillo = useTransform(giro, (g) => g * -0.45);

  // Al bajar, la pizza se hunde un poco y se achica: parallax con el texto.
  const desplazamiento = useTransform(scrollY, [0, 700], [0, 120]);
  const escala = useTransform(scrollY, [0, 700], [1, 0.86]);

  const inclinacionX = useSpring(0, { stiffness: 120, damping: 16 });
  const inclinacionY = useSpring(0, { stiffness: 120, damping: 16 });

  useEffect(() => {
    if (reducir || !window.matchMedia('(pointer: fine)').matches) return;
    function mover(e: PointerEvent) {
      const rect = contenedor.current?.getBoundingClientRect();
      if (!rect) return;
      const dx = (e.clientX - (rect.left + rect.width / 2)) / window.innerWidth;
      const dy = (e.clientY - (rect.top + rect.height / 2)) / window.innerHeight;
      inclinacionY.set(dx * 22);
      inclinacionX.set(dy * -22);
    }
    window.addEventListener('pointermove', mover, { passive: true });
    return () => window.removeEventListener('pointermove', mover);
  }, [reducir, inclinacionX, inclinacionY]);

  return (
    <motion.div
      ref={contenedor}
      style={reducir ? undefined : { y: desplazamiento, scale: escala }}
      className="relative mx-auto aspect-square w-[min(50vw,200px)] sm:w-[min(52vw,400px)] lg:w-[min(36vw,500px)]"
    >
      <div aria-hidden="true" className="pizza-brillo absolute -inset-[14%] rounded-full" />

      <div className="pizza-aterriza absolute inset-0">
        <motion.div
          style={{
            rotateX: inclinacionX,
            rotateY: inclinacionY,
            transformPerspective: 900,
          }}
          className="absolute inset-0"
        >
          <motion.svg
            aria-hidden="true"
            viewBox="0 0 200 200"
            style={{ rotate: giroAnillo }}
            className="absolute -inset-[11%] h-[122%] w-[122%] text-brand-yellow/80"
          >
            <defs>
              <path
                id="anillo-pizza"
                d="M100,100 m-92,0 a92,92 0 1,1 184,0 a92,92 0 1,1 -184,0"
              />
            </defs>
            {/* textLength = circunferencia (2π·92): la frase cierra el
                círculo exacto, sin cortarse ni superponerse. */}
            <text className="fill-current text-[9.5px] font-bold">
              <textPath
                href="#anillo-pizza"
                textLength={576}
                lengthAdjust="spacing"
              >
                {TEXTO_ANILLO}
              </textPath>
            </text>
          </motion.svg>

          <motion.div
            style={{ rotate: giro }}
            className="absolute inset-0 overflow-hidden rounded-full shadow-[0_45px_90px_-25px_rgba(0,0,0,0.75),0_0_0_6px_rgba(255,217,61,0.12)]"
          >
            <Image
              src="/hero-pizza-cenital.webp"
              alt="Pizza recién horneada de Pizzería Horebs, vista desde arriba"
              fill
              priority
              sizes="(min-width: 1024px) 500px, (min-width: 640px) 400px, 50vw"
              // La foto trae madera alrededor: se agranda para que el
              // círculo muestre solo la pizza.
              className="scale-[1.14] object-cover"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_32%_28%,rgba(255,255,255,0.22),transparent_45%)]"
            />
          </motion.div>
        </motion.div>
      </div>

      {!reducir &&
        VAPORES.map((v) => (
          <motion.span
            key={v.x}
            aria-hidden="true"
            className={`pointer-events-none absolute top-[18%] h-28 ${v.ancho} -translate-x-1/2 rounded-full bg-white/25 blur-2xl`}
            style={{ left: v.x }}
            initial={{ opacity: 0, y: 30, scaleX: 0.6 }}
            animate={{ opacity: [0, 0.55, 0], y: [30, -90], scaleX: [0.6, 1.3] }}
            transition={{
              duration: 4.2,
              delay: v.retraso,
              repeat: Infinity,
              ease: 'easeOut',
            }}
          />
        ))}
    </motion.div>
  );
}
