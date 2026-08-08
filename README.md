# Horebs App — monorepo

Nuevo sitio de Pizzería Horebs. API en NestJS, frontend en Next.js, base de datos en Supabase.

```
apps/
  api/   → NestJS (REST API)
  web/   → Next.js (frontend, se despliega en Vercel)
```

## 1. Requisitos

- Node.js 20 o superior
- Una cuenta y un proyecto creado en [Supabase](https://supabase.com) (tiene tier gratuito)
- Una cuenta en [Vercel](https://vercel.com) (tiene tier gratuito) para el frontend

## 2. Instalación

Desde la raíz del monorepo (instala ambas apps de una vez gracias a los workspaces de npm):

```bash
npm install
```

## 3. Variables de entorno

Copia los archivos de ejemplo y completa con los datos de tu proyecto de Supabase
(Project Settings → API en el panel de Supabase):

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
```

- `apps/api/.env` usa la **Service Role Key** (privilegios completos — nunca la subas a git ni la expongas al navegador).
- `apps/web/.env.local` usa la **Anon/Public Key** (segura para el navegador).

## 4. Correr en local

En dos terminales separadas:

```bash
npm run dev:api   # http://localhost:3000
npm run dev:web   # http://localhost:3001
```

Abre `http://localhost:3001` — deberías ver la página de inicio confirmando que
el frontend, el API y Supabase están conectados (endpoint `/health` del API).

Nota: Next.js corre por defecto en el puerto 3000, igual que el API. Si tienes
conflicto de puertos, corre el frontend con `npm run dev:web -- -p 3001`.

## 5. Despliegue

### Frontend → Vercel (gratis)

1. Sube este repo a GitHub.
2. En Vercel, "Add New Project" → importa el repo.
3. En **Root Directory**, selecciona `apps/web` (Vercel detecta Next.js automáticamente).
4. Agrega las variables de entorno de `apps/web/.env.local` en la configuración del proyecto en Vercel.
5. Despliega. Vercel usa el `package.json` raíz con workspaces automáticamente para el install.

### Backend → opción gratuita (por definir)

Para el primer mes, evalúa alguna de estas opciones con tier gratuito para
correr NestJS (todas soportan Node.js sin tarjeta de crédito en su plan free):

- **Render** — free web service (se "duerme" tras inactividad, aceptable para empezar)
- **Railway** — tiene un tier gratuito con créditos limitados mensuales
- **Fly.io** — tier gratuito generoso para apps pequeñas

Cualquiera de estas conecta por variables de entorno igual que en local
(`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FRONTEND_URL`). Una vez elegida,
actualiza `NEXT_PUBLIC_API_URL` en las variables de entorno de Vercel para que
apunte a la URL pública del backend desplegado.

### Base de datos → Supabase (gratis)

El tier gratuito de Supabase incluye Postgres, autenticación y storage — suficiente
para arrancar. El API se conecta con la Service Role Key; el frontend con la Anon Key.

## 6. Siguiente paso

Este esqueleto solo prueba conectividad (`/health`). Falta modelar las tablas
reales en Supabase (productos, pedidos, clientes) según lo definido en el
documento de requerimientos, y construir el catálogo, carrito y checkout.

## 7. Desarrollar con Claude Code

Este repo ya incluye `.mcp.json` con Supabase y Vercel configurados a nivel de
proyecto. Para trabajar aquí con Claude Code:

```bash
# Instalar Claude Code (macOS/Linux)
curl -fsSL https://claude.ai/install.sh | bash

# Dentro de la carpeta de este repo
claude
```

La primera vez, Claude Code te pedirá aprobar los servidores MCP del proyecto
(`supabase` y `vercel`) — acepta el prompt. Si ya conectaste Supabase o Vercel
como "connector" en claude.ai con la misma cuenta, esas conexiones se
reconocen automáticamente en la CLI.

Requiere una cuenta Claude Pro, Max, Team, Enterprise o Console — el plan
gratuito de claude.ai no incluye Claude Code.

