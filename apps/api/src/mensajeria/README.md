# Bot de atención — WhatsApp / Messenger / Instagram

Webhooks conectados directo a las APIs oficiales de Meta (WhatsApp Cloud
API, Messenger Platform, Instagram Messaging API) — sin BSP intermediario.
Responde siempre con mensajes de sesión (gratis dentro de la ventana de
24h, o 72h si la conversación empezó por un clic en anuncio); este módulo
no tiene ningún método para enviar plantillas pagas.

Las respuestas las genera **Gemini 2.x Flash-Lite** (`gemini.service.ts`)
vía function-calling contra la Interactions API de Google — el modelo
decide qué herramienta llamar (menú, producto puntual, horario, estado de
pedido, calcular un pedido nuevo, derivar a humano), pero el dato real
siempre sale de Supabase a través de
`CatalogService`/`PedidosService`/`ConversacionesService`. El modelo nunca
inventa precios, horarios, estados de pedido, ni suma totales por su
cuenta.

Cada conversación tiene memoria entre mensajes: se guarda el
`gemini_interaction_id` de la última interacción en `conversaciones_bot`
y se le pasa a la Interactions API en el siguiente mensaje, así el modelo
recuerda lo que el cliente ya pidió (Gemini mantiene el historial
server-side, no hace falta guardarlo nosotros).

---

## 1. Arquitectura de canal y capacidades

El sistema implementa una arquitectura unificada: un solo cerebro
(`gemini.service.ts`, herramientas y Supabase) conectado a adaptadores de
canal con capacidades declaradas (`capacidades-canal.ts` y
`meta-graph.service.ts`).

| Capacidad | WhatsApp | Messenger | Instagram Direct |
|---|---|---|---|
| **Límite de texto** | ~4096 caracteres | ≤ 2.000 caracteres | 1.000 bytes UTF-8 (partido estricto por bytes) |
| **Opciones rápidas** | Botones ≤ 3 / Lista ≤ 10 | Quick replies ≤ 13 (título ≤ 20) | Quick replies ≤ 13 (título ≤ 20, solo text) |
| **Teléfono nativo** | wa_id directo (57...) | Quick reply `user_phone_number` | No nativo: se solicita y valida en checkout |
| **Tarjetas de producto** | Imagen + botón interactivo | Generic Template (≤ 10 elementos) | Generic Template (≤ 10 elementos, autosuficiente) |
| **Inicio del chat** | Mensaje directo | Get Started + Menú persistente | Ice Breakers (≤ 4 preguntas frecuentes) |
| **Formato de texto** | Negrita con asteriscos (`*texto*`) | Texto plano limpio (sin markdown) | Texto plano limpio (sin markdown) |

---

## 2. Flujo de compra en redes sociales

En WhatsApp, Messenger e Instagram el cliente puede completar su pedido
sin salir del chat:

1. **Consulta / Carrito**: Gemini cotiza productos y adicionales desde
   Supabase con precios reales (`calcular_pedido`, `adicionales`,
   `cotizar_pizza_mitad_y_mitad`).
2. **Paso a paso interactivo**:
   - **Modalidad**: Domicilio, Retiro en tienda o En el local.
   - **Dirección** (domicilio): escrita con calle/carrera, barrio y
     referencia (se rechaza pin GPS por imprecisión según regla de negocio).
   - **Nombre y apellido**: tomado del perfil o solicitado al cliente.
   - **Teléfono**: en Messenger e Instagram (donde el PSID/IGSID no trae
     número de teléfono) el bot solicita el número colombiano (10 dígitos),
     lo valida y lo persiste en `conversaciones_bot.telefono`.
   - **Franja de entrega**: 'ya' (lo antes posible) o franjas de reserva
     (cada 30 min desde las 4:00 p.m. si el pedido llega entre 11 a.m. y 4 p.m.).
3. **Creación del pedido**: se crea en Supabase (`pedidos.canal` =
   `whatsapp` | `messenger` | `instagram`, estado `pendiente`), descuenta
   stock de insumos y asigna puntos de fidelidad.
4. **Pago**:
   - **Efectivo / Datáfono**: registrado directamente.
   - **Transferencia bancaria**: muestra la llave de Banco Nu (`1118843420`)
     y recibe el comprobante por imagen o PDF (`comprobantes.service.ts`).
   - **Tarjeta en línea (Bold)**: con `BOLD_API_KEY` y `BOLD_SECRET_KEY`
     genera un link de un solo uso. El webhook (`POST /webhooks/bold`) marca
     el pedido como `pagado` de forma idempotente y notifica a la cocina.
