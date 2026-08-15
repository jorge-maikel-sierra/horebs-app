# Bot de atención — WhatsApp / Messenger / Instagram

Webhooks conectados directo a las APIs oficiales de Meta (WhatsApp Cloud
API, Messenger Platform, Instagram Messaging API) — sin BSP intermediario.
Responde siempre con mensajes de sesión (gratis dentro de la ventana de
24h, o 72h si la conversación empezó por un clic en anuncio); este módulo
no tiene ningún método para enviar plantillas pagas.

## Variables de entorno (Railway → Service → Variables)

`apps/api/.env.example` no se pudo editar automáticamente por permisos del
entorno de esta sesión — agregá estas variables ahí también, a mano, además
de en Railway:

| Variable | De dónde sale |
|---|---|
| `META_APP_SECRET` | Meta App Dashboard → Configuración básica |
| `META_WEBHOOK_VERIFY_TOKEN` | String que vos inventás — lo repetís al registrar el webhook en Meta |
| `META_GRAPH_API_VERSION` | ej. `v21.0` (opcional, default `v21.0`) |
| `WHATSAPP_ACCESS_TOKEN` | Token del sistema (permanente) del número dedicado |
| `WHATSAPP_PHONE_NUMBER_ID` | ID interno de Meta del número — **no** el número de teléfono |
| `MESSENGER_PAGE_ACCESS_TOKEN` | Token de la Página de Facebook vinculada al Meta App |
| `MESSENGER_PAGE_ID` | ID de esa Página |

Instagram Direct usa el **mismo** `MESSENGER_PAGE_ACCESS_TOKEN` — así
funciona la Instagram Messaging API (la cuenta de Instagram tiene que estar
vinculada a la Página en Meta Business Suite antes de que ese canal
funcione).

## Registrar los webhooks en Meta

Por cada producto (WhatsApp, Messenger, Instagram) en el App Dashboard →
Webhooks:

1. **Callback URL**: `https://<tu-dominio-railway>/webhooks/whatsapp` (o
   `/messenger`, `/instagram` según el producto).
2. **Verify Token**: el mismo valor que pusiste en `META_WEBHOOK_VERIFY_TOKEN`.
3. Meta llama la URL con `GET` para confirmar el handshake antes de dejarte
   guardar — si no responde con el `hub.challenge` esperado, no guarda.
4. Suscribite a los campos de mensajes entrantes (`messages` en WhatsApp,
   `messages`/`messaging_postbacks` en Messenger/Instagram).

## Probar antes de conectar el número real

1. **Handshake**: `curl "https://<railway>/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=<TU_TOKEN>&hub.challenge=123"`
   debe devolver `123`. Con un token incorrecto, 403.
2. **Firma inválida**: un `POST` sin `X-Hub-Signature-256` correcto debe dar
   403 y no aparecer nada en los logs de `WebhooksService` como procesado.
3. **Flujo completo**: registrá el webhook apuntando al número/Página de
   **prueba**, no al que se usa para atención manual, y mandá "menú",
   "horario", "mi pedido", "humano" — confirmá que cada respuesta sale con
   datos reales (catálogo/pedidos de Supabase, no texto fijo).
4. Solo después de eso, apuntar el número dedicado real y conectar
   campañas de anuncios.

## Qué NO hace este módulo (a propósito)

- No envía plantillas de marketing — cualquier remarketing pago es una
  acción manual aparte, fuera de este flujo.
- No usa NLU/LLM — la detección de intención es por palabras clave
  (`bot-flow.service.ts`), suficiente para el flujo básico pedido
  (menú/horario/pedido/derivar a humano). Subir a un modelo de lenguaje es
  una extensión separada si se pide.
- No crea pedidos desde el chat — solo consulta el estado de pedidos ya
  existentes por teléfono.
