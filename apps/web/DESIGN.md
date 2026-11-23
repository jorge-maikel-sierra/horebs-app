---
name: Pizzería Horebs
description: Tienda de pizza en línea y panel de operación del local, con el calor de la marca sobre superficies sobrias.
colors:
  brand-orange: "hsl(16 100% 60%)"
  brand-orange-50: "hsl(16 100% 96%)"
  brand-orange-600: "hsl(14 91% 52%)"
  brand-orange-700: "hsl(13 88% 43%)"
  brand-orange-800: "hsl(12 84% 35%)"
  brand-yellow: "hsl(48 100% 62%)"
  brand-yellow-700: "hsl(42 90% 45%)"
  brand-navy: "#1a3a52"
  danger: "hsl(0 72% 51%)"
  success: "hsl(142 72% 38%)"
  background-light: "#ffffff"
  foreground-light: "#171717"
  background-dark: "#0a0a0a"
  foreground-dark: "#ededed"
  border-light: "#e4e4e7"
  border-dark: "#27272a"
  muted-text-light: "#71717a"
  muted-text-dark: "#a1a1aa"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.025em"
    fontFeature: "\"tnum\""
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.5
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "0.05em"
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.brand-orange-700}"
    textColor: "{colors.background-light}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  button-outline:
    backgroundColor: "{colors.background-light}"
    textColor: "{colors.foreground-light}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "44px"
  tab-segmented:
    backgroundColor: "{colors.border-light}"
    textColor: "{colors.muted-text-light}"
    rounded: "{rounded.md}"
    padding: "4px"
    height: "44px"
  tab-segmented-active:
    backgroundColor: "{colors.background-light}"
    textColor: "{colors.foreground-light}"
    rounded: "{rounded.sm}"
    height: "36px"
  card:
    backgroundColor: "{colors.background-light}"
    rounded: "{rounded.lg}"
    padding: "20px"
  card-hero:
    backgroundColor: "{colors.brand-orange-700}"
    textColor: "{colors.background-light}"
    rounded: "{rounded.xl}"
    padding: "24px"
  chip-delta:
    rounded: "{rounded.full}"
    padding: "2px 8px"
    typography: "{typography.label}"
  input:
    backgroundColor: "{colors.background-light}"
    textColor: "{colors.foreground-light}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
---

# Design System: Pizzería Horebs

## Overview

**Creative North Star: "El horno encendido"**

Horebs se ve como un horno encendido en una cocina ordenada: superficies sobrias (blanco o casi negro, grises zinc, bordes finos) y el calor de la marca concentrado donde importa. El naranja y el amarillo no tiñen la página entera; aparecen en lo que el ojo debe encontrar primero: la cifra protagonista de un informe, el botón que confirma un pedido, la pestaña activa, el precio. Un halo cálido muy tenue en las esquinas superiores del fondo recuerda la brasa sin competir con el contenido.

El mismo sistema sirve a dos superficies con pesos iguales. En la tienda el calor abre el apetito alrededor de la foto de producto. En el panel `/admin` la herramienta va primero: densidad media, cifras con números tabulares, jerarquía por tamaño y peso, y la marca en los detalles (la pestaña activa, el héroe naranja, el foco). Los controles son táctiles y seguros: se hunden al presionar, responden al instante y tienen esquinas generosas.

**Key Characteristics:**
- Superficies neutras y planas; el color de marca es un acento, no un fondo.
- Una sola pieza "encendida" por vista: el héroe naranja con degradado.
- Modo claro y oscuro completos; el naranja de texto cambia de tono por contraste.
- Números tabulares en toda cifra que cambia o se compara.
- Movimiento corto con ease-out fuerte, y nada que no respete `prefers-reduced-motion`.

## Colors

Una paleta de brasa: naranja quemado y amarillo de llama sobre neutros zinc, con un navy profundo para las superficies oscuras de la tienda.

### Primary
- **Naranja Brasa** (`brand-orange`): el tono base de la marca. Rellenos de chips y fondos tenues (al 10–15% de opacidad), sparklines, indicadores. Sobre blanco no llega a 4.5:1: nunca como color de texto en tema claro.
- **Naranja Horno** (`brand-orange-700`): el naranja de texto en tema claro (`--accent-ink`: precios, enlaces, foco) y el centro del degradado de botones primarios y del héroe. En tema oscuro, `--accent-ink` pasa al 500.
- **Naranja Tostado** (`brand-orange-800`): el extremo oscuro del degradado primario, que mantiene el texto blanco en ≥4.5:1.

### Secondary
- **Amarillo Llama** (`brand-yellow`): acento secundario: halo del fondo, tono "amarillo" de KPIs, foco sobre superficies oscuras (`.superficie-oscura`). En tema claro el texto amarillo usa `brand-yellow-700` o `amber-700`.

