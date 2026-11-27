# Auditoría de seguridad — Pizzería Horebs (27 nov 2026)

Revisión manual del código (`apps/api`, `apps/web`). Strix no se pudo usar:
OpenAI rechaza todos los modelos vía suscripción ChatGPT (`model_not_in_accessible_catalog`).

## Resumen

Un hallazgo real con impacto (puntos de fidelidad) y dos relacionados, todos
con la **misma raíz**: en la web pública, **el teléfono es la identidad del
cliente sin ninguna verificación**. Lo demás (firmas de webhooks, auth, roles,
precios) está bien hecho.

| # | Severidad | Qué | Autenticado |
|---|---|---|---|
| 1 | Media-Alta | Canje de puntos de otro cliente | No (público) |
| 2 | Media | Sobrescritura del perfil de otro cliente | No (público) |
| 3 | Baja-Media | Fuga/enumeración de saldo por teléfono | No (público) |

## Hallazgo 1 — Canje de puntos ajenos (Media-Alta)

`POST /pedidos` es público. Al crear el pedido, `guardarCliente` hace
`upsert(..., { onConflict: 'telefono' })`: si el teléfono ya existe, devuelve
**ese** cliente (con sus puntos). Si el pedido trae `usar_puntos: true`,
`calcularCanjeMaximo(cliente.id, subtotal)` descuenta del saldo de **esa
víctima** y `moverPuntos` se los descuenta de verdad al crear el pedido.

**Explotación:** el atacante envía un pedido normal con el teléfono de una
víctima (p. ej. 500 pts = $25.000) y `usar_puntos: true`. Paga menos; la
víctima pierde los puntos; el pedido se entrega a la dirección del atacante.
Requisito: conocer un teléfono de cliente con ≥ mínimo de canje (100 pts).

- `apps/api/src/pedidos/pedidos.service.ts` (`registrar`, `guardarCliente`)
- `apps/api/src/clientes/puntos.service.ts` (`calcularCanjeMaximo`)

## Hallazgo 2 — Sobrescritura de perfil ajeno (Media)

El mismo `upsert` por teléfono pisa `nombre`, `apellido` (y `correo`,
`direccion` si vienen) del cliente existente con lo que mande el atacante.
Cualquiera puede corromper el perfil de otro cliente desde un pedido público.

- `apps/api/src/pedidos/pedidos-reglas.ts` (`datosClienteUpsert`)

## Hallazgo 3 — Fuga de saldo por teléfono (Baja-Media)

`GET /puntos/saldo?telefono=` es público y devuelve el saldo de cualquier
cliente; un 200 vs 404 revela quién es cliente. Sirve de puntería para el
Hallazgo 1. Mitigado en parte por el throttler global (120 req/min/IP). No
expone nombre ni dirección, solo el saldo.

- `apps/api/src/clientes/puntos-publico.controller.ts`

## Opciones de corrección (decisión del dueño)

El canje de puntos en la web es una decisión de negocio confirmada
("aplica en el checkout web y el POS"), así que no se cambia sin tu visto bueno.

- **A. Verificar el teléfono (OTP).** Antes de canjear, mandar un código por
  WhatsApp/SMS y pedirlo. Cierra los 3 hallazgos de raíz. Es una función nueva
  (enviar y validar el código).
- **B. Quitar el canje de la web, dejarlo solo en el POS.** En el POS está el
  empleado presente. Los puntos se siguen *ganando* en la web. Cambio chico;
  cierra el Hallazgo 1. (2 y 3 se mitigan aparte.)
- **C. Aceptar el riesgo.** Montos bajos y el atacante revela su dirección de
  entrega. No se toca nada.

Para el Hallazgo 2, independiente de lo anterior: en el checkout público, no
sobrescribir los datos de un cliente que ya existe (solo rellenar lo vacío o
solo crear si es nuevo). Pequeño cambio de código.

## Correcciones aplicadas (27 nov 2026)

Decisión del dueño: **quitar el canje de puntos de la web, dejarlo solo en el
POS**. Los puntos se siguen *ganando* en la web.

- **Hallazgo 1** — `registrar` (pedidos.service) solo canjea puntos si
  `canal !== 'web'`; el bot (teléfono del chat) y el POS lo conservan. El
  checkout web ya no envía ni aplica `usar_puntos`.
- **Hallazgo 2** — en la web, `guardarCliente` ya no hace upsert: busca por
  teléfono y crea el cliente solo si es nuevo; si ya existe, lo usa tal cual
  sin pisar su perfil. El bot y el POS siguen con upsert.
- **Hallazgo 3** — `GET /puntos/saldo` pasó a requerir sesión de
  `admin`/`empleado` (lo usa el POS, autenticado). Ya no es enumerable.
- **Frontend** — se quitó del checkout web el selector de puntos, la consulta
  de saldo y la línea de descuento (apps/web).
- Tests: 1704 unitarios + 23 e2e en verde; lint y tsc limpios.

## Verificado y correcto (sin acción)

- **Firmas de webhooks** (Bold, Meta, Google Ads): HMAC-SHA256, comparación en
  tiempo constante con chequeo de longitud, fallan cerrado si falta el secreto,
  Google Ads con ventana anti-reenvío de 5 min.
- **Autenticación**: el token se valida con `auth.getUser()` (verifica la firma
  del JWT en el servidor, no lo decodifica a ciegas).
- **Autorización**: todos los endpoints admin tienen `@Roles(...)`; no hay
  ninguno bajo `RolesGuard` sin su rol.
- **Precios**: el checkout público calcula precios y totales desde la base
  (`calcularItems`); el cliente solo manda `varianteId` + `cantidad`. No hay
  manipulación de precio. `costoDomicilio` es fijo por modalidad.
- **Comentarios del blog**: requieren login, se validan, el borrado comprueba
  propietario, y se renderizan como texto de React (auto-escapado).
- **JSON-LD** (`jsonLdScript`): escapa `<`, sin XSS por ruptura de `<script>`.
- **Búsqueda de clientes** (`.or()` de Supabase): el texto se limpia de
  `, ( ) %` antes de interpolar; el breakout de filtro PostgREST queda
  bloqueado. Recomendación de endurecimiento (no urgente): usar escape/allowlist
  en vez de lista negra.

## Nota de arquitectura

El API usa la **service-role key** de Supabase (RLS desactivado), así que toda
la autorización vive en los guards de Nest — que están completos. No hay
defensa a nivel de base de datos como segunda capa; conviene tenerlo presente
si en el futuro se agrega un endpoint nuevo.
