# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Dos audiencias con el mismo peso (confirmado por el dueño, 23 nov 2026); cada superficie prioriza la suya:

- **Clientes de Riohacha** que piden pizza a domicilio o para recoger desde el teléfono, en la tienda pública (`pizzeriahorebs.shop`). Muchos llegan por anuncios de Meta o de Google y terminan el pedido en la web o por WhatsApp.
- **El equipo del negocio** en el panel `/admin`: el dueño (rol `admin`: informes, anuncios, costos, configuración) y los empleados (rol `empleado`: caja, pedidos, seguimiento del WhatsApp). Usan el dispositivo según la tarea: la caja en computador o tablet en el local; informes, anuncios y seguimiento desde el teléfono.

## Product Purpose

Reemplaza el sitio anterior de WordPress + WooCommerce por una tienda propia con catálogo, carrito y checkout en línea (nunca solo una vitrina), y por un panel que concentra la operación del local: punto de venta, pedidos, clientes y puntos, inventario, nómina, bots de WhatsApp/Messenger/Instagram, reseñas de Google e informes de ventas y de anuncios.

El éxito es que el cliente pida sin fricción y que el dueño sepa, desde el teléfono, cuánto vende y si lo que gasta en anuncios vuelve.

## Positioning

La pizza de la casa: la **Pizza Horebs Especial** es la firma de Horebs y, con la **Pizza Hawaiana**, va por encima del resto del menú en el catálogo. Lo que diferencia a Horebs de otras pizzerías de Riohacha es su producto, no un precio o un canal.

## Operating Context

- Horario del local: lunes a domingo, 4:00 p. m. – 11:00 p. m. (hora de Bogotá, `America/Bogota`). El bot toma pedidos desde las 11:00 a. m.; los anteriores a las 4:00 p. m. son reservas por franja de 30 min.
- Pedidos por la web, por WhatsApp (+57 315 786 1208, lo atiende una persona) y por los bots de WhatsApp (+57 320 567 4313), Messenger e Instagram. Todos llegan al panel.
- Pago histórico: ~77% efectivo, ~22% transferencia (Banco Nu), <1% tarjeta (Bold, link de pago).
- El panel se usa durante el servicio: cambios que puedan romper algo se despliegan fuera del horario del local.

## Capabilities and Constraints

- Monorepo: `apps/web` (Next.js 16 App Router, Tailwind 4, `motion`) en Vercel; `apps/api` (NestJS) en Railway; Supabase (Postgres).
- Datos de negocio (precios, horarios, dirección, teléfonos, promociones, costos de domicilio) salen de Supabase o de `CLAUDE.md` en la raíz del repo; nunca se inventan.
- Dominio activo `pizzeriahorebs.shop`. `pizzeriahorebs.com` expiró y nunca se usa.
- Interfaz en español de Colombia; montos en COP sin decimales.
- Modo claro y oscuro en todo el sitio.

## Brand Commitments

- Nombre comercial: "Pizzería Horebs". No se muestra el nombre personal del titular.
- Tono: cercano, profesional, antojador, directo.
- Fotografía de producto: picado de 45°, luz cálida direccional, tabla de madera circular rústica sobre mesa de madera oscura.
- Ubicación: Carrera 7 # 17B - 66, sur de Riohacha (nunca "centro").

## Evidence on Hand

- Histórico de WooCommerce: 18.723 pedidos y 5.393 clientes (sin migrar todavía).
- Ventas, pedidos, clientes, anuncios y reseñas reales en Supabase, visibles en `/admin/informes` y `/admin/anuncios`.
- Fotos de producto del catálogo en el repo y en la carpeta de imágenes del catálogo.
- No hay testimonios, premios ni cifras de prensa confirmadas: no se inventan.

## Product Principles

1. La pizza de la casa manda: la Especial y la Hawaiana se ven primero.
2. Pedir tiene que ser rápido en un teléfono; el carrito y el checkout son el corazón de la tienda.
3. En el panel, el dato correcto antes que el adorno: cifras reales, hora de Bogotá y nada inventado.
4. Cada pantalla del panel sirve en el dispositivo de su tarea: caja en pantalla grande, lectura de números en el teléfono.
