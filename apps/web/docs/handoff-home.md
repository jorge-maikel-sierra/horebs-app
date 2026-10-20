# Handoff: Home (`src/app/page.tsx`)

## Resumen

La home tiene que llevar al visitante a pedir, online o por WhatsApp, en el menor número de pasos. El público son clientes de Riohacha, casi todos en el celular, que llegan desde Google, Instagram o Meta Ads.

Este documento describe la home después del rediseño de octubre de 2026, hecho con las skills `design-taste-frontend` (dirección "split stage", reglas de la casa medidas con su inspector), `cro` y `copywriting`. Todas las secciones van de borde a borde de la pantalla, con un solo par de márgenes (`--margen`).

## Idea

La foto de la Especial sobre su tabla queda fija en la mitad derecha mientras la otra mitad se lee como una carta. Cuando llega cada firma, la foto cambia con un fundido lento. El elemento interactivo es el selector de tamaño: la pizza dibujada crece a su diámetro real (24, 30 o 40 cm) y los precios de las dos firmas cambian juntos.

## Estructura

| # | Sección | Componente | Notas |
|---|---|---|---|
| — | Header (todas las páginas públicas) | `SiteHeader` | Barra plana de ancho completo, sticky, alto `--alto-header`. Logo + nombre, enlaces, tema y "Pedir". Bajo 1024px: "Pedir", carrito y menú (el tema va dentro del menú) |
| 1 | Portada | inline en `page.tsx`, dentro de `home/EscenarioDividido` | `id="inicio"`, `data-foto=0`. h1 "Pizzería Horebs", bajada, estado en vivo (`EstadoAbierto`), domicilio, "Pizzas desde" (mínimo real de la API) y los dos CTA |
| 2 | Las dos firmas de la casa | `home/FirmasTamanos` | Selector de tamaño (radios), pizza a escala en SVG y una ficha por firma con el precio del tamaño elegido, el precio por porción y "Pedir la Especial/Hawaiana". Cada ficha lleva `data-foto` |
| 3 | Toda la carta | `home/CartaCompleta` | Rompe el escenario: hoja con bordes festoneados sobre navy. Tabla real de pizzas (foto, descripción, precio por tamaño) ordenada por `ventas_historicas`, y debajo los productos que no son pizza con sus variantes. Cierra con domicilio, horario y los dos CTA |
| 4 | Lo que cuentan en Google | `home/ResenaCarta` | Promedio grande a la izquierda. A la derecha, la reseña más larga como carta (primera oración grande, firma al final) y 2 o 4 reseñas más. Solo 4–5★. Enlaces a Sluurpy y Restaurant Guru |
| 5 | Antes de pedir | `home/PreguntasLectura` + `lib/faqs.ts` | Todas las preguntas a la vista, como texto corrido en dos columnas (`<dl>` con pregunta en negrita). El JSON-LD de FAQ va acá. El título queda sticky en desktop |
| 6 | Pedir por WhatsApp | `home/PedirWhatsapp` | `id="pedir"`, navy. El número como letra de cartel (`.t-cartel`) de margen a margen; estado, horario, dirección, "Cómo llegar", "Pedir online" y redes en las esquinas |
| — | Footer (todas las páginas públicas) | `SiteFooter` | Mitad foto (primer plano de la Especial) y mitad menú del sitio en letra grande, datos para pedir y línea legal |

`home/Entradas` activa las entradas escalonadas y `home/productos.ts` tiene el tipo y los helpers de precio.

## Tokens y reglas

| Token | Valor | Uso |
|---|---|---|
| `--margen` | `clamp(1rem, 2.2vw, 2rem)` | El único margen lateral de header, home y footer |
| `--alto-header` | 4rem | Alto del header; la foto fija se pega debajo |
| `--superficie` / `bg-superficie` | claro hsl(30 8% 95%) · oscuro hsl(30 6% 9%) | Un escalón de tono para separar superficies (portada, FAQ, opciones de tamaño) |
| `--tinta-suave` / `text-tinta-suave` | claro #52525b · oscuro #a1a1aa | Texto secundario (≥4,5:1) |
| `--accent-ink` | claro orange-700 · oscuro orange-500 | Texto naranja sobre el tema |
| `.boton-pedir` | fondo `--brand-orange-700`, hover 800 | La acción. Texto blanco 5,0:1 |
| `.boton-secundario` | navy (blanco en oscuro y sobre navy) | WhatsApp |

Tamaños de letra (Young Serif para display y títulos, Geist para el resto): `.t-display` (h1 y promedio), `.t-cartel` (solo el número de WhatsApp), `.t-titulo`, `.t-entrada`, `.t-cuerpo` (17–18px) y `.t-chico` (14px).

Reglas de la casa que mide el inspector de la skill: nada de degradados, sombras en reposo, líneas finas, etiquetas en mayúsculas espaciadas, numeración decorativa ni vidrio. Las superficies se separan con tono o espacio. Paneles y fotos con esquinas rectas; botones redondos. El body pierde su degradado ambiental en la home (`body:has(.home)`).

## Estados

| Elemento | Estado | Comportamiento |
|---|---|---|
| Botones | hover / active | Fondo un tono más oscuro / `scale(0.96)` |
| Opción de tamaño | marcada / foco | Fondo navy y texto blanco / contorno `--accent-ink` |
| Pizza a escala | cambio de tamaño | El grupo escala a `cm / 40` en 0,6s; los cortes cambian a 6, 8 o 12 |
| Fila de la carta | hover / foco dentro | Fondo `--superficie` y la foto se acerca a 1.12 |
| Menú del footer | hover | La fila se corre 12px y las demás bajan a `--tinta-suave` |
| Número de WhatsApp | hover | Pasa a amarillo |

## Responsive

| Breakpoint | Cambios |
|---|---|
| < 1024px | El escenario es una columna: la foto (56svh) va arriba, sticky, y la columna sube por encima. Cada firma muestra su foto dentro de la ficha. Header compacto |
| < 640px | La tabla de pizzas pasa a filas en grilla: foto de 80px, nombre y descripción, y los tres precios con su tamaño encima |
| ≥ 1024px | Escenario 50/50 con la foto fija a la derecha. Reseñas y FAQ en 12 columnas |

## Casos borde

- **La API no responde:** no hay firmas ni carta, y la foto fija queda en la del hero. La portada, reseñas, FAQ y cierre siguen.
- **Una pizza no viene en el tamaño elegido:** la ficha dice "No viene en este tamaño" y la tabla muestra "—".
- **Sin reseñas de 4–5★ o falla la Places API:** queda el texto con el enlace a Google.
- **Movimiento reducido:** sin fundidos, sin acercamiento de la foto ni entradas; todo visible.
- **Sin JS:** todo el contenido se ve (las entradas solo esconden bajo `.home[data-movimiento]`) y el selector muestra la Mediana.

## Animación

| Elemento | Disparador | Duración |
|---|---|---|
| Portada | carga | `fade-up` 0,7s, escalonado 80ms |
| Foto fija | llega su sección | Fundido de 1,6s; la activa se acerca de 1 a 1.07 en 18s |
| Secciones (`.entra`) | entran en pantalla | 0,7s, escalonado 75ms, suben 24px |

## Pendiente

- Sin video: no hay un clip propio del horno de Horebs y uno genérico daría una idea falsa. Si el negocio graba uno, va como loop mudo en la foto fija.
- Las fotos de las firmas repiten el encuadre del hero; una foto propia del local o del horno sumaría variedad.
- Las skills quedaron instaladas en `.claude/skills/` (no versionadas) y los archivos de trabajo del inspector en `.taste-skill/`.
