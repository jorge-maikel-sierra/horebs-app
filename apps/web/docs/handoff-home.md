# Handoff: Home (`src/app/page.tsx`)

## Resumen

La home tiene que llevar al visitante a pedir, online o por WhatsApp, en el menor número de pasos. El público son clientes de Riohacha, casi todos en el celular, que llegan desde Google, Instagram o Meta Ads. Este documento describe el estado de la home después de la revisión de diseño de octubre de 2026 (design critique, design system, accesibilidad, UX copy y síntesis de reseñas).

## Estructura

| # | Sección | Componente | Notas |
|---|---|---|---|
| 1 | Hero | inline en `page.tsx` + `components/hero/*` | `id="inicio"`, `.superficie-oscura`, `min-h-[100svh]` |
| 2 | Firmas de la casa | inline | Solo se muestra si la API devuelve destacados. Especial y Hawaiana son productos ancla (CLAUDE.md) |
| 3 | Clientes felices | `ClientesFelicesSection` + `ReviewsMarquee` | Solo reseñas de 4–5★ |
| 4 | Nos recomiendan | `PremiosSection` | Grilla de 2 columnas en todos los tamaños |
| 5 | Preguntas frecuentes | `FaqSection` + `lib/faqs.ts` | 5 visibles y el resto detrás de "Ver las N preguntas" |
| 6 | Dirección y horario | inline | Enlace a `/contacto` |
| — | Barra de pedido | `BarraPedidoMovil` | Solo mobile (`sm:hidden`) |

## Tokens

| Token | Valor | Uso |
|---|---|---|
| `--accent-ink` / `text-accent-ink` | claro: `--brand-orange-700` (#ce370d, 5,0:1 sobre blanco) · oscuro: `--brand-orange-500` (#ff6933, 6,9:1 sobre #0a0a0a) | **Todo texto naranja sobre superficies del tema**: precios, ratings, enlaces, íconos de acordeón, hover de navegación, foco |
| `--brand-orange-400` | #ff8457 | Texto naranja sobre el navy del hero (4,9:1) |
| `.btn-gradient` | 600/700 → 700 (30%) → 800 | Botón primario. Texto blanco ≥4,5:1 en toda la zona de la etiqueta |
| `--brand-yellow-500` | #ffd93d | Contorno de foco dentro de `.superficie-oscura` |
| `bg-brand-orange-700` | — | Badge del contador del carrito (texto blanco 5,0:1) |

**Regla:** `text-brand-orange` (500) ya no se usa para texto nuevo. Sobre blanco da 2,87:1 y no pasa AA. Quedan 99 usos en otras pantallas, sobre todo en admin, para migrar a `text-accent-ink` en otro PR.

## Componentes y estados

| Elemento | Estado | Comportamiento |
|---|---|---|
| CTA primario "Pedir online" (→ `/catalogo`) | hover | `brightness-110` (antes era `opacity-90`, que bajaba el contraste) |
| CTA primario | active | `scale(0.96)` (`.btn-press`) |
| CTA secundario "Pedir por WhatsApp" | hover | Fondo blanco, texto navy |
| CTAs del hero | mobile | Apilados y a ancho completo (`max-w-xs`, `items-stretch`) |
| Card de firma | hover | Sube 4px y la foto hace zoom 1.1 |
| "Ver todo el menú" | hover | Borde y texto en `accent-ink` |
| Reseñas | hover / foco dentro / botón | La cinta se pausa |
| "Pausar reseñas" / "Reanudar reseñas" | toggle | Agrega `.marquee-pausado` al contenedor |
| Pregunta de la FAQ | abierta / cerrada | `aria-expanded`. El panel cerrado es `inert` (fuera del Tab y de los lectores) |
| "Ver las 11 preguntas" | toggle | Muestra las ocultas con el atributo `hidden`, que siguen en el DOM para el JSON-LD |
| Barra de pedido mobile | visible | Solo cuando ni el hero ni el footer están en pantalla. Oculta queda `inert` y `translate-y-full` |

## Responsive

| Breakpoint | Cambios |
|---|---|
| < 640px | Hero: foto arriba y texto centrado. CTAs apilados. Premios en 2 columnas compactas. Aparece la barra de pedido |
| ≥ 640px | CTAs en fila. Firmas en 2 columnas. Sin barra de pedido |
| ≥ 1024px | Hero en 2 columnas (texto a la izquierda, foto a la derecha) |

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
- **Movimiento reducido:** no hay animaciones. La cinta de reseñas pasa a scroll manual, sin copia ni botón de pausa.
- **Sin JS:** el título y la foto se ven igual (CSS puro y `<img>` real bajo el canvas).

## Animación

| Elemento | Disparador | Duración | Easing |
|---|---|---|---|
| Letras del título | carga | 0,9s cada una, escalonadas 45ms, empiezan a los 200ms | `cubic-bezier(0.2, 0.9, 0.25, 1.15)` |
| CTAs del hero | carga | 0,6s con 0,95s de demora | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Palabra rotativa | cada 2,6s | spring 260/24 | — |
| Cinta de reseñas | continua | 45s por vuelta | linear |
| Barra de pedido | scroll | 300ms (translate-y) | default |

## Accesibilidad

- **Orden de foco:** "Saltar al contenido" → logo → navegación → carrito → tema → (menú en mobile) → CTAs del hero → insignia de la firma → cards → enlaces de reseñas → "Ver todas las reseñas" → "Pausar reseñas" → premios → FAQ → "Ver las N preguntas" → WhatsApp → contacto → barra de pedido (si está visible) → footer.
- **Foco:** contorno de 2px en `--accent-ink` (amarillo en el hero) con `outline-offset` de 2px. `scroll-margin` de 96px para que el header sticky no lo tape.
- **Landmarks:** `<main id="contenido">`, `nav[aria-label="Principal"]` y las secciones con `aria-labelledby` apuntando a su h2.
- **Carrito:** en mobile se anuncia "Carrito, 3 productos". En desktop el badge es `aria-hidden` y va acompañado de texto `sr-only`.
- **Rating:** las estrellas son `aria-hidden` y se anuncia "N de 5 estrellas". El "★" del promedio también es `aria-hidden`.
- **Enlaces externos:** texto `sr-only` "(se abre en …)".
- **Áreas táctiles:** los botones de ícono miden 36px visibles y 44px de área (`.objetivo-tactil`).

## Pendiente

- Migrar los 99 `text-brand-orange` restantes a `text-accent-ink` (admin, cuenta, pedido, contacto).
- El error de lint previo en `ThemeToggle.tsx:9` (`set-state-in-effect`) no es de este cambio.
