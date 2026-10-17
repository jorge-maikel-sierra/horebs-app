// Sprites pre-renderizados en un canvas pequeño: dibujarlos con drawImage
// es mucho más barato que crear un gradiente (o un shadowBlur) por partícula.

function lienzo(lado: number) {
  const canvas = document.createElement('canvas');
  canvas.width = lado;
  canvas.height = lado;
  return { canvas, ctx: canvas.getContext('2d')! };
}

function radial(
  ctx: CanvasRenderingContext2D,
  lado: number,
  paradas: [number, string][],
) {
  const g = ctx.createRadialGradient(lado / 2, lado / 2, 0, lado / 2, lado / 2, lado / 2);
  for (const [p, color] of paradas) g.addColorStop(p, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, lado, lado);
}

/** Punto de luz con núcleo caliente: brasas, chispas y cabeza de la estela. */
export function crearSpriteBrillo(rgb: string): HTMLCanvasElement {
  const lado = 32;
  const { canvas, ctx } = lienzo(lado);
  radial(ctx, lado, [
    [0, 'rgba(255, 250, 235, 1)'],
    [0.18, `rgba(${rgb}, 0.95)`],
    [0.45, `rgba(${rgb}, 0.3)`],
    [1, `rgba(${rgb}, 0)`],
  ]);
  return canvas;
}

/** Bocanada de humo suave, sin núcleo: se mezcla en aditivo y se ve luminosa. */
export function crearSpriteHumo(rgb: string): HTMLCanvasElement {
  const lado = 64;
  const { canvas, ctx } = lienzo(lado);
  radial(ctx, lado, [
    [0, `rgba(${rgb}, 0.55)`],
    [0.4, `rgba(${rgb}, 0.22)`],
    [1, `rgba(${rgb}, 0)`],
  ]);
  return canvas;
}

/** Pincel blando para la máscara: interior opaco y borde que se desvanece. */
export function crearPincel(): HTMLCanvasElement {
  const lado = 64;
  const { canvas, ctx } = lienzo(lado);
  radial(ctx, lado, [
    [0, 'rgba(255, 255, 255, 1)'],
    [0.55, 'rgba(255, 255, 255, 0.95)'],
    [1, 'rgba(255, 255, 255, 0)'],
  ]);
  return canvas;
}
