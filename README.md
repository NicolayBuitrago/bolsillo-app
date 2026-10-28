# Bolsillo

App de finanzas personales (móvil, web y API) con captura automática de movimientos.
La especificación completa está en [`CLAUDE.md`](CLAUDE.md) y [`docs/`](docs/).

## Requisitos

- Node.js 22.13+ y pnpm 12 (`npm i -g pnpm@12`)
- Docker (Postgres local)
- Para la app Android: Android Studio + SDK (`pnpm --filter @bolsillo/mobile android`) o EAS Build

## Puesta en marcha

```bash
pnpm install
docker compose -f infra/docker-compose.dev.yml up -d   # Postgres en localhost:5433

# Variables de entorno (valores de desarrollo listos para usar)
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env
cp packages/db/.env.example packages/db/.env

pnpm db:migrate
pnpm dev            # api :3000 · web :3100 · Metro :8081
```

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Todas las apps; `pnpm dev --filter @bolsillo/api` para una sola |
| `pnpm lint` | Biome |
| `pnpm typecheck` | TypeScript en todos los paquetes |
| `pnpm test` | Vitest (core, db, api, api-client) y jest-expo (mobile). Requiere Postgres |
| `pnpm db:generate` / `db:migrate` / `db:seed` | Migraciones y seed de Drizzle |

## Estructura

```
apps/api          Hono sobre Node
apps/web          Next.js (App Router) + Tailwind 4 + shadcn/ui
apps/mobile       Expo + expo-router + NativeWind (development build)
packages/core     Dominio puro: dinero, fechas, esquemas
packages/db       Drizzle: esquema, migraciones, seed
packages/api-client  Cliente tipado (hono/client) + TanStack Query
packages/config   tsconfig, Biome y tokens de diseño
infra/            Docker Compose
```
