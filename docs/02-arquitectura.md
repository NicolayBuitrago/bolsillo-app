# 02 · Arquitectura

## Visión general

```
                ┌──────────────────────┐
                │   apps/web (Next.js) │──┐  rewrites /api/* → API (mismo origen, cookies first-party)
                └──────────────────────┘  │
┌──────────────────────────────┐          ▼
│ apps/mobile (Expo / RN)      │   ┌───────────────────┐      ┌──────────────┐
│  ├─ UI (expo-router)         │──▶│ apps/api (Hono)   │─────▶│ PostgreSQL   │
│  ├─ SQLite local (outbox)    │   │  ├─ Better Auth   │      └──────────────┘
│  └─ modules/notification-    │   │  ├─ módulos REST  │
│     listener (Kotlin)        │   │  ├─ pipeline de   │─────▶ Anthropic API (opcional)
└──────────────────────────────┘   │  │  captura        │
   Atajo iOS ── POST + token ─────▶│  └─ jobs diarios  │
   Worker de correo ── HMAC ──────▶└───────────────────┘
```

- La **API es la única fuente de verdad** y el único lugar con secretos.
- El **parseo de capturas ocurre en el servidor**: se pueden mejorar los parsers y reprocesar capturas sin publicar una nueva versión de la app.
- El móvil es **online-first con cola offline**: lee de la API (con caché persistida) y encola escrituras y capturas cuando no hay red.

## Estructura del monorepo

```
bolsillo/
├─ apps/
│  ├─ api/                    Hono sobre Node
│  │  └─ src/
│  │     ├─ index.ts          arranque del servidor
│  │     ├─ app.ts            composición de rutas; exporta `AppType`
│  │     ├─ env.ts            validación de variables con Zod
│  │     ├─ auth.ts           configuración de Better Auth
│  │     ├─ middleware/       sesión, api-token, hmac, rate-limit, errores, request-id
│  │     ├─ modules/<feature>/
│  │     │  ├─ routes.ts      rutas delgadas: validan y delegan
│  │     │  ├─ service.ts     lógica de negocio
│  │     │  └─ repository.ts  acceso a datos (siempre recibe userId)
│  │     └─ jobs/             tareas programadas (recurrentes, purga de capturas)
│  ├─ web/                    Next.js (App Router)
│  └─ mobile/                 Expo con expo-router (development build, no Expo Go)
│     ├─ app/                 rutas
│     ├─ src/features/<feature>/
│     ├─ src/lib/             cliente API, SQLite, sincronización
│     └─ modules/notification-listener/   módulo Expo local en Kotlin
├─ packages/
│  ├─ core/                   dominio puro, sin dependencias de plataforma
│  │  └─ src/
│  │     ├─ money/            parseo, formato y aritmética de montos
│  │     ├─ dates/            zona horaria y periodos
│  │     ├─ schemas/          esquemas Zod compartidos (requests/responses)
│  │     ├─ capture/          parsers, registro, filtro OTP, deduplicación, normalización de comercio
│  │     └─ index.ts
│  ├─ db/                     Drizzle: schema, migraciones, seed, cliente
│  ├─ api-client/             cliente tipado (hono/client) + hooks de TanStack Query
│  └─ config/                 tsconfig base, biome.json compartido
├─ infra/
│  ├─ docker-compose.dev.yml  Postgres local
│  ├─ docker-compose.prod.yml api + web + postgres + caddy
│  ├─ Caddyfile
│  ├─ backup/                 script de pg_dump + rotación
│  └─ email-worker/           Worker de Cloudflare para captura por correo (fase 5)
├─ .github/workflows/ci.yml
├─ docs/
├─ CLAUDE.md
├─ biome.json
├─ pnpm-workspace.yaml
└─ turbo.json
```

Regla de dependencias: `core` no depende de nada del repo. `db` depende de `core`. `api` depende de `core` y `db`. `api-client` depende de `core` y del tipo `AppType` de `api` (solo tipos). `web` y `mobile` dependen de `core` y `api-client`, **nunca** de `db` ni del código de `api`.

## Stack

