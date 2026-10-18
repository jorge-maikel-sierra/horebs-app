# Handoff: Home (`src/app/page.tsx`)

## Resumen

La home tiene que llevar al visitante a pedir, online o por WhatsApp, en el menor número de pasos. El público son clientes de Riohacha, casi todos en el celular, que llegan desde Google, Instagram o Meta Ads. Este documento describe el estado de la home después de la revisión de diseño de octubre de 2026 (design critique, design system, accesibilidad, UX copy y síntesis de reseñas).

## Estructura

Debajo del hero, todo vive dentro de `.carta` ("la carta de la casa"): papel crema en claro y tinta de horno en oscuro, con grano encima. Los motivos son el arco dorado de la lámpara del hero, el hilo dorado, los números grandes en serif y los puntos guía de carta impresa.

| # | Sección | Componente | Notas |
|---|---|---|---|
| 1 | Hero | inline en `page.tsx` + `components/hero/*` | `id="inicio"`, `.superficie-oscura`. Sin cambios en el rediseño |
| 2 | Firmas de la casa | `home/FirmasCarta` | Filas en zigzag: foto en `.arco` + `.arco-marco`, segundo arco desplazado, `.numeral-hueco`, sello "Desde" en navy, tamaños con `.puntos-guia` y CTA "Pedir esta pizza". Especial y Hawaiana son productos ancla (CLAUDE.md) |
| 3 | Clientes felices | `ClientesFelicesSection` | Promedio grande (4,7) con estrellas de relleno parcial a la izquierda (sticky). A la derecha, la reseña más larga como cita en navy y las demás en tarjetas (scroll-snap en mobile). Solo reseñas de 4–5★ |
| 3b | También nos recomiendan | `PremiosSection` | Banda al pie de las reseñas, con laureles SVG |
| 4 | Preguntas frecuentes | `FaqSection` + `lib/faqs.ts` | Dos columnas: intro sticky + tarjeta de WhatsApp a la izquierda, acordeón numerado con líneas finas a la derecha. 5 visibles y el resto detrás de "Ver las N preguntas" |
| 5 | Cierre | `home/CierrePedido` | `id="pedir"`, navy como el hero. "¿Se te antojó?", CTAs y ficha con estado en vivo, horario, dirección, "Cómo llegar", domicilio y WhatsApp |
| — | Barra de pedido | `BarraPedidoMovil` | Solo mobile. Se oculta sobre `#inicio`, `#pedir` y el footer |

## Tokens

