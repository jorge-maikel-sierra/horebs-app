# AGENTS.md — Pizzería Horebs

Convenciones reales de este repo, para code review automático (Guardian Angel) y
para cualquier agente que edite código acá. No repite lo que ya está en
`CLAUDE.md` (datos de negocio, decisiones confirmadas) — léelo también.

## Stack

- `apps/api` — NestJS 11, TypeScript, Node 22 LTS en Railway (builder Railpack,
  `engines.node` en `apps/api/package.json`).
- `apps/web` — Next.js 16 App Router, TypeScript, Vercel. Ver
  `apps/web/AGENTS.md` para cambios de API entre versiones de Next.
- Base de datos: Supabase (Postgres). Sin ORM — cliente `@supabase/supabase-js`
  crudo en todos lados.
- Sin `class-validator`, sin carpeta `dto/`. Los tipos de entrada/salida son
  interfaces TypeScript declaradas arriba del archivo del service que las usa.

## Patrón de módulo (backend)

Cada feature es `carpeta/feature.module.ts` + `feature.controller.ts` (delgado,
solo delega) + `feature.service.ts` (toda la lógica + interfaces inline). Un
módulo con varios subrecursos (ej. `inventario/`, `mensajeria/`) agrupa varios
pares controller/service bajo el mismo módulo en vez de un controller gigante.

Para exponer un service a otro módulo: agregarlo a `exports` en su propio
`*.module.ts` e importar el módulo (no la clase suelta) en el módulo consumidor.
Revisar que no se forme un ciclo de imports entre módulos.

## Reglas de negocio — nunca inventar

- Precios, horarios, dirección, teléfono: siempre desde `CatalogService` /
  Supabase / lo ya confirmado en `CLAUDE.md`. Si falta un dato, preguntar, no
  suponer un valor razonable.
- Dominio activo: `pizzeriahorebs.shop`. Nunca usar ni enlazar
  `pizzeriahorebs.com` (expirado, ya no es del negocio) — ni en código, ni en
  contenido, ni en ejemplos.
- El bot de WhatsApp/Messenger/Instagram nunca inventa precios ni suma totales
  por su cuenta — siempre pasa por una tool que consulta Supabase.

## Zona horaria — bug recurrente a vigilar

El negocio opera en `America/Bogota` (UTC-5, sin DST). Cualquier código que
determine "hoy" o agrupe por fecha usando `.toISOString()` o slicing crudo de
UTC va a estar mal durante el horario nocturno (cruza medianoche UTC). Usar
`new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' })` en frontend,
o el offset manual ya establecido en `informes.service.ts` en backend. Esto ya
causó bugs reales dos veces (frontend y backend, por separado) — tratarlo como
sospechoso por defecto en cualquier código nuevo que compare o agrupe fechas.

## Backend (NestJS)

- Logger: `new Logger(NombreClase.name)` de `@nestjs/common`. Nunca
  winston/pino.
- HTTP saliente: `fetch()` nativo. No hay `axios` ni `@nestjs/axios` instalado
  — no agregarlo sin necesidad real.
- Excepciones: `BadRequestException` / `NotFoundException` de
  `@nestjs/common`, nunca `throw new Error()` plano en un controller/service
  público.
- Rutas públicas (catálogo, pedidos, webhooks): sin `@UseGuards`. Rutas admin:
  `@UseGuards(RolesGuard)` a nivel de controller + `@Roles('admin')` o
  `@Roles('admin', 'empleado')` por endpoint.
- Trabajo no crítico que no debe bloquear la respuesta (mail, notificaciones):
  patrón fire-and-forget — método `void` que dispara una promesa con `.catch()`
  propio adentro, nunca se hace `await` desde el caller. Ver
  `MailService.enviarNotificacionDomicilio`.
- Config: `ConfigService.get<string>('CLAVE_GRITADA')`, nunca `process.env`
  directo salvo en el propio `ConfigService`/bootstrap.
- Si un paquete es ESM-puro (ej. `@react-pdf/renderer`) y el archivo compila a
  CommonJS, usar `import()` dinámico adentro de la función que lo necesita —
  un `import` estático revienta en runtime con `ERR_REQUIRE_ESM`, no en build.

## Frontend (Next.js admin)

- Fetch autenticado: `adminFetch()` de `@/lib/admin-fetch` (agrega el bearer
  token de la sesión de Supabase). Nunca `fetch()` crudo hacia `/admin/*`.
- `app/admin/layout.tsx` ya envuelve TODO el árbol `/admin/*` en
  `<RequireRol roles={['admin', 'empleado']}>` — cualquier página nueva bajo
  `/admin` hereda ese guard sin hacer nada. Una página solo necesita su
  propio `<RequireRol roles={['admin']}>` cuando exige un nivel más
  estricto que el del layout (ver `configuracion`, `blog`, `usuarios`,
  `seguimiento`); páginas de acceso general (`pos`, `inventario`,
  `pedidos`) correctamente NO llevan wrapper propio — no es un guard
  faltante, es composición con el layout. El guard redirige solo si no hay
  sesión — no duplicar esa lógica a mano.
- Loading state: `<CargandoSkeleton filas={N} />`, no spinners custom.
- Estilos: clases de marca ya definidas (`brand-orange`, `brand-navy`,
  `btn-gradient`, `card-gradient`). Sin librería de componentes pesada (no
  MUI/Chakra/etc.).
- `dark:` solo hace falta en texto/borde/fondo que se apoya directamente en
  el fondo de la página (grises `zinc-*`, y estados como `text-red-600` que
  se aclaran a `dark:text-red-400`/`dark:text-green-500` para mantener
  contraste). `brand-orange` es un valor fijo (`--brand-orange` en
  `globals.css`, no cambia entre temas) y ya se usa sin `dark:` en todo el
  sitio a propósito. Badges/botones con fondo sólido y texto blanco
  (`bg-brand-orange`/`bg-brand-navy`/`bg-red-600` + `text-white`) tampoco
  necesitan `dark:` — el contraste depende del propio fondo del chip, no
  del tema de la página.

## Deploy y verificación

- **Nunca correr `npm run build` local para "verificar" un cambio.** La
  verificación real es contra el entorno desplegado: Railway para
  `apps/api`, Vercel para `apps/web`, con `curl`/browser contra la URL real.
- Railway: el path de deploy es la raíz del repo, no `apps/api` — el servicio
  ya tiene `Root directory: apps/api` configurado remotamente.
- Vercel: el proyecto real es `horebs-web`. Hay un `vercel.json` suelto en la
  raíz (no trackeado en git, con una config `experimentalServices`
  deprecada) que rompe cualquier deploy manual desde la raíz — si un deploy
  por CLI falla raro, revisar eso antes que nada.
- Commits: conventional commits, sin atribución de IA (nunca
  `Co-Authored-By` ni similar).

## Qué debería frenar una review

- Un precio, horario, dirección o dato de negocio que no venga de Supabase o
  de `CLAUDE.md`.
- Un enlace o referencia a `pizzeriahorebs.com`.
- Comparación o agrupación de fechas sin conversión explícita a
  `America/Bogota`.
- `axios`, un ORM, o una carpeta `dto/` nueva — no son el patrón de este repo.
- Un `console.log` en vez de `Logger`, o un `throw new Error()` plano en un
  endpoint público.
- Un `fetch()` a `/admin/*` sin pasar por `adminFetch()`.
