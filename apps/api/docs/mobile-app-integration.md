# Integración de la app móvil con la API de Pizzería Horebs

Este documento es para el desarrollador que va a construir la app móvil de
Pizzería Horebs. Describe con qué endpoints reales de la API (NestJS) se
puede integrar hoy, cómo autenticarse, y qué funcionalidad **no existe
todavía** — para que el alcance de la app se decida con información
correcta, no supuestos.

## 1. Introducción

- **URL base en producción**: `https://horebs-api-production.up.railway.app`
- **URL base en local** (si corrés la API vos mismo): `http://localhost:3000`
- Todas las rutas descritas abajo cuelgan de esa URL base (ej.
  `GET https://horebs-api-production.up.railway.app/catalogo/productos`).
- Formato: JSON en request y response salvo que se indique lo contrario
  (hay dos rutas que devuelven PDF/CSV, marcadas explícitamente).
- No hay versión en la URL (no hay `/v1/`) — es una sola API en evolución.

## 2. Autenticación

**No existe un endpoint `/auth/login` en esta API.** La autenticación es
100% [Supabase Auth](https://supabase.com/docs/guides/auth), y sucede del
lado del cliente (tu app), no contra este backend:

1. Tu app se conecta directo a Supabase Auth (con el SDK oficial de
   Supabase para tu plataforma — hay SDKs para iOS/Kotlin/Flutter/React
   Native) usando estas dos credenciales, que te va a pasar el dueño:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` (la clave pública/anon, **nunca** la
     `service_role`)
2. Flujos disponibles en Supabase Auth, ya usados hoy por el sitio web
   (`apps/web/src/app/cuenta/page.tsx`) y replicables en tu app:
   - `signUp({ email, password, options: { data: { nombre, apellido } } })`
     — requiere confirmación de correo antes de que exista sesión.
   - `signInWithPassword({ email, password })`
   - `signInWithOAuth({ provider: 'google' })`
   - `resetPasswordForEmail(email)` → luego `updateUser({ password })`
     cuando Supabase dispara el evento `PASSWORD_RECOVERY`.
   - Datos de perfil (`nombre`, `apellido`, `telefono`, `direccion`) se
     guardan en `user_metadata` vía `updateUser({ data: {...} })` — no
     hay una tabla `perfiles` propia para clientes.
3. Una vez autenticado, Supabase te da un `access_token` (JWT). Cada
   llamada a esta API que necesite identidad se hace con:
   ```
   Authorization: Bearer <access_token>
   ```

### Tres niveles de acceso — importante no confundirlos

| Nivel | Requiere sesión Supabase | Para qué sirve en esta API |
|---|---|---|
| **Anónimo** | No | Ver catálogo, hacer checkout (`POST /pedidos`), consultar saldo de puntos, ver el estado de un pedido |
| **Usuario logueado** | Sí (cualquier cuenta Supabase, sin rol especial) | Solo comentar/dar like en el blog |
| **Staff** (`admin`/`empleado`) | Sí + fila en la tabla interna `perfiles_staff` | POS, inventario, nómina, informes — **no aplica a la app de clientes**, es exclusivamente para empleados del negocio |

Es decir: **el checkout no requiere que el cliente tenga cuenta.** Podés
lanzar la app permitiendo pedir como invitado desde el día uno, y agregar
login opcional después si querés persistir algo (ver sección 11,
"Limitaciones conocidas").

### Errores de autenticación

- Sin token en una ruta que lo exige → `401`, `{"message": "Falta el token de autenticación."}`
- Token inválido o expirado → `401`, `{"message": "Token inválido o expirado."}`
- Token válido pero sin el rol necesario → `403`, `{"message": "No tenés permiso para esta acción."}`

## 3. Catálogo (público, sin autenticación)

### `GET /catalogo/categorias`

Devuelve las categorías del menú.

```json
[{ "id": "uuid", "nombre": "Pizzas", "orden": 1 }]
```

### `GET /catalogo/productos?destacado=true`

Lista los productos activos. El query param `destacado` es opcional; si
se manda `true`, filtra solo los destacados (hoy: Pizza Horebs Especial y
Pizza Hawaiana, posicionadas como productos ancla). Sin el filtro, el
orden ya viene con los destacados primero.

```json
[
  {
    "id": "uuid",
    "nombre": "Pizza Horebs Especial",
    "descripcion": "string o null",
    "imagen_url": "string o null",
    "destacado": true,
    "categoria_id": "uuid",
    "slug": "pizza-horebs-especial",
    "ventas_historicas": 120,
    "variantes": [
      { "id": "uuid", "nombre": "Personal", "precio": 25000, "precio_oferta": null },
      { "id": "uuid", "nombre": "Mediana", "precio": 40000, "precio_oferta": null },
      { "id": "uuid", "nombre": "Grande", "precio": 60000, "precio_oferta": 55000 }
    ]
  }
]
```

Cada producto tiene **variantes** (tamaños): Personal, Mediana, Grande.
Cuando `precio_oferta` no es `null`, ese es el precio a mostrar/cobrar en
vez de `precio`.

### `GET /catalogo/productos/:slug`

Un solo producto por su slug. `404` si no existe o está inactivo.

## 4. Checkout / Pedidos

### `POST /pedidos` — crear un pedido (público, sin autenticación)

```json
{
  "cliente": {
    "nombre": "string, requerido",
    "apellido": "string, requerido",
    "telefono": "string, requerido — formato: +?[0-9 ()-]{7,20}",
    "correo": "string, requerido — email válido",
    "direccion": "string, opcional"
  },
  "modalidad": "domicilio | retiro",
  "direccion_entrega": "string — requerida solo si modalidad='domicilio', máx 300 caracteres",
  "metodo_pago": "efectivo | transferencia | tarjeta",
  "notas": "string, opcional, máx 500 caracteres",
  "items": [{ "variante_id": "uuid", "cantidad": 1 }],
  "usar_puntos": false,
  "idempotency_key": "uuid generado por vos, uno distinto por cada intento de checkout"
}
```

Comportamiento del servidor que tu app debe conocer:

- **Los precios nunca se confían del cliente.** El backend vuelve a
  buscar el `precio`/`precio_oferta` real de cada `variante_id` y
  recalcula el total — no importa qué precio le muestres al usuario en
  pantalla, se factura el precio real de la base de datos en ese momento.
- **`idempotency_key` evita duplicados**: si tu app reintenta el mismo
  POST (por un timeout de red, por ejemplo) con la misma clave, el
  backend devuelve el pedido ya creado en vez de crear uno nuevo. Generá
  un UUID nuevo por cada intento real de compra del usuario, y reusalo
  solo en reintentos automáticos de esa misma compra.
- **Costo de domicilio**: fijo en $5.000 COP si `modalidad='domicilio'`,
  $0 si `modalidad='retiro'` — tu app no puede (ni necesita) enviarlo, lo
  calcula el servidor.
- **`usar_puntos: true`** canjea automáticamente el máximo de puntos
  posible del cliente (limitado a su saldo y al subtotal del pedido) —
  ver sección 5 para las reglas del programa de puntos.
- El cliente se identifica y se guarda por **teléfono** (único) — un
  mismo teléfono en dos pedidos reusa el mismo registro de cliente.

Respuesta (`201`, mismo shape que `GET /pedidos/:id`):

```json
{
  "id": "uuid",
  "cliente": { "nombre": "...", "apellido": "...", "telefono": "...", "correo": "...", "direccion": "..." },
  "modalidad": "domicilio",
  "direccion_entrega": "string o null",
  "costo_domicilio": 5000,
  "metodo_pago": "efectivo",
  "estado": "pendiente",
  "total": 45000,
  "notas": "string o null",
  "created_at": "2026-09-03T...",
  "items": [
    {
      "variante_id": "uuid o null",
      "producto_nombre": "Pizza Horebs Especial",
      "variante_nombre": "Mediana",
      "cantidad": 1,
      "precio_unitario": 40000,
      "subtotal": 40000
    }
  ],
  "puntos_canjeados": 0,
  "descuento_puntos": 0,
  "puntos_ganados": 45
}
```

**Guardá el `id`** que devuelve esta respuesta — es lo único que te
permite después consultar el estado del pedido.

### `GET /pedidos/:id` — consultar un pedido (público, sin autenticación)

Mismo shape de arriba. `404` si el UUID no existe. Esta es la forma de
mostrar "seguimiento de tu pedido" en la app.

Valores conocidos de `estado` (tomados del código, no confirmados contra
un constraint de base de datos — verificar con el equipo si tu app va a
tomar decisiones críticas sobre este campo):

```
pendiente | confirmado | en_preparacion | entregado | cancelado
```

Un pedido nuevo arranca en `pendiente`. Los cambios de estado los hace
el staff manualmente desde el panel administrativo — no hay ninguna
acción que el cliente/app pueda tomar para cambiar el estado.

### Sin notificaciones en tiempo real

No hay websockets ni push. Hoy el flujo real es: el sitio web muestra un
botón "Confirmar por WhatsApp" que abre un link `wa.me` prellenado, y un
humano (o el bot) confirma el pedido por WhatsApp. Si tu app quiere
mostrar el estado actualizado, la única opción hoy es **hacer polling** a
`GET /pedidos/:id` (respetá el rate limit, ver sección 9) — no hay un
webhook al que suscribirte.

## 5. Puntos de fidelidad

### `GET /puntos/saldo?telefono=3157861208` (público, sin autenticación)

```json
{
  "nombre": "Juan Pérez",
  "puntos": 340,
  "valorPuntoPesos": 50,
  "puntosMinimoCanje": 100
}
```

`404` si no existe un cliente con ese teléfono.

Reglas del programa (fijas, configurables solo por un admin):

- 1 punto por cada $1.000 COP gastados.
- Cada punto vale $50 COP de descuento.
- Mínimo 100 puntos para poder canjear.
- Los puntos vencen a los 12 meses de inactividad (sin compras que
  generen puntos nuevos).
- No hay histórico migrado de antes del sitio nuevo — todo cliente
  arranca en 0 puntos la primera vez que aparece en el sistema.

## 6. Blog (opcional, requiere sesión de usuario)

Solo relevante si tu app va a mostrar contenido del blog. Lectura es
pública; comentar y dar like requiere `Authorization: Bearer <token>` de
una sesión Supabase (cualquier usuario logueado, sin rol especial):

| Método | Ruta | Auth |
|---|---|---|
| GET | `/blog/posts` | pública |
| GET | `/blog/posts/:slug` | pública |
| GET | `/blog/posts/:slug/comentarios` | pública |
| POST | `/blog/posts/:slug/comentarios` `{ "contenido": "string, máx 2000" }` | requiere sesión |
| DELETE | `/blog/comentarios/:id` | requiere sesión, solo el autor |
| GET | `/blog/posts/:slug/likes` | pública |
| GET | `/blog/posts/:slug/likes/estado` | requiere sesión |
| POST | `/blog/posts/:slug/likes` (toggle on/off) | requiere sesión |

## 7. Manejo de errores

Todas las respuestas de error de esta API tienen esta forma exacta
(formato estándar de NestJS):

```json
{ "statusCode": 400, "message": "Descripción del error en español", "error": "Bad Request" }
```

Mostrá `message` directamente al usuario cuando tenga sentido — son
mensajes ya redactados en español para el cliente final, por ejemplo:

- `"Falta el nombre del cliente."`
- `"El teléfono no tiene un formato válido."`
- `"El correo no tiene un formato válido."`
- `"Falta la dirección de entrega."`
- `"Método de pago inválido."`
- `"Pedido no encontrado."` (404)

## 8. Pagos

**No hay pasarela de pago integrada — todo se concilia offline.** El
campo `metodo_pago` (`efectivo | transferencia | tarjeta`) es solo
informativo: no se procesa ningún cobro desde la API, no hay SDK de
Stripe/Wompi/MercadoPago ni nada similar que integrar.

- **Efectivo**: se paga en persona (retiro) o al repartidor (domicilio).
- **Transferencia**: el cliente transfiere manualmente a la cuenta del
  negocio (Banco Nu, llave `1118843420`) y envía el comprobante por
  WhatsApp — no hay verificación automática. Tu app puede mostrar estos
  datos de la misma forma que lo hace el sitio web hoy.
- **Tarjeta**: aceptado como valor, pero sin ningún procesamiento —
  actualmente pendiente de decisión de negocio, no lo implementes
  asumiendo que hay un cobro real detrás.

## 9. Imágenes

`imagen_url` (en productos y posts de blog) es siempre una URL completa y
lista para usar, o `null`. No hay una convención de bucket/carpeta que
debas construir vos mismo — solo renderizala directo (`<Image>` /
`AsyncImage` / equivalente de tu framework), con un placeholder para el
caso `null`.

## 10. CORS

**No aplica a una app móvil nativa.** CORS es un mecanismo que solo
enforcean los navegadores; una app iOS/Android nativa (no una WebView
dentro de un navegador) no necesita estar en ningún allowlist para
consumir esta API. Si en algún momento tu app usa una WebView que hace
`fetch` directo a la API, ahí sí podría aplicar — avisale al equipo si
llega ese caso.

## 11. Rate limiting

120 requests por minuto por IP, aplicado a toda la API salvo `/health` y
los webhooks internos de Meta. El uso normal de una app (navegar
catálogo, hacer un checkout, consultar puntos/estado de pedido) está muy
por debajo de ese límite — solo evitá hacer polling agresivo (por
ejemplo, cada 1-2 segundos) al estado de un pedido.

## 12. Limitaciones conocidas — qué falta construir

Esto **no existe hoy** en el backend. Si tu app lo necesita, hay que
conversarlo con el equipo antes de asumir que ya está disponible:

- **No hay "mis pedidos" por cuenta o por teléfono.** Solo se puede
  consultar un pedido puntual por su `id` (UUID), que tu app tiene que
  guardar localmente en el momento del checkout. No hay un endpoint que
  liste el historial de pedidos de un cliente.
- **No hay cuenta de cliente vinculada a los pedidos/puntos.** Una sesión
  de Supabase (login) hoy solo habilita comentar/dar like en el blog — no
  está conectada a la tabla de clientes, pedidos ni puntos de fidelidad.
  Si querés "iniciar sesión y ver mi historial completo" en la app, es
  una funcionalidad nueva a construir, no algo que ya exista.
- **No hay notificaciones push ni websockets** para avisar cambios de
  estado de un pedido — solo polling manual a `GET /pedidos/:id`.
- **No hay pasarela de pago en línea** (ver sección 8).

## 13. Referencia rápida de endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/catalogo/categorias` | pública | Categorías del menú |
| GET | `/catalogo/productos` | pública | Lista de productos activos |
| GET | `/catalogo/productos/:slug` | pública | Un producto |
| POST | `/pedidos` | pública | Crear un pedido (checkout) |
| GET | `/pedidos/:id` | pública | Consultar un pedido |
| GET | `/puntos/saldo?telefono=` | pública | Saldo de puntos de un cliente |
| GET | `/blog/posts` | pública | Lista de posts publicados |
| GET | `/blog/posts/:slug` | pública | Un post |
| GET | `/blog/posts/:slug/comentarios` | pública | Comentarios de un post |
| POST | `/blog/posts/:slug/comentarios` | sesión | Comentar |
| DELETE | `/blog/comentarios/:id` | sesión | Borrar mi comentario |
| GET | `/blog/posts/:slug/likes` | pública | Total de likes |
| GET | `/blog/posts/:slug/likes/estado` | sesión | Si yo le di like |
| POST | `/blog/posts/:slug/likes` | sesión | Dar/quitar like |