5. **Avisos de estado y ventana de 24h**: cada cambio de estado desde el
   panel (`confirmado`, `en_preparacion`, `en_camino`, `entregado`,
   `cancelado`) le llega al cliente por su canal respectivo. Si la ventana de
   24h está cerrada, el sistema **no llama a Meta** (evitando el error 100) y
   avisa al equipo para gestión manual.

---

## 3. Seguimiento automático (`seguimiento.service.ts`)

Un cron cada 10 minutos (`@nestjs/schedule`) revisa `conversaciones_bot`:
- **Recordatorio**: a los N minutos de inactividad (default 180 min = 3h).
- **Oferta de 10%**: a los M minutos tras el recordatorio (default 360 min = 6h).
- **Verificación de compra (`yaCompro`)**: tanto en WhatsApp (por wa_id)
  como en Messenger/Instagram (por `conversacion.telefono`), si el cliente ya
  compró en las últimas 24h se cancela el seguimiento para no molestar.
- **Guard de ventana de 24h**: en canales sociales, si la última interacción
  supera las 24 horas, se omite el envío a Meta, se notifica al equipo por
  correo/WhatsApp cocina y se cierra la etapa.

---

## 4. Recompras (`recompras.service.ts`)

Un cron cada 10 minutos busca pedidos entregados en su última hora de
ventana de 24h (entre 23h y 24h desde el último mensaje) e invita a repetir
con un toque (`🍕 Pedir lo mismo`), indicando los puntos de fidelidad ganados
y saldo disponible.

---

## 5. Variables de entorno (Railway → Service → Variables)

| Variable | De dónde sale | Obligatoria |
|---|---|---|
| `META_APP_SECRET` | Meta App Dashboard → Configuración básica | Sí |
| `META_WEBHOOK_VERIFY_TOKEN` | Token inventado para el handshake del webhook (`openssl rand -hex 24`) | Sí |
| `META_GRAPH_API_VERSION` | Versión de Graph API (ej. `v21.0` o `v26.0`, default `v21.0`) | Opcional |
| `WHATSAPP_ACCESS_TOKEN` | Token permanente de usuario del sistema con permisos de mensajería | Sí (para WhatsApp) |
| `WHATSAPP_PHONE_NUMBER_ID` | ID interno de Meta del número de WhatsApp del bot | Sí (para WhatsApp) |
| `WHATSAPP_CATALOG_ID` | Commerce Manager → catálogo de Meta (`1949258666036000`) | Opcional |
| `MESSENGER_PAGE_ACCESS_TOKEN` | Token de la Página de Facebook (compartido para Messenger e Instagram) | Sí (para RRSS) |
| `MESSENGER_PAGE_ID` | ID numérico de la Página de Facebook de Horebs | Sí (para Messenger) |
| `INSTAGRAM_ACCOUNT_ID` | ID de la cuenta profesional de Instagram conectada | Sí (para Instagram) |
| `BOLD_API_KEY` | Dashboard de Bold → Llaves de integración (producción) | Sí (para pagos tarjeta) |
| `BOLD_SECRET_KEY` | Dashboard de Bold → Firma secreta de webhooks | Sí (para pagos tarjeta) |
| `PERSONAL_COCINA_WHATSAPP` | Números de WhatsApp del equipo para avisos de pedidos y alertas | Opcional |
| `GEMINI_API_KEY` | Google AI Studio API Key | Sí |
| `GEMINI_MODEL` | Modelo de Gemini (default `gemini-flash-lite-latest`) | Opcional |
| `META_CAPI_ACCESS_TOKEN` | Token para Meta Conversions API (Click-to-WhatsApp) | Opcional |
| `META_DATASET_ID` | ID del Dataset de Meta Conversions API | Opcional |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | ID de cuenta de WhatsApp Business (WABA) | Opcional |

---

## 6. Endpoints del módulo

- `GET/POST /webhooks/whatsapp` — Handshake y recepción de eventos de WhatsApp.
- `GET/POST /webhooks/messenger` — Handshake y recepción de eventos de Messenger.
- `GET/POST /webhooks/instagram` — Handshake y recepción de eventos de Instagram.
- `POST /webhooks/bold` — Webhook de notificación de pagos con tarjeta de Bold.
- `PUT /admin/mensajeria/perfil/:canal` — Configuración de perfil de entrada (`messenger` con Get Started + Persistent Menu; `instagram` con Ice Breakers). Requiere `@Roles('admin')`.