| Token | Valor | Uso |
|---|---|---|
| `--accent-ink` / `text-accent-ink` | claro: `--brand-orange-700` (#ce370d, 5,0:1 sobre blanco) · oscuro: `--brand-orange-500` (#ff6933, 6,9:1 sobre #0a0a0a) | **Todo texto naranja sobre superficies del tema**: precios, ratings, enlaces, íconos de acordeón, hover de navegación, foco |
| `--brand-orange-400` | #ff8457 | Texto naranja sobre el navy del hero (4,9:1) |
| `.btn-gradient` | 600/700 → 700 (30%) → 800 | Botón primario. Texto blanco ≥4,5:1 en toda la zona de la etiqueta |
| `--brand-yellow-500` | #ffd93d | Contorno de foco dentro de `.superficie-oscura` |
| `bg-brand-orange-700` | — | Badge del contador del carrito (texto blanco 5,0:1) |
| `--font-display` / `font-display` | Young Serif 400 | Títulos de sección, nombres de firma, precios, cifras. Nunca texto corrido |
| `--carta-fondo` | claro hsl(38 52% 97%) · oscuro hsl(24 18% 5%) | Superficie de `.carta` |
| `--carta-tarjeta` | claro hsl(40 60% 99%) · oscuro hsl(24 14% 8%) | Tarjetas y botones secundarios sobre la carta |
| `--carta-linea` | claro hsl(30 24% 84%) · oscuro hsl(24 10% 17%) | Bordes y separadores finos |

**Regla:** `text-brand-orange` (500) ya no se usa para texto nuevo. Sobre blanco da 2,87:1 y no pasa AA. Quedan 99 usos en otras pantallas, sobre todo en admin, para migrar a `text-accent-ink` en otro PR.

## Componentes y estados

| Elemento | Estado | Comportamiento |
|---|---|---|
| CTA primario "Pedir online" (→ `/catalogo`) | hover | `brightness-110` (antes era `opacity-90`, que bajaba el contraste) |
| CTA primario | active | `scale(0.96)` (`.btn-press`) |
| CTA secundario "Pedir por WhatsApp" | hover | Fondo blanco, texto navy |
| CTAs del hero | mobile | Apilados y a ancho completo (`max-w-xs`, `items-stretch`) |
| "Ver todo el menú" | hover | Borde y texto en `accent-ink` |
| Firma | hover / foco dentro | La foto del arco se acerca (`scale 1.06`, 0,9s) |
| "Pedir esta pizza" | hover | La flecha se corre 4px |
| Pregunta de la FAQ | hover | Texto en `accent-ink`. Abierta: el "+" gira 135° hasta formar una "×" sobre `brand-orange-700` |
| Pregunta de la FAQ | abierta / cerrada | `aria-expanded`. El panel cerrado es `inert` (fuera del Tab y de los lectores) |
| "Ver las 11 preguntas" | toggle | Muestra las ocultas con el atributo `hidden`, que siguen en el DOM para el JSON-LD |
| Barra de pedido mobile | visible | Solo cuando ni el hero ni el footer están en pantalla. Oculta queda `inert` y `translate-y-full` |

## Responsive

| Breakpoint | Cambios |
|---|---|
| < 640px | Hero: foto arriba y texto centrado. CTAs apilados. Firmas: foto arriba y texto abajo. Reseñas secundarias en carrusel horizontal con snap. Sellos apilados. Aparece la barra de pedido |
| ≥ 640px | CTAs en fila. Reseñas secundarias en grilla de 2 columnas. Sin barra de pedido |
| ≥ 1024px | Hero en 2 columnas. Firmas en zigzag (foto 5/12, texto 7/12, alternando lado). Reseñas y FAQ en 2 columnas con la columna izquierda sticky. Sellos en fila. Reseñas secundarias en 3 columnas desde 1280px |

## Contenido

| Elemento | Copy | Límite |
|---|---|---|
| Subtítulo rotativo | "Pizza" + recién horneada / dorada y crocante / a domicilio | La frase más larga reserva el ancho, así que una nueva no debería pasar de ~20 caracteres |
| Bajada del hero | "Pizza artesanal hecha en Riohacha, con la masa crocante de siempre y bien cargada de queso. Pide online o directo por WhatsApp." | 2–3 líneas en mobile |
| Descripción de firma | Viene de la API | Sin truncado. Si crece mucho, agregar `line-clamp-3` |
| Reseña | Viene de Google | `line-clamp-4` |
| FAQ: costo de domicilio | Sale de `NEGOCIO.costoDomicilio` | Tiene que coincidir con `COSTO_DOMICILIO_DEFAULT` de la API |

Se usa "crocante" y no "crujiente" porque es la palabra que usan los clientes (ver `docs/investigacion/2026-10-resenas-google.md`).

## Casos borde

- **La API no responde o no hay destacados:** desaparecen la sección de firmas y la insignia del hero. La home sigue funcionando.
- **No hay reseñas de 4–5★ o falla la Places API:** se muestra el fallback "Ver reseñas en Google".
- **Movimiento reducido:** no hay animaciones; los `.escalon` aparecen ya visibles y la foto no hace zoom.
- **Sin JS:** el título y la foto se ven igual (CSS puro y `<img>` real bajo el canvas).

## Animación

| Elemento | Disparador | Duración | Easing |
|---|---|---|---|
| Letras del título | carga | 0,9s cada una, escalonadas 45ms, empiezan a los 200ms | `cubic-bezier(0.2, 0.9, 0.25, 1.15)` |
| CTAs del hero | carga | 0,6s con 0,95s de demora | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Palabra rotativa | cada 2,6s | spring 260/24 | — |
| Firmas (`.escalon`) | entra en pantalla | 0,7s, escalonado 110ms por elemento | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Barra de pedido | scroll | 300ms (translate-y) | default |

## Accesibilidad

- **Orden de foco:** "Saltar al contenido" → logo → navegación → carrito → tema → (menú en mobile) → CTAs del hero → insignia de la firma → cards → "Ver todo el menú" → "Ver todas las reseñas" → autores de las reseñas → región "Más reseñas" (enfocable, con scroll en mobile) → sellos → WhatsApp de la FAQ → "Ver las N preguntas" → WhatsApp → contacto → barra de pedido (si está visible) → footer.
- **Foco:** contorno de 2px en `--accent-ink` (amarillo en el hero) con `outline-offset` de 2px. `scroll-margin` de 96px para que el header sticky no lo tape.
- **Landmarks:** `<main id="contenido">`, `nav[aria-label="Principal"]` y las secciones con `aria-labelledby` apuntando a su h2.
- **Carrito:** en mobile se anuncia "Carrito, 3 productos". En desktop el badge es `aria-hidden` y va acompañado de texto `sr-only`.
- **Rating:** las estrellas son `aria-hidden` y se anuncia "N de 5 estrellas". El "★" del promedio también es `aria-hidden`.
- **Enlaces externos:** texto `sr-only` "(se abre en …)".
- **Áreas táctiles:** los botones de ícono miden 36px visibles y 44px de área (`.objetivo-tactil`).

## Pendiente

- Migrar los 99 `text-brand-orange` restantes a `text-accent-ink` (admin, cuenta, pedido, contacto).
- El error de lint previo en `ThemeToggle.tsx:9` (`set-state-in-effect`) no es de este cambio.
