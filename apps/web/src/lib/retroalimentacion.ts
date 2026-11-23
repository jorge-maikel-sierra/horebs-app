import { sonidoPedidosActivo } from '@/lib/use-alertas-admin';

/**
 * Respuesta táctil de los controles del panel en teléfono: una vibración
 * corta (Android; Safari de iOS no la expone) y un "tic" casi inaudible con
 * Web Audio, sin archivos. Solo en pantallas táctiles y solo si el equipo no
 * silenció los sonidos del panel con el botón del parlante.
 */

const VIBRACION_MS = 6;
const FRECUENCIA_TIC = 1800;
const VOLUMEN_TIC = 0.035;
const DURACION_TIC_S = 0.035;

let contexto: AudioContext | null = null;

function esTactil(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
}

function obtenerContexto(): AudioContext | null {
  if (contexto) return contexto;
  const Contexto =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  contexto = Contexto ? new Contexto() : null;
  return contexto;
}

function sonarTic() {
  const ctx = obtenerContexto();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
  const inicio = ctx.currentTime;
  const osc = ctx.createOscillator();
  const vol = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(FRECUENCIA_TIC, inicio);
  osc.frequency.exponentialRampToValueAtTime(FRECUENCIA_TIC / 2, inicio + DURACION_TIC_S);
  vol.gain.setValueAtTime(VOLUMEN_TIC, inicio);
  vol.gain.exponentialRampToValueAtTime(0.0001, inicio + DURACION_TIC_S);
  osc.connect(vol).connect(ctx.destination);
  osc.start(inicio);
  osc.stop(inicio + DURACION_TIC_S);
}

/** Llamar en el manejador del toque (el navegador exige un gesto del usuario). */
export function tocar() {
  if (!esTactil()) return;
  try {
    navigator.vibrate?.(VIBRACION_MS);
    if (sonidoPedidosActivo()) sonarTic();
  } catch {
    // Sin vibración ni audio el control funciona igual.
  }
}
