# Pizzería Horebs — Guía del proyecto

Guía única del repo: datos de negocio confirmados, estándares de código y
checklists. La leen los agentes que editan código y el revisor automático
(Guardian Angel, `RULES_FILE` en `.gga`).

## Índice

1. [Qué es esto](#1-qué-es-esto)
2. [Decisiones de negocio confirmadas](#2-decisiones-de-negocio-confirmadas)
3. [Estilo visual de marca](#3-estilo-visual-de-marca)
4. [Bibliotecas, frameworks y herramientas](#4-bibliotecas-frameworks-y-herramientas)
5. [Arquitectura y patrones de diseño](#5-arquitectura-y-patrones-de-diseño)
6. [Convenciones de nomenclatura y estilo](#6-convenciones-de-nomenclatura-y-estilo)
7. [Contrato HTTP del API](#7-contrato-http-del-api-rfc-9110-y-rfc-9457)
8. [Reglas de testing](#8-reglas-de-testing)
9. [Frontend (Next.js admin)](#9-frontend-nextjs-admin)
10. [Deploy y verificación](#10-deploy-y-verificación)
11. [Checklists de revisión y Pull Requests](#11-checklists-de-revisión-y-pull-requests)

---

## 1. Qué es esto

Monorepo para reemplazar el sitio actual de WordPress + WooCommerce de
Pizzería Horebs (Riohacha, La Guajira) por un sitio moderno con catálogo,
carrito y checkout en línea.

- `apps/api` — NestJS 11 (REST API), TypeScript, Node 22 LTS en Railway
  (builder Railpack, `engines.node` en `apps/api/package.json`).
- `apps/web` — Next.js 16 App Router, TypeScript, Vercel. Ver
  `apps/web/AGENTS.md` para los cambios de API entre versiones de Next.
- Base de datos: Supabase (Postgres).
- `.env.example` en `apps/api` y `.env.local.example` en `apps/web`: copiar y
  completar con credenciales reales de Supabase antes de correr nada.
- `.mcp.json` registra los conectores MCP de Supabase y Vercel.
- `GET /health` verifica conectividad REAL con Supabase (no solo que el
  servidor arrancó).

## 2. Decisiones de negocio confirmadas

**No inventar otras.** Precios, horarios, dirección y teléfono salen siempre
de `CatalogService` / Supabase / este documento. Si falta un dato, se
pregunta; no se supone un valor razonable.

- El sitio DEBE mantener carrito y checkout en línea — no es solo una vitrina.
- La migración del histórico de WooCommerce (18,723 pedidos, 5,393 clientes)
  se decide DESPUÉS de tener el sitio nuevo funcionando — no es prioridad hoy.
- Horario del negocio: lunes a domingo, 4:00pm–11:00pm.
- Horario del bot de WhatsApp: toma pedidos de 11:00am a 11:00pm; los que
  llegan antes de las 4:00pm son reservas con franja de entrega (cada 30 min
  desde las 4:00pm) — confirmado por el dueño el 27 oct 2026.
- Dirección oficial: Carrera 7 # 17B - 66, Riohacha, La Guajira (confirmada
  por el dueño; es la que va en el PDF del comprobante, en lugar de la del
  RUT). Zona: sur de Riohacha (confirmado oct 2026) — nunca decir "centro".
- Datos fiscales del emisor (RUT, persona natural — se imprimen en el PDF del
  comprobante, que NO es factura electrónica DIAN): NIT `1.118.843.420-7`,
  régimen "No responsable de IVA"; solo se muestra el nombre comercial
  "Pizzería Horebs", no el nombre personal del titular.
- WhatsApp: +57 315 786 1208 (canal de confirmación de pedidos).
- Dominio activo: `pizzeriahorebs.shop`. **NUNCA** usar ni enlazar
  `pizzeriahorebs.com` (expiró, ya no es del negocio) — ni en código, ni en
  contenido, ni en ejemplos.
- Productos ancla: **Pizza Horebs Especial** (posicionar como "firma de la
  casa") y **Pizza Hawaiana** — presencia destacada en el catálogo, por
  encima del resto del menú.
- Catálogo actual: 17 productos publicados en el sitio viejo.
- Métodos de pago históricos: ~77% efectivo, ~22% transferencia bancaria,
  <1% tarjeta — priorizar efectivo/transferencia en el checkout; tarjeta es
  opcional y está pendiente de decisión.
- Costo de domicilio: $5.000 (`COSTO_DOMICILIO_DEFAULT` en
  `apps/api/src/common/costos.ts`) — fijo en el checkout web, y valor
  sugerido cuando el POS no especifica un costo manual. El domicilio
  **nunca** es gratis salvo que se decida una promoción puntual explícita.
- Tamaños de pizza: Personal = 6 porciones, 24 cm; Mediana = 8 porciones,
  30 cm; Grande = 12 porciones, 40 cm.
- Pizza mitad y mitad: en cualquier tamaño el cliente puede pedir una pizza
  de dos sabores distintos, y siempre se cobra el precio del sabor de mayor
  valor (confirmado 29 oct 2026). El bot lo explica al cliente y deja escrito
  en el pedido qué sabores lleva (herramienta `cotizar_pizza_mitad_y_mitad`,
  `mensajeria/pizza-mitad.ts`).
- Descuento de la oferta de seguimiento por conversación abandonada: 10%
  (`DESCUENTO_OFERTA_PORCENTAJE` en `seguimiento.service.ts`) — se ofrece si
  el cliente no responde tras el recordatorio de las 3 horas.
- Transferencia bancaria: Banco Nu, llave `1118843420` (mismo número que el
  NIT del RUT) — se muestra en la página de confirmación de pedido cuando el
  método de pago es transferencia.
- Programa de fidelidad (puntos): 1 punto por cada $1.000 gastados, cada
  punto vale $50 de descuento, mínimo 100 puntos para canjear, vencen a los
  12 meses de inactividad (sin compras que generen puntos). Configurable
  desde `admin/clientes` (tabla `configuracion`, servicio `PuntosService`).
  Aplica tanto en el checkout web como en el POS. No se migró histórico de
  WooCommerce — todos los clientes arrancaron en 0 puntos.
- El bot de WhatsApp/Messenger/Instagram nunca inventa precios ni suma
  totales por su cuenta — siempre pasa por una tool que consulta Supabase.

## 3. Estilo visual de marca

- Fotografía de producto: ángulo picado de 45°, luz cálida direccional.
- Entorno: tabla de madera circular rústica sobre mesa de madera oscura.
- Paleta de referencia (validar contra el logo real antes de usarla como
  definitiva): naranja `#FF6B35`, azul profundo `#1A3A52`, amarillo `#FFD93D`.
- Tono de comunicación: cercano, profesional, antojador, directo.

## 4. Bibliotecas, frameworks y herramientas

| Área | Se usa | No se usa / no agregar |
|---|---|---|
| Backend | NestJS 11, TypeScript | — |
| Base de datos | Supabase (Postgres) con `@supabase/supabase-js` crudo | ORM de ningún tipo |
| Validación | Validadores propios en `common/validacion.ts` + pipes (`ValidarBodyPipe`, `UuidPipe`, `LimitePipe`, `FechaPipe`) | `class-validator`, carpeta `dto/` |
| HTTP saliente | `fetch()` nativo | `axios`, `@nestjs/axios` (sin necesidad real) |
| Logs | `Logger` de `@nestjs/common` | winston, pino, `console.log` |
| Config | `ConfigService.get<string>('CLAVE')` | `process.env` directo (salvo `ConfigService` y el bootstrap) |
| Frontend | Next.js 16 App Router, Tailwind con clases de marca | MUI, Chakra u otra librería de componentes pesada |
| Tests | Jest 30 + ts-jest, `supertest` para e2e | — |
| Lint y formato | ESLint (`apps/api/eslint.config.mjs`) + Prettier (solo `apps/api`) | Prettier en `apps/web` (no tiene config) |
| Revisión | Guardian Angel (hook de pre-commit, lee este archivo) | — |
| Despliegue | Railway (`apps/api`), Vercel (`apps/web`, proyecto `horebs-web`) | — |

Un paquete ESM-puro (ej. `@react-pdf/renderer`) en un archivo que compila a
CommonJS se carga con `import()` dinámico dentro de la función que lo
necesita: un `import` estático revienta en runtime con `ERR_REQUIRE_ESM`, no
en el build.

## 5. Arquitectura y patrones de diseño

### Módulo de backend

Cada feature es `carpeta/feature.module.ts` + `feature.controller.ts`
(delgado, solo delega) + `feature.service.ts` (toda la lógica + las
interfaces de entrada/salida declaradas arriba del archivo). Un módulo con
varios subrecursos (`inventario/`, `mensajeria/`, `admin/`) agrupa varios
pares controller/service bajo el mismo módulo en vez de un controller
gigante.

- **Un controller por recurso:** `admin/pedidos-admin.controller.ts`, no un
  `admin.controller.ts` de todo.
- **Compartir entre módulos:** el service se agrega a `exports` de su propio
  `*.module.ts` y el consumidor importa el módulo (no la clase suelta).
  Revisar que no se forme un ciclo de imports.
- **Partir un service de más de 400 líneas:** lo puro (tipos, mappers,
  cálculo, plantillas, prompts, fechas) va a su propio archivo y se testea
  sin Nest. Ejemplos: `admin/calcular-items-venta.ts`,
  `mail/plantilla-domicilio.ts`, `mensajeria/gemini-prompt.ts`,
  `informes/informes-fechas.ts`, `nomina/empleado-cambios.ts`.
- **No se repite un bloque de más de tres líneas:** se extrae
  (`admin/items-stock.ts`).
- **Bootstrap del contrato HTTP:** `src/configurar-app.ts` (CORS, filtro
  global, guard de tipo de contenido e interceptores). Lo usan `main.ts` y el
  e2e del contrato, así no pueden divergir.

### Patrones transversales

- **Trabajo no crítico** (mail, notificaciones) que no debe bloquear la
  respuesta: fire-and-forget. Método `void` que dispara una promesa con su
  propio `.catch()` adentro; el caller nunca hace `await`. Ver
  `MailService.enviarNotificacionDomicilio`.
- **Errores de Supabase:** siempre por `errorDeBase(error)`
  (`common/error-de-base.ts`), que traduce el código de Postgres a 409, 400,
  404 o 503. Nunca relanzar el error crudo.
- **Autorización:** rutas públicas (catálogo, pedidos, webhooks) sin
  `@UseGuards`. Rutas admin: `@UseGuards(RolesGuard)` a nivel de controller +
  `@Roles('admin')` o `@Roles('admin', 'empleado')` por endpoint.
- **Webhooks de Meta:** contrato propio de Meta (200 siempre, verificación
  por GET, firma HMAC sobre el body crudo, por eso `rawBody: true`). No se
  les aplica el contrato REST normal. Igual excepción para
  `GET /catalogo/feed.csv` y `GET /health`.

### Zona horaria — bug recurrente a vigilar

El negocio opera en `America/Bogota` (UTC-5, sin DST). Cualquier código que
determine "hoy" o agrupe por fecha usando `.toISOString()` o slicing crudo de
UTC va a estar mal durante el horario nocturno (cruza medianoche UTC).

- Backend: `inicioDiaBogota` / `finDiaBogota` de `common/horario.ts`, o el
  offset ya establecido en `informes/informes-fechas.ts`.
- Frontend: `new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' })`.

Esto ya causó bugs reales dos veces (frontend y backend, por separado):
tratarlo como sospechoso por defecto en cualquier código nuevo que compare o
agrupe fechas.

## 6. Convenciones de nomenclatura y estilo

### Nombres

- **Dominio en español:** métodos, servicios y rutas del negocio
  (`darMeGusta`, `ajustarStock`, `inicioDiaBogota`). Los `getX` heredados
  (`getProductos`, `getMeGusta`…) se renombran cuando se toca ese código, no
  en un cambio aparte.
- **`camelCase`** para variables, funciones y métodos; **`PascalCase`** para
  clases, interfaces y tipos; **`SCREAMING_SNAKE_CASE`** para constantes de
  módulo (`COSTO_DOMICILIO_DEFAULT`, `ESQUEMA_AJUSTE_PUNTOS`).
- **`snake_case`** en lo que viene o va a Postgres y en los bodies JSON del
  API (`monto_semanal`, `dias_esperados_semana`), porque son las columnas.
- **Archivos:** `kebab-case` con sufijo de rol: `*.module.ts`,
  `*.controller.ts`, `*.service.ts`, `*.pipe.ts`, `*.interceptor.ts`,
  `esquemas.ts` (uno por módulo), `*.spec.ts`.
- **Rutas HTTP:** sustantivos en plural, sin verbos (`/turnos`,
  `/inventario/insumos/:id/ajustes`).
- **Tipos de entrada/salida:** interfaces TypeScript declaradas arriba del
  archivo del service que las usa (`CrearEmpleadoInput`, `EmpleadoDto`). Un
  controller no declara interfaces propias.

### Formato

- Prettier en `apps/api` (`.prettierrc`: comillas simples, coma final en todo)
  integrado a ESLint como regla `prettier/prettier`: `npx eslint --fix` lo
  deja en regla. Sangría de 2 espacios.
- **`apps/web` no tiene config de Prettier: no correrlo ahí**, reformatea
  archivos enteros. Se edita a mano respetando el estilo del archivo.
- Comentarios solo cuando explican un *porqué* que el código no dice
  (una decisión, una trampa, una regla de negocio).

### Reglas de ESLint (`apps/api/eslint.config.mjs`)

Aplican a `src/**` sin specs:

| Regla | Límite |
|---|---|
| `max-lines` | 400 |
| `max-lines-per-function` | 50 (sin blancos ni comentarios) |
| `complexity` | 10 |
| `max-params` | 4 |
| `max-depth` | 3 |
| `no-explicit-any` | sin `any` |
| `no-floating-promises` | `error` |

Van como `warn` porque hay deuda medida. **El conteo solo puede bajar** y no
se acepta código nuevo que agregue advertencias. Cada regla pasa a `error`
cuando llega a cero (`no-floating-promises` ya lo es). Conteo al 2026-10-28:
`max-lines` 7, `max-lines-per-function` 26, `complexity` 41, `max-params` 15,
`max-depth` 3, `no-explicit-any` 26 (filas de Supabase sin tipar en los
mappers).

`npm run lint` global no está limpio hoy por errores heredados en varios
archivos (por ejemplo `gemini.service.ts`). La regla práctica: **los archivos
que tocas no pueden tener más errores ni advertencias que antes**.

### Reglas de código backend

- Excepciones: las de `@nestjs/common` (`BadRequestException`,
  `NotFoundException`, `ConflictException`…). Nunca `throw new Error()` plano
  en un controller o service público.
- Logger: `new Logger(NombreClase.name)`.
- Commits: conventional commits (`feat`, `fix`, `refactor`, `test`, `docs`…),
  sin atribución de IA (nunca `Co-Authored-By` ni similar).

## 7. Contrato HTTP del API (RFC 9110 y RFC 9457)

- **Errores:** siempre una excepción de Nest; el filtro global
  (`common/problem-details.filter.ts`) los responde como
  `application/problem+json` con `type`, `title`, `status`, `detail`,
  `instance` y, en validación, `errores[]`. El texto para el usuario va en
  `detail`; el web lo lee con `leerErrorApi()`
  (`apps/web/src/lib/error-api.ts`). No existe un campo `message`.
- **Entrada:** todo `:id` uuid lleva `UuidPipe`; `?limit=` lleva `LimitePipe`;
  las fechas `FechaPipe`; un body de forma simple lleva
  `ValidarBodyPipe(ESQUEMA_X)` con el esquema en el `esquemas.ts` del módulo
  (estricto: un campo desconocido es 400). Un body con arreglos anidados
  (ej. `detalle` de una compra) se valida línea por línea en el service y el
  controller lo dice en un comentario. Un `POST`, `PUT` o `PATCH` que no
  trae JSON es 415 (`ContentTypeGuard`).
- **Códigos:** `POST` que crea → 201 (con `@Ubicacion('/ruta/:id')` solo si
  existe ese `GET`); acción que no crea nada → `@HttpCode(200)`; `DELETE` →
  `@HttpCode(204)`; conflicto de estado (ya liquidada, duplicado) →
  `ConflictException` (409), no 400.
- **Rutas:** sustantivos en plural, sin verbos. Un cambio de estado es un
  `PATCH` del recurso; algo idempotente es `PUT` (ej. `likes/yo`). Una ruta
  que se reemplaza convive con la vieja marcada `@Deprecada('/nueva')` hasta
  que el web migre y pase una ventana de gracia. Quitar la vieja antes solo
  lo decide el dueño del negocio, de forma explícita y por escrito (ej. el
  sitio no tiene tráfico real); el revisor no lo infiere por su cuenta.
- **Caché:** un `GET` público e igual para todos lleva `@CachePublica(60)`;
  todo lo demás sale con `no-store` (lo pone un interceptor global). Un
  `GET` que el cliente vuelve a pedir justo después de escribir (comentarios,
  likes) no se cachea.
- **CORS:** `Location`, `Deprecation`, `Link` y `Retry-After` están
  expuestas; sin eso el navegador las oculta a un `fetch` de otro origen.
- **Red de seguridad de refactors:** `apps/api/test/rutas.snapshot.txt` fija
  las URLs. Mover código entre archivos no puede cambiarlas; un cambio de
  contrato se hace a propósito con `ACTUALIZAR_RUTAS=1 npm run test:e2e`.

## 8. Reglas de testing

- **Dónde:** specs unitarios `*.spec.ts` junto al código que prueban; e2e en
  `apps/api/test/*.e2e-spec.ts`. Comandos desde `apps/api`: `npm test` y
  `npm run test:e2e`.
- **Lo puro se testea sin Nest:** funciones de fechas, mappers, cálculo,
  plantillas, esquemas de validación y helpers extraídos tienen su spec sin
  levantar módulos. Una plantilla de correo o similar se cubre con snapshots
  (`__snapshots__`) normalizando el espaciado.
- **Un cambio de comportamiento lleva su test en el mismo commit.** Un bug de
  seguridad o de dinero se arregla primero con un test que falla (ej. el
  escape de `"` en la plantilla del domicilio).
- **E2E del contrato HTTP:** los de `validacion-http` y `semantica-http` usan
  controllers de juguete para probar las piezas (pipes, filtro, interceptores);
  `contrato-http` levanta la `AppModule` real con `configurarApp` y verifica
  404/401 como `problem+json`, 415, CORS y rutas retiradas.
- **Aislamiento de producción (obligatorio):** un e2e que carga `AppModule`
  hace `process.chdir(tmpdir())` y fija `SUPABASE_URL` a un puerto cerrado
  **antes** de cargar el módulo (por eso usa `require` con su
  `eslint-disable` justificado). Así `ConfigModule` no lee el `.env` real y
  ningún test toca la base de producción.
- **Nunca crear ventas ni pedidos de prueba corriendo el API local:** el API
  local escribe en la base de producción.
- **Arranque lento:** un `beforeAll` que compila `AppModule` lleva timeout
  explícito (30 s); con la caché de ts-jest fría pasa los 5 s por defecto.
- **Specs fuera de las reglas de tamaño:** `max-lines`, `complexity` y demás
  no aplican a specs, y el revisor (Guardian Angel) los excluye.
- **Cobertura mínima de una ruta nueva o cambiada:** su esquema de
  validación (caso válido, inválido y campo desconocido) y, si cambia el
  contrato, la tabla `rutas.snapshot.txt`.
- **Módulos apagados en producción** (hoy Nómina e Inventario): sus escrituras
  se cubren solo con tests; no hay dónde probarlas a mano.

## 9. Frontend (Next.js admin)

- Fetch autenticado: `adminFetch()` de `@/lib/admin-fetch` (agrega el bearer
  token de la sesión de Supabase). Nunca `fetch()` crudo hacia `/admin/*`.
- Errores del API: `leerErrorApi(res, 'mensaje por defecto')` (lee `detail`).
- `app/admin/layout.tsx` ya envuelve TODO el árbol `/admin/*` en
  `<RequireRol roles={['admin', 'empleado']}>`: cualquier página nueva bajo
  `/admin` hereda ese guard sin hacer nada. Una página solo necesita su
  propio `<RequireRol roles={['admin']}>` cuando exige un nivel más estricto
  que el del layout (ver `configuracion`, `blog`, `usuarios`). Páginas de
  acceso general (`pos`, `inventario`, `pedidos`, `seguimiento`, `nomina`)
  correctamente NO llevan wrapper propio: no es un guard faltante, es
  composición con el layout. `seguimiento` es `admin`+`empleado` a propósito
  (varios pueden atender el WhatsApp, no solo el dueño) — confirmado contra
  los `@Roles(...)` reales de `admin/seguimiento-admin.controller.ts`, no
  contra este documento. El guard redirige solo si no hay sesión: no
  duplicar esa lógica a mano.
- Loading state: `<CargandoSkeleton filas={N} />`, no spinners ni skeletons
  hechos a mano.
- Estilos: clases de marca ya definidas (`brand-orange`, `brand-navy`,
  `btn-gradient`, `card-gradient`). Constantes de negocio compartidas con el
  API (como el costo de domicilio) se leen de `NEGOCIO`, no se duplican.
- `dark:` solo hace falta en texto, borde o fondo que se apoya directamente en
  el fondo de la página (grises `zinc-*`, y estados como `text-red-600` que
  se aclaran a `dark:text-red-400` / `dark:text-green-500` para mantener
  contraste). `brand-orange` es un valor fijo (`--brand-orange` en
  `globals.css`, no cambia entre temas) y ya se usa sin `dark:` en todo el
  sitio a propósito. Badges y botones con fondo sólido y texto blanco
  (`bg-brand-orange` / `bg-brand-navy` / `bg-red-600` + `text-white`)
  tampoco necesitan `dark:`: el contraste depende del propio fondo del chip.

## 10. Deploy y verificación

- **Nunca correr `npm run build` local para "verificar" un cambio.** La
  verificación real es contra el entorno desplegado: Railway para
  `apps/api`, Vercel para `apps/web`, con `curl` o el navegador contra la URL
  real.
- Railway: el path de deploy es la raíz del repo, no `apps/api` — el servicio
  ya tiene `Root directory: apps/api` configurado remotamente. Un push a
  `main` **no** despliega solo: hay que disparar el redeploy.
- Vercel: el proyecto real es `horebs-web`; despliega solo cuando el commit
  toca `apps/web`. Hay un `vercel.json` suelto en la raíz (no trackeado en
  git, con una config `experimentalServices` deprecada) que rompe cualquier
  deploy manual desde la raíz: si un deploy por CLI falla raro, revisar eso
  antes que nada.
- Tras un deploy, comprobar con `curl -i` contra la URL real: `/health` en
  200, un 404 como `application/problem+json`, y que una ruta retirada
  responda 404.
- Nunca commitear archivos `.env` ni `.env.local` con credenciales reales.
- Todo cambio al esquema de Supabase debe reflejarse también en los
  tipos/interfaces de `apps/api`.
- Horario de cambios riesgosos: el local abre de 4:00pm a 11:00pm
  (Bogotá); lo que pueda romper rutas se despliega fuera de ese horario.

## 11. Checklists de revisión y Pull Requests

### Qué debe frenar una review (bloqueante)

- [ ] Un precio, horario, dirección o dato de negocio que no venga de
      Supabase ni de este documento.
- [ ] Un enlace o referencia a `pizzeriahorebs.com`.
- [ ] Comparación o agrupación de fechas sin conversión explícita a
      `America/Bogota`.
- [ ] `axios`, un ORM, `class-validator` o una carpeta `dto/` nueva.
- [ ] Un `console.log` en vez de `Logger`, o un `throw new Error()` plano en
      un endpoint público.
- [ ] Un `fetch()` a `/admin/*` sin pasar por `adminFetch()`.
- [ ] Un body sin `ValidarBodyPipe` (salvo el caso de arreglos anidados
      comentado) o un `:id` sin `UuidPipe`.
- [ ] Una ruta nueva con verbo en la URL, o un `DELETE` sin `@HttpCode(204)`,
      o un conflicto de estado respondido como 400.
- [ ] Una ruta reemplazada que se borra sin `@Deprecada` y sin decisión
      explícita del dueño.
- [ ] Un `process.env` directo fuera de `ConfigService` y el bootstrap.
- [ ] Más advertencias de ESLint que antes en los archivos tocados.

### Checklist de código (autor y revisor)

- [ ] El controller solo delega; la lógica y las interfaces viven en el
      service.
- [ ] Ningún archivo pasa de 400 líneas, ninguna función de 50, complejidad
      10, 4 parámetros, 3 niveles de anidación; lo puro se extrajo y se testea.
- [ ] No hay un bloque de más de tres líneas repetido.
- [ ] Los nombres del dominio están en español y los archivos siguen el
      sufijo de rol.
- [ ] Los errores de Supabase pasan por `errorDeBase`.
- [ ] El trabajo no crítico (mail, avisos) es fire-and-forget con su `.catch()`.
- [ ] Un cambio de esquema de Supabase está reflejado en las interfaces.
- [ ] Comentarios solo donde explican un porqué.

### Checklist de tests

- [ ] El comportamiento nuevo o cambiado tiene su test en el mismo commit.
- [ ] Los esquemas nuevos se prueban con caso válido, inválido y campo
      desconocido.
- [ ] Si cambió una URL: `rutas.snapshot.txt` actualizado a propósito
      (`ACTUALIZAR_RUTAS=1 npm run test:e2e`) y el diff muestra solo lo
      esperado.
- [ ] `npm test` y `npm run test:e2e` pasan en `apps/api`.
- [ ] Ningún test toca la base de producción ni crea ventas de prueba.

### Checklist de commit y Pull Request

- [ ] Commit en conventional commits, sin `Co-Authored-By` ni atribución de IA.
- [ ] Commits pequeños y por tema: el revisor automático lee los archivos
      completos y tiene timeout de 300 s; un commit grande lo agota.
- [ ] Sin `.env`, `.env.local` ni credenciales en el diff.
- [ ] `npx eslint` de los archivos tocados sin errores nuevos; en `apps/web`
      sin Prettier.
- [ ] La descripción del PR dice qué cambia, por qué, y si rompe el contrato
      HTTP (rutas retiradas, códigos de estado, campos de error).
- [ ] Si el web depende del cambio del API (o al revés), el orden de deploy
      está dicho: primero lo compatible, después lo que quita.
- [ ] Después del merge: redeploy de Railway si tocó `apps/api`, y la
      verificación con `curl -i` de la sección 10.
