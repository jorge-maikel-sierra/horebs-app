# Pizzería Horebs — Sitio Nuevo

## Qué es esto

Monorepo para reemplazar el sitio actual de WordPress + WooCommerce de
Pizzería Horebs (Riohacha, La Guajira) por un sitio moderno con catálogo,
carrito y checkout en línea.

## Stack

- `apps/api` — NestJS (REST API)
- `apps/web` — Next.js (frontend, se despliega en Vercel)
- Base de datos: Supabase (Postgres)
- Backend: pendiente de elegir un hosting gratuito para el primer mes
  (Render, Railway o Fly.io — ver README.md sección 5)

## Estado actual del scaffold

- Build limpio en ambas apps (`npm run build` desde la raíz)
- `GET /health` en el API verifica conectividad REAL con Supabase (no solo
  que el servidor arrancó)
- `.env.example` en `apps/api` y `.env.local.example` en `apps/web` — copiar
  y completar con credenciales reales de Supabase antes de correr nada
- `.mcp.json` ya registra los conectores MCP de Supabase y Vercel

## Decisiones de negocio confirmadas (no inventar otras)

- El sitio DEBE mantener carrito y checkout en línea — no es solo una vitrina
- La migración del histórico de WooCommerce (18,723 pedidos, 5,393 clientes)
  se decide DESPUÉS de tener el sitio nuevo funcionando — no es prioridad hoy
- Horario del negocio: lunes a domingo, 4:00pm–11:00pm
- Dirección oficial: Carrera 7 # 17B - 66, Riohacha, La Guajira
- WhatsApp: +57 315 786 1208 (canal de confirmación de pedidos)
- Dominio activo: pizzeriahorebs.shop — NUNCA usar ni enlazar
  pizzeriahorebs.com (expiró, ya no es del negocio)
- Productos ancla: **Pizza Horebs Especial** (posicionar como "firma de la
  casa") y **Pizza Hawaiana** — deben tener presencia destacada en el
  catálogo, por encima del resto del menú
- Catálogo actual: 17 productos publicados en el sitio viejo
- Métodos de pago históricos: ~77% efectivo, ~22% transferencia bancaria,
  <1% tarjeta — priorizar efectivo/transferencia en el checkout; tarjeta es
  opcional y está pendiente de decisión
- Costo de domicilio: $5.000 (`COSTO_DOMICILIO_DEFAULT` en
  `apps/api/src/common/costos.ts`) — fijo en el checkout web, y valor
  sugerido cuando el POS no especifica un costo manual
- Descuento de la oferta de seguimiento por conversación abandonada: 10%
  (`DESCUENTO_OFERTA_PORCENTAJE` en `seguimiento.service.ts`) — se ofrece si
  el cliente no responde tras el recordatorio de las 3 horas
- Transferencia bancaria: Banco Nu, llave `1118843420` (mismo número que el
  NIT del RUT) — se muestra en la página de confirmación de pedido cuando
  el método de pago es transferencia

## Estilo visual de marca

- Fotografía de producto: ángulo picado de 45°, luz cálida direccional
- Entorno: tabla de madera circular rústica sobre mesa de madera oscura
- Paleta de referencia (validar contra el logo real antes de usarla como
  definitiva): naranja `#FF6B35`, azul profundo `#1A3A52`, amarillo `#FFD93D`
- Tono de comunicación: cercano, profesional, antojador, directo

## Reglas para trabajar en este repo

- No inventar datos de negocio (precios, horarios, dirección, etc.) que no
  estén en este archivo — preguntar si falta algo en vez de suponer
- Todo cambio al esquema de Supabase debe reflejarse también en los tipos/DTOs
  de `apps/api`
- Nunca commitear archivos `.env` ni `.env.local` con credenciales reales
