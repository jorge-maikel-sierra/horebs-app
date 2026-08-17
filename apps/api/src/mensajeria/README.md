# Bot de atención — WhatsApp / Messenger / Instagram

Webhooks conectados directo a las APIs oficiales de Meta (WhatsApp Cloud
API, Messenger Platform, Instagram Messaging API) — sin BSP intermediario.
Responde siempre con mensajes de sesión (gratis dentro de la ventana de
24h, o 72h si la conversación empezó por un clic en anuncio); este módulo
no tiene ningún método para enviar plantillas pagas.

Las respuestas las genera **Gemini 2.x Flash-Lite** (`gemini.service.ts`)
vía function-calling contra la Interactions API de Google — el modelo
decide qué herramienta llamar (menú, horario, estado de pedido, derivar a
humano), pero el dato real siempre sale de Supabase a través de
`CatalogService`/`PedidosService`/`ConversacionesService`. El modelo nunca
inventa precios, horarios ni estados de pedido.

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
| `GEMINI_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — gratis |
| `GEMINI_MODEL` | opcional, default `gemini-flash-lite-latest` (el más barato disponible) |

Instagram Direct usa el **mismo** `MESSENGER_PAGE_ACCESS_TOKEN` — así
funciona la Instagram Messaging API (la cuenta de Instagram tiene que estar
vinculada a la Página en Meta Business Suite antes de que ese canal
funcione).

## Cómo obtener cada credencial

Requisito previo: la verificación de negocio de "Pizzeria Horeb's" en Meta
Business Manager tiene que estar aprobada (o muy avanzada) para poder
generar tokens permanentes y conectar un número real — con la verificación
pendiente solo se puede probar con el número de prueba que da Meta.

1. **Crear la Meta App**: [developers.facebook.com/apps](https://developers.facebook.com/apps)
   → Crear app → tipo "Business" → asociarla al Business Manager
   "Pizzeria Horeb's".
2. **`META_APP_SECRET`**: App Dashboard → Configuración → Básica → "Clave
   secreta de la app" → Mostrar (pide contraseña de Facebook).
3. **WhatsApp** (`WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_ACCESS_TOKEN`):
   - Agregar producto → WhatsApp. La pestaña "Introducción a la API" da un
     número de prueba con su Phone Number ID y un token temporal de 24h
     (solo para pruebas rápidas con `curl`).
   - Número real: WhatsApp Manager → agregar el número dedicado →
     verificar por SMS/llamada → copiar su Phone Number ID.
   - Token permanente: Configuración empresarial → Usuarios del sistema →
     crear usuario del sistema (rol Admin) → Generar token → permisos
     `whatsapp_business_messaging` + `whatsapp_business_management` → sin
     fecha de expiración.
4. **Messenger** (`MESSENGER_PAGE_ID` / `MESSENGER_PAGE_ACCESS_TOKEN`):
   - Agregar producto → Messenger → Configuración de la API → generar
     token para la Página del negocio (mejor desde el Usuario del sistema,
     permiso `pages_messaging`, así no depende de una sesión personal ni
     expira).
   - Page ID: misma pantalla, o Página de Facebook → Configuración →
     General → ID de la página.
5. **Instagram**: sin variables nuevas — usa `MESSENGER_PAGE_ACCESS_TOKEN`.
   Requiere cuenta profesional (business/creator) vinculada a la Página
   desde Meta Business Suite → Configuración → Cuentas vinculadas. Después,
   Agregar producto → Instagram → vincular.
6. **`META_WEBHOOK_VERIFY_TOKEN`**: no sale de Meta, lo inventás vos —
   `openssl rand -hex 24` — y tiene que ser idéntico en Railway y en el
   campo "Verify Token" al registrar el webhook (paso siguiente).
7. **`META_GRAPH_API_VERSION`**: opcional, ya tiene default `v21.0` en el
   código.

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
- El modelo (Gemini) nunca inventa datos de negocio — precios, horario y
  estado de pedido siempre pasan por las herramientas (`gemini.service.ts`)
  que consultan Supabase directamente.
- No crea pedidos desde el chat — solo consulta el estado de pedidos ya
  existentes por teléfono.
- No mantiene historial de conversación entre mensajes — cada respuesta se
  genera con el mensaje actual, sin memoria de turnos anteriores. Si hace
  falta ese contexto más adelante, es una extensión aparte.