| Capa | Elección | Motivo |
|---|---|---|
| Lenguaje | TypeScript estricto en todo | Un solo lenguaje, tipos compartidos |
| Monorepo | pnpm workspaces + Turborepo | Caché de tareas, filtros por app |
| Lint/format | Biome | Una sola herramienta, rápida |
| API | Hono sobre Node | Ligero, cliente RPC tipado (`hc`), validación con `@hono/zod-validator` |
| ORM | Drizzle + drizzle-kit | SQL explícito, migraciones versionadas |
| Base de datos | PostgreSQL | Autoalojable, sin límites de plan |
| Auth | Better Auth (+ plugin Expo) | Open source, sesiones en Postgres, soporte móvil |
| Web | Next.js App Router + Tailwind + shadcn/ui | Ecosistema conocido |
| Móvil | Expo (React Native) + expo-router + NativeWind | Un código para Android/iOS, módulos nativos con Expo Modules API |
| Estado servidor | TanStack Query (web y móvil) | Caché, reintentos, invalidación |
| Formularios | react-hook-form + resolver Zod | Mismos esquemas que la API |
| Almacenamiento local móvil | expo-sqlite (outbox y cola), expo-secure-store (sesión) | |
| Notificaciones locales | expo-notifications | Recordatorios de pagos recurrentes sin servidor de push |
| Captura Android | Módulo Expo propio en Kotlin (`NotificationListenerService`) | Control total del filtrado y la persistencia |
| LLM (opcional) | SDK oficial de Anthropic, modelo configurable por env | Extracción cuando ningún parser reconoce el texto |
| Pruebas | Vitest (core, db, api), jest-expo (móvil), Playwright opcional (web) | |
| Logs | pino (JSON estructurado) | |
| Despliegue | Docker Compose + Caddy en servidor propio (Proxmox) | Sin costo de plataforma |

Usar siempre las versiones estables actuales y verificar la documentación oficial de cada una.

## Autenticación

- Better Auth montado en la API en `/api/auth/*`, con adaptador Drizzle sobre Postgres. Correo + contraseña en el MVP.
- **Web**: Next.js hace `rewrites` de `/api/*` hacia la API, de modo que el navegador ve un solo origen y las cookies de sesión son first-party (`HttpOnly`, `Secure`, `SameSite=Lax`).
- **Móvil**: plugin de Expo de Better Auth; la sesión se guarda en `expo-secure-store` y se envía en cada request.
- **Atajos de iOS**: tokens de API personales (tabla `api_tokens`), guardados como hash, con scope `captures:write`.
- **Webhook de correo**: firma HMAC-SHA256 con secreto compartido; el usuario se identifica por la dirección de destino.
- Al registrarse un usuario se crean sus `user_settings` y las categorías por defecto, dentro de una transacción.

## Flujo de captura (resumen; detalle en `04-captura-automatica.md`)

```
Notificación bancaria (Android)
  └─▶ NotificationListenerService (Kotlin)
        ├─ ¿paquete en la lista permitida? no → descartar
        ├─ ¿parece OTP? sí → descartar
        └─ guardar en cola SQLite nativa
              └─▶ JS drena la cola (al abrir la app / evento en primer plano)
                    └─▶ POST /v1/captures/batch (idempotente por contentHash)
                          └─▶ API: parsers → (LLM opcional) → deduplicación
                                └─▶ movimiento `pending` en la bandeja
                                      └─▶ usuario confirma / edita / ignora
```

## Offline en móvil

- **Lecturas**: TanStack Query con caché persistida en el dispositivo; la app abre con los últimos datos conocidos.
- **Escrituras**: los movimientos creados sin red van a una tabla `outbox` en SQLite con su `id` (UUID v7 generado en el cliente). Al recuperar la red se envían en orden; la API es idempotente por `id`, así que reintentar es seguro.
- **Capturas**: la cola la escribe el servicio nativo (funciona aunque JS no esté corriendo). JS la drena y confirma (`ack`) solo después de un 2xx.
- Sincronización en segundo plano con WorkManager queda como mejora futura (requiere manejar la sesión desde nativo).

## Tareas programadas (API)

- **Diaria 06:00 America/Bogota**: crear movimientos `pending` para pagos recurrentes con `autoCreate` que vencen hoy y avanzar `nextDueOn`.
- **Diaria 03:00**: purgar `body` y `title` de capturas procesadas con antigüedad mayor a `captureBodyRetentionDays`.
- Implementación simple dentro del proceso de la API (por ejemplo `node-cron`), con protección para no ejecutarse dos veces si hay varias réplicas (lock con `pg_advisory_lock`).

## Despliegue

- `infra/docker-compose.prod.yml`: `postgres`, `api`, `web`, `caddy` (HTTPS automático). Pensado para una VM o LXC en Proxmox.
- Migraciones con `pnpm db:migrate` como paso previo al arranque de la API.
- Backups: `pg_dump` diario comprimido y cifrado, con rotación (7 diarios, 4 semanales), copiado fuera del host.
- Móvil: build local de release (`expo prebuild` + Gradle) o EAS Build en su plan gratuito. Distribución inicial por APK instalado manualmente.
