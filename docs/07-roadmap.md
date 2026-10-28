# 07 · Roadmap

Reglas:
- Una fase a la vez. Antes de empezar: plan corto y aprobación del usuario.
- Una fase está terminada solo cuando **todos** sus criterios de aceptación se cumplen y `pnpm lint && pnpm typecheck && pnpm test` pasan en local y en CI.
- Al terminar: resumen de lo hecho, cómo probarlo a mano, y detenerse.

---

## Fase 0 · Fundaciones

**Tareas**
1. Monorepo con pnpm workspaces y Turborepo; scope `@bolsillo/*`.
2. `packages/config`: tsconfig base estricto, `biome.json`, tokens de diseño iniciales.
3. `infra/docker-compose.dev.yml` con Postgres (base `bolsillo` y `bolsillo_test`).
4. `packages/core`: módulo `money` (`currencies`, `parseAmount`, `formatAmount`, `toMinor`, `fromMinor`, suma segura por moneda) y `dates` (inicio/fin de mes en zona del usuario) con tests.
5. `packages/db`: Drizzle configurado, cliente, scripts `db:generate`, `db:migrate`, `db:seed` (seed vacío por ahora).
6. `apps/api`: Hono con `env.ts` validado, logger pino, middleware de errores y request id, `GET /health` que verifica la base.
7. `apps/web`: Next.js con Tailwind y shadcn/ui inicializados; página que muestra el estado de `/health` vía rewrite.
8. `apps/mobile`: Expo con expo-router y NativeWind, configurado para development build; pantalla que muestra el estado de `/health`.
9. `packages/api-client`: cliente `hc<AppType>` y `QueryClient` compartido.
10. Scripts raíz con los nombres exactos de `CLAUDE.md`. `.env.example` por app.
11. GitHub Actions: lint, typecheck, test (con servicio Postgres), build.

**Criterios de aceptación**
- [ ] `pnpm install && pnpm dev` levanta api, web y mobile sin errores.
- [ ] `/health` responde `{ status: "ok", db: "ok" }` y web y móvil lo muestran.
- [ ] `parseAmount` pasa casos: `$45.900`, `$45.900,50`, `$45,900.50`, `COP 45900`, `$ 1.234.567`, `45.900,00 COP`, entradas inválidas → error tipado.
- [ ] La API no arranca si falta una variable de entorno obligatoria.
- [ ] CI en verde.

---

## Fase 1 · Autenticación y núcleo financiero

**Tareas**
1. Better Auth en la API (correo + contraseña); rewrites en web; plugin Expo + SecureStore en móvil.
2. Esquema: `user_settings`, `financial_accounts`, `categories`, `transactions` con índices y restricciones de `03-modelo-de-datos.md`.
3. Al registrarse: settings y categorías por defecto en una transacción.
4. Endpoints de ajustes, cuentas (con saldo calculado y ajuste de saldo), categorías, movimientos (CRUD, filtros, paginación, idempotencia), transferencias y `reports/monthly` (lo necesita Inicio; se adelantó desde la fase 2).
5. Hooks de TanStack Query en `api-client` para todo lo anterior.
6. Móvil y web: login/registro, Inicio (resumen del mes, gasto por categoría, saldos), Movimientos (lista por día, filtros, búsqueda), Nuevo/editar movimiento, Transferencia, Cuentas, Categorías.
7. Móvil: outbox en SQLite para crear movimientos sin red.
8. Seed de desarrollo completo (ver `03-modelo-de-datos.md`, sin capturas aún).

**Criterios de aceptación**
- [ ] Test: el usuario A recibe `404` al leer, editar o borrar cualquier recurso del usuario B.
- [ ] Una transferencia crea dos filas enlazadas; borrarla elimina ambas; los saldos de las dos cuentas son correctos y no aparece en reportes de gasto.
- [ ] Reenviar `POST /v1/transactions` con el mismo `id` no duplica.
- [ ] Crear un movimiento en modo avión en el móvil y recuperar red lo sincroniza una sola vez.
- [ ] Montos se muestran en formato `es-CO` en web y móvil.
- [ ] Registrar un gasto manual en móvil toma 3 toques después de escribir el monto (monto → categoría → guardar).

---

## Fase 2 · Presupuestos, recurrentes y reportes

**Tareas**
1. Esquema y endpoints de `budgets` (con `summary`) y `recurring_payments` (con `upcoming` y `pay`).
2. Job diario de recurrentes con `auto_create` y lock con `pg_advisory_lock`.
3. Móvil: programar notificaciones locales con `expo-notifications` a partir de `upcoming`; reprogramar al cambiar datos.
4. Reporte `trend` (`monthly` existe desde la fase 1); pantallas de reportes en web y móvil con gráficos simples.
5. Exportación CSV.

**Criterios de aceptación**
- [ ] El progreso del presupuesto incluye subcategorías y excluye pendientes y transferencias.
- [ ] Un pago recurrente mensual del día 31 avanza correctamente en meses de 30 días y febrero (usa el último día del mes).
- [ ] El job no crea duplicados si corre dos veces el mismo día.
- [ ] El CSV abre en Excel con tildes y montos correctos.