### Tertiary
- **Navy Profundo** (`brand-navy`): superficies que son oscuras en ambos temas (hero de la tienda, enlace "Saltar al contenido") y el tono "azul" de los KPIs.

### Neutral
- **Blanco Harina** (`background-light`) / **Noche de Horno** (`background-dark`): fondos de página.
- **Tinta** (`foreground-light` / `foreground-dark`): texto principal.
- **Borde Ceniza** (`border-light` zinc-200 / `border-dark` zinc-800): bordes de tarjetas y divisores.
- **Humo** (`muted-text-light` zinc-500 / `muted-text-dark` zinc-400): texto secundario, etiquetas, subtítulos.

### Semantic
- **Peligro** (`danger`) y **Éxito** (`success`): los únicos rojos y verdes del sitio, con su escala de 9 tonos en `globals.css`.

### Named Rules
**The Una Brasa Rule.** Cada vista tiene una sola superficie rellena de naranja (el héroe o el botón primario). Si hay dos, una sobra.

**The Escala Fija Rule.** Los tonos salen de las escalas 50–900 de `globals.css`; no se generan con `color-mix()` ni con opacidad al vuelo. Si falta un tono, se agrega a la escala.

**The Tinta Naranja Rule.** El texto naranja siempre es `text-accent-ink`, nunca `text-brand-orange`: el 500 no pasa contraste sobre blanco.

## Typography

**Display Font:** Geist (con `ui-sans-serif, system-ui`)
**Body Font:** Geist
**Label/Mono Font:** Geist Mono, solo para códigos y datos técnicos

**Character:** una sola familia geométrica y neutra que deja que el peso haga la jerarquía: extrabold para las cifras, semibold para títulos, regular para el cuerpo.

### Hierarchy
- **Display** (800, 2.25–3.75rem, interlineado 1, tracking -0.025em, tabular): la cifra protagonista de un héroe (ventas brutas, retorno).
- **Headline** (600, 1.875rem): el título de página (`h1`: "Informes", "Anuncios").
- **Title** (700, 1rem): el título de una tarjeta o panel.
- **Body** (400, 0.875rem): texto corriente del panel y de las listas.
- **Label** (600, 0.6875rem, tracking 0.05em, MAYÚSCULAS): el nombre de una métrica dentro de su tarjeta.
- **KPI value** (800, 1.125–1.5rem según el ancho de la tarjeta, tabular): la cifra de una tarjeta de métrica.

### Named Rules
**The Cifra Tabular Rule.** Toda cifra que cambia o se compara lleva `tabular-nums`: los montos no bailan al animarse ni al cambiar de período.

**The Peso Antes Que Color Rule.** La jerarquía se hace con tamaño y peso; el color de marca no sirve para enfatizar texto.

## Layout

- **Panel:** barra lateral de 256px (72px plegada) desde `lg`; en teléfono y tablet, una barra superior fija de 61px con el nombre de la sección y un menú lateral. El contenido usa `@container` y responde al ancho real, no al de la ventana.
- **Relleno de página:** 16px en teléfono, 24px desde `sm`, 32px desde `lg`.
- **Grilla de informes:** escritorio en 12 columnas (héroe 5/12 + KPIs 2×2 en 7/12; gráfico 8/12 + destacados 4/12); tablet con el héroe a lo ancho y 4 KPIs en fila; teléfono con el héroe y KPIs en 2×2.
- **Ritmo:** 12px entre tarjetas en teléfono y 16px desde tablet; 16–20px de relleno interno.
- **Barra de pestañas fija:** queda pegada bajo la barra superior con fondo translúcido y `backdrop-blur`; al cambiar de pestaña el scroll vuelve a su borde.
- **Teléfono:** lo que no cabe se desliza (tira de pestañas con bordes desvanecidos) o se apila (tablas → tarjetas por fila). Nunca hay scroll horizontal de página.

## Elevation & Depth

Plano con acentos. Las superficies están planas en reposo y se separan con bordes finos (1px zinc-200 / zinc-800) y un degradado interno casi imperceptible (`card-gradient`). La sombra aparece solo en lo destacado o como respuesta a un estado.

### Shadow Vocabulary
- **Brasa** (`box-shadow` `shadow-lg` teñida con `brand-orange` al 25%): solo bajo el héroe naranja.
- **Levante** (`0 12px 24px -8px rgba(0,0,0,0.18)` + `translateY(-4px)`): hover de una tarjeta clicable, solo con mouse.
- **Flotante** (`shadow-2xl`): menús, hojas inferiores y modales.
- **Pastilla** (`shadow-sm`): la pestaña activa dentro de un control segmentado.

