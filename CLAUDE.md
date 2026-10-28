# Bolsillo — app de finanzas personales

Monorepo TypeScript con app móvil (Expo / React Native), app web (Next.js), API (Hono sobre Node) y PostgreSQL.
El diferencial del producto es la **captura automática de movimientos**: notificaciones bancarias en Android, correos del banco y Atajos de iOS. El usuario siempre confirma lo capturado.

> "Bolsillo" es un nombre provisional. Si cambia, se reemplaza el scope `@bolsillo/*` en todo el repo.

## Documentación — léela antes de tocar cada área

| Archivo | Contenido |
|---|---|
| `docs/01-producto.md` | Qué hace la app, pantallas, alcance del MVP y lo que queda fuera |
| `docs/02-arquitectura.md` | Estructura del monorepo, stack, flujos, autenticación, despliegue |
| `docs/03-modelo-de-datos.md` | Tablas, enums, índices y reglas del dinero |
| `docs/04-captura-automatica.md` | Lector de notificaciones Android, parsers, deduplicación, LLM, correo, iOS |
| `docs/05-api.md` | Contrato y convenciones de la API |
| `docs/06-convenciones.md` | Estilo de código, pruebas, seguridad, git, variables de entorno |
| `docs/07-roadmap.md` | Fases con tareas y criterios de aceptación. **Se trabaja una fase a la vez.** |

## Reglas no negociables

1. **Dinero como entero en unidades menores** (`amountMinor`), nunca `float` ni `number` con decimales. Toda conversión y formato pasa por `packages/core/src/money`.
2. **Aislamiento por usuario**: toda función de repositorio recibe `userId` y filtra por él. Ningún endpoint devuelve ni modifica datos de otro usuario. Hay tests que lo comprueban.
3. **Validación con Zod en todos los bordes**: requests, variables de entorno, respuestas del LLM, datos capturados. Los esquemas compartidos viven en `packages/core`.
4. **Secretos solo en `apps/api`** (API key de Anthropic, credenciales de base de datos, secretos de webhooks). Nunca en `apps/mobile` ni `apps/web`.
5. **No inventar formatos reales de notificaciones o correos bancarios.** Los fixtures inventados llevan `fake: true`. Los reales los aporta el usuario, anonimizados.
6. **Códigos OTP y claves dinámicas se descartan** en cuanto se detectan: no se guardan, no se loguean, no se envían al LLM.
7. **Nunca loguear** texto de notificaciones o correos, montos ni comercios en producción.
8. Fechas en UTC (`timestamptz`), mostradas en `America/Bogota`. Moneda por defecto `COP`, formato `es-CO`.
9. Código, identificadores y commits en **inglés**. Textos de la interfaz en **español**.
10. Ninguna captura se convierte en movimiento confirmado sin acción del usuario (salvo deduplicación contra uno ya existente).

## Comandos (se crean en la Fase 0 con estos nombres exactos)

```bash
pnpm install
docker compose -f infra/docker-compose.dev.yml up -d   # Postgres local
pnpm dev                       # todas las apps
pnpm dev --filter @bolsillo/api   # una sola app (api | web | mobile)
pnpm lint                      # Biome
pnpm typecheck
pnpm test                      # Vitest (y jest-expo en mobile)
pnpm db:generate               # genera migración Drizzle
pnpm db:migrate
pnpm db:seed
```

## Forma de trabajo

- Antes de cada fase: lee la fase en `docs/07-roadmap.md`, propone un plan corto (archivos y pasos) y espera aprobación.
- Al terminar cada tarea: `pnpm lint && pnpm typecheck && pnpm test` deben pasar.
- Commits pequeños y atómicos con Conventional Commits (`feat(api): ...`, `fix(mobile): ...`).
- Usa las versiones estables actuales de cada librería y consulta su documentación oficial; no asumas APIs de memoria.
- Si una decisión de estos documentos no se puede cumplir, es ambigua o existe una alternativa claramente mejor, **pregunta antes de desviarte** y, si se aprueba, actualiza el documento correspondiente en el mismo commit.
- Al cerrar una fase: verifica cada criterio de aceptación, explica cómo probarlo manualmente y **detente**.