---

## Fase 3 · Captura en Android

> Antes de empezar: pedir al usuario la lista de bancos y billeteras que usa y muestras reales anonimizadas de sus notificaciones. Si aún no las tiene, avanzar con fixtures `fake: true`.

**Tareas**
1. `core/capture`: tipos, `isLikelyTransaction`, filtro OTP y enmascarado, `normalizeMerchant`, función de deduplicación, registro de parsers, test genérico de fixtures.
2. Esqueleto de parsers para los bancos del usuario (por defecto Bancolombia y Nequi).
3. Esquema: `raw_captures`, `capture_sources`, `merchant_rules`.
4. API: `captures/batch`, `inbox`, `captures` (lista, reprocess, ignore), `capture-sources`, `transactions/:id/confirm`; pipeline completo en transacción; job de purga.
5. Módulo Expo `notification-listener` en Kotlin + config plugin, con la API de `04-captura-automatica.md`, tabla `capture_queue`, filtro OTP portado y tests JUnit.
6. Sincronización de la cola en móvil (drain → batch → ack).
7. Pantallas: Ajustes → Captura (onboarding del permiso, ajustes restringidos, batería, selector de apps y cuenta por defecto) y Pendientes (confirmar, editar, ignorar, "¿es el mismo que…?").
8. Pantalla de depuración solo en desarrollo que usa `debugInjectCapture`.
9. Bandeja de pendientes también en web.

**Criterios de aceptación**
- [ ] Con `debugInjectCapture` y red, la captura aparece como pendiente en menos de 5 segundos con monto, comercio y cuenta correctos.
- [ ] Una captura hecha sin red se sincroniza al volver la red y no se duplica aunque el `ack` falle y se reenvíe.
- [ ] Un texto con código OTP nunca llega a la cola nativa ni a la base (tests en Kotlin y en TS).
- [ ] Movimiento manual de $45.900 a las 10:00 + notificación del mismo monto a las 10:05 → la captura queda `duplicate` enlazada; no aparece un segundo movimiento.
- [ ] Dos compras iguales seguidas notificadas por la misma app generan dos pendientes.
- [ ] Al confirmar un pendiente con comercio y categoría, el siguiente del mismo comercio llega con la categoría precargada.
- [ ] Una notificación promocional del banco queda `ignored`, no `failed`.
- [ ] Capturas procesadas con más días que la retención quedan sin `title` ni `body`.

---

## Fase 4 · Extracción con LLM

**Tareas**
1. Ajuste `llmExtractionEnabled` en la UI, apagado por defecto, con explicación de qué se envía.
2. `llm-extractor` en la API según `04-captura-automatica.md`: salida JSON validada, caché por hash, límite diario, confianza máxima 0.7.
3. Sugerencia de categoría a partir de la lista del usuario.
4. Marcado visual "revisar" en pendientes extraídos por LLM.

**Criterios de aceptación**
- [ ] Sin `ANTHROPIC_API_KEY` o con el ajuste apagado, nunca se llama al SDK.
- [ ] Respuesta inválida del modelo → captura `failed`, sin excepción no controlada.
- [ ] Al superar el límite diario, las capturas restantes quedan `failed` con motivo y se pueden reprocesar luego.
- [ ] Tests con SDK simulado cubren éxito, JSON inválido, timeout y límite.

---

## Fase 5 · Correo y Atajos de iOS

**Tareas**
1. Dirección de captura por usuario y pantalla con instrucciones para crear el filtro de reenvío.
2. `infra/email-worker`: Worker de Cloudflare que firma con HMAC y llama a `/v1/captures/email`; detecta el correo de confirmación de reenvío de Gmail.
3. Endpoint de correo con verificación HMAC y parsers de correo para los bancos del usuario.
4. Tokens de API (endpoints y pantalla) y endpoint `captures/shortcut` con parser `ios-shortcut.v1`.
5. Guía en la app para configurar el Atajo de iOS.

**Criterios de aceptación**
- [ ] Firma HMAC inválida → `401` y nada se guarda.
- [ ] El mismo pago recibido por notificación y por correo produce un solo movimiento.
- [ ] Un token revocado deja de funcionar inmediatamente; un token sin scope `captures:write` recibe `403`.

---

## Fase 6 · Producción

**Tareas**
1. `docker-compose.prod.yml` con api, web, postgres y Caddy; Dockerfiles multi-stage.
2. Script de backup con rotación y prueba documentada de restauración.
3. Build de release del APK firmado y guía de instalación (incluye ajustes restringidos).
4. Revisión de seguridad con la lista de `06-convenciones.md`; rate limits verificados.
5. `docs/despliegue.md` con el paso a paso.

**Criterios de aceptación**
- [ ] Despliegue desde cero en un servidor limpio siguiendo solo `docs/despliegue.md`.
- [ ] Restaurar un backup en una base vacía deja la app funcionando.
- [ ] El APK de release instalado captura notificaciones tras el onboarding.