### Named Rules
**The Plano Por Defecto Rule.** Una tarjeta de solo lectura no tiene sombra ni se levanta. Si se levanta, se puede tocar.

## Shapes

Esquinas generosas y redondeadas, que crecen con el tamaño de la pieza: 8px para la pastilla activa, 12px para botones, campos y controles segmentados, 16px para tarjetas y paneles, 24px para el héroe y las hojas que suben desde abajo, y círculo completo para chips de variación y avatares. Los círculos blancos translúcidos dentro del héroe son su textura reconocible.

## Components

### Buttons
- **Shape:** esquinas de 12px, alto de 44px (área táctil mínima).
- **Primary:** degradado `btn-gradient` (naranja 600/700 → 800 a 135°) con texto blanco semibold.
- **Outline:** fondo de página, borde zinc-300 / zinc-700; el borde pasa a `accent-ink` al pasar el mouse.
- **Press:** todo lo presionable se hunde a `scale(0.96)` en 150ms (`btn-press`).
- **Focus:** contorno de 2px en `accent-ink` con 2px de separación; amarillo sobre superficies oscuras.

### Tabs (control segmentado)
- **Style:** riel zinc-100 / zinc-900 con 4px de relleno; la pestaña activa es una pastilla blanca / zinc-700 con `shadow-sm` que se desliza entre opciones con un resorte (`bounce 0.18`, 0.4s).
- **Behavior:** patrón ARIA de pestañas (flechas, Inicio, Fin). En teléfono vibra y hace un "tic" casi inaudible al cambiar, si los sonidos del panel están activos.

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** `card-gradient` sobre el fondo de página.
- **Border:** 1px zinc-200 / zinc-800.
- **Internal Padding:** 16px en teléfono, 20px desde `sm`.

### KPI card
Ícono en un chip de 40px con su tono (naranja, azul, amarillo, verde), variación en una pastilla a la derecha, etiqueta en mayúsculas, cifra extrabold y, si hay serie, una sparkline del mismo tono al pie.

### Hero card (signature)
La única pieza encendida: degradado naranja, esquinas de 24px, sombra Brasa, dos círculos blancos translúcidos y una sparkline blanca a sangre en el borde inferior. Su cifra cuenta hasta el valor al aparecer y al cambiar de período (0.7s, ease-out).

### Chips (variación)
- **Style:** pastilla de esquinas completas, 12px bold tabular. Verde si mejora, rojo si empeora, según si "más es mejor" para esa métrica; blanco al 20% sobre el héroe.

### Inputs / Fields
- **Style:** borde zinc-300, esquinas de 12px, etiqueta pequeña encima; dos campos relacionados (desde / hasta) van en una sola caja partida.
- **Focus:** el borde pasa a naranja con un anillo naranja al 20%.
- **Error:** mensaje rojo bajo el campo con `role="alert"`.

### Navigation
- **Escritorio:** barra lateral con secciones "General" y "Administración"; el ítem activo es una pastilla naranja con texto blanco.
- **Teléfono:** barra superior con el nombre de la sección, que aparece solo cuando el título de la página se va bajo la barra; menú lateral desde el botón de hamburguesa.

### Bottom sheet (teléfono)
Hoja de esquinas superiores de 24px que sube con un resorte, se cierra arrastrándola desde la manija y bloquea el scroll de la página; desde `sm` se convierte en un menú anclado a su botón.

## Do's and Don'ts

### Do:
- **Do** usar `text-accent-ink` para todo texto naranja y `btn-gradient` para todo relleno naranja de botón.
- **Do** dejar un solo héroe naranja por vista y construir el resto con superficies planas y bordes de 1px.
- **Do** poner `tabular-nums` en montos, conteos y porcentajes.
- **Do** mantener animaciones de interfaz bajo 300ms con `cubic-bezier(0.23, 1, 0.32, 1)`; hojas y modales hasta 500ms con resorte.
- **Do** dar 44px de área táctil a todo control.
- **Do** cubrir cada color con su par `dark:` cuando se apoya en el fondo de la página.

### Don't:
- **Don't** usar `text-brand-orange` (el naranja 500) como texto sobre blanco.
- **Don't** levantar ni dar sombra a una tarjeta que no se puede tocar, ni aplicar hover en pantallas táctiles.
- **Don't** usar los rojos o verdes de Tailwind para error o éxito fuera de las escalas `danger` y `success`.
- **Don't** dejar `filter` ni `transform` puestos al terminar una animación de entrada (`animation-fill-mode: backwards`): convierten la sección en el contenedor de sus modales `fixed`.
- **Don't** animar desde `scale(0)` ni usar `ease-in` en una entrada: se parte de casi visible (`scale(0.95)`, opacidad 0) con ease-out.
