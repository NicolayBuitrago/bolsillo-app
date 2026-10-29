# 06 · Convenciones

## TypeScript

- `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`, `exactOptionalPropertyTypes: true` en el tsconfig base de `packages/config`.
- Prohibido `any` (Biome lo marca); usar `unknown` y validar.
- Tipos derivados de esquemas Zod (`z.infer`) en vez de duplicarlos a mano.
- Errores de dominio como clases (`NotFoundError`, `BusinessRuleError`, ...) que el middleware de errores traduce a la forma de `05-api.md`.
- Funciones puras siempre que se pueda en `core`; sin efectos secundarios ni acceso a red o disco.

## Organización

- **API**: por módulo (`modules/<feature>/routes|service|repository`). Las rutas no tocan la base; los repositorios no tienen lógica de negocio; los servicios no conocen Hono.
- **Móvil**: `app/` solo define rutas y compone pantallas; la lógica vive en `src/features/<feature>` (componentes, hooks, utilidades de esa función).
- **Web**: App Router; mismo criterio de `features/`. Componentes de cliente usando los hooks de `api-client`.
- Nombres de archivos en `kebab-case`; componentes React en `PascalCase`.
- Textos de la interfaz centralizados por función (`features/<feature>/strings.ts`) para facilitar traducción futura.

## UI y UX

- Web: Tailwind + shadcn/ui. Móvil: NativeWind. Paleta, radios y espaciado definidos como tokens compartidos en `packages/config`.
- Modo claro y oscuro desde el inicio.
- Montos con fuente tabular; gastos e ingresos se distinguen por signo y texto, no solo por color.
- Registro manual: teclado numérico propio en móvil, foco inicial en el monto, guardar en un toque.
- Estados vacíos, de carga y de error en cada pantalla. Feedback háptico al confirmar en móvil.
- Accesibilidad: etiquetas en botones de solo icono, contraste AA, tamaños táctiles mínimos de 44 px.

## Pruebas

| Paquete | Herramienta | Qué |
|---|---|---|
| `core` | Vitest | money, dates, parsers (todos los fixtures), filtro OTP, normalización de comercio, dedup. Cobertura ≥ 90 % |
| `db` | Vitest | migraciones aplican desde cero; seed corre |
| `api` | Vitest + Postgres real | integración por endpoint, aislamiento entre usuarios, pipeline de captura completo. Servicios ≥ 80 % |
| `mobile` | jest-expo | lógica de sincronización (outbox y cola) con el módulo nativo simulado |
| Kotlin | JUnit | filtro OTP con los mismos casos que `core` |
| `web` | Playwright (opcional) | humo: login, crear movimiento, ver inicio |

Los tests no llaman a servicios externos reales (Anthropic, Cloudflare): se simulan.

## Seguridad

- Contraseñas y sesiones: las maneja Better Auth; no reimplementar.
- Toda función de repositorio exige `userId` en su firma.
- Variables de entorno validadas con Zod al arrancar; el proceso falla si falta alguna.
- Tokens de API y secretos de webhook se comparan en tiempo constante.
- Logs con pino: `requestId`, ruta, estado, duración, `userId`. **Nunca** cuerpos de request, textos de capturas, montos ni comercios.
- Dependencias: `pnpm audit` en CI (aviso, no bloqueo, en altas solo se revisan).
- HTTPS obligatorio fuera de desarrollo. Cookies `Secure`, `HttpOnly`.
- Datos de captura: retención limitada (ver `03-modelo-de-datos.md`), enmascarado de números largos.

## Git y CI

- Rama `main` protegida; ramas `feat/...`, `fix/...`, `chore/...`.
- Conventional Commits con scope de paquete: `feat(core): add parseAmount`, `fix(mobile): ...`.
- GitHub Actions en cada push y PR: `pnpm install --frozen-lockfile`, `lint`, `typecheck`, `test` (con servicio Postgres), `build` de api y web.
- Las migraciones se generan con `pnpm db:generate` y se commitean; nunca editar una migración ya aplicada.

## Variables de entorno

Cada app tiene su `.env.example` con todas las variables documentadas.

### `apps/api`
| Variable | Descripción |
|---|---|
| `NODE_ENV` | `development` \| `test` \| `production` |
| `PORT` | puerto HTTP |
| `DATABASE_URL` | conexión Postgres |
| `BETTER_AUTH_SECRET` | secreto de sesiones |
| `BETTER_AUTH_URL` | URL pública de la API |
| `WEB_ORIGIN` | origen permitido por CORS |
| `ANTHROPIC_API_KEY` | opcional; sin ella el extractor LLM queda desactivado |
| `ANTHROPIC_MODEL` | modelo para extracción |
| `LLM_DAILY_LIMIT_PER_USER` | default 50 |
| `EMAIL_WEBHOOK_SECRET` | HMAC del Worker de correo |
| `EMAIL_CAPTURE_DOMAIN` | dominio de direcciones de captura |
| `DEDUP_WINDOW_MINUTES` | default 15 |
| `LOG_LEVEL` | default `info` |
| `JOBS_ENABLED` | default `true`; tareas programadas dentro de la API (pagos recurrentes) |

### `apps/web`
| Variable | Descripción |
|---|---|
| `API_INTERNAL_URL` | destino de los rewrites `/api/*` |

### `apps/mobile`
| Variable | Descripción |
|---|---|
| `EXPO_PUBLIC_API_URL` | URL de la API (es pública por diseño; no poner secretos con prefijo `EXPO_PUBLIC_`) |

## Documentación viva

- Si un cambio contradice estos documentos, se actualiza el documento en el mismo commit.
- Decisiones técnicas relevantes se registran como ADR breve en `docs/adr/NNNN-titulo.md` (contexto, decisión, consecuencias).
