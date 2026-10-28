# 05 · API

Hono sobre Node. Prefijo `/v1`. JSON en request y response. El tipo `AppType` exportado desde `apps/api/src/app.ts` alimenta el cliente tipado de `packages/api-client`.

## Convenciones

- **Validación**: cada ruta valida `param`, `query` y `json` con `@hono/zod-validator` usando esquemas de `packages/core/src/schemas`.
- **Autenticación**: todo `/v1/*` requiere sesión de Better Auth, excepto `/v1/captures/shortcut` (token de API) y `/v1/captures/email` (HMAC). `/health` es público.
- **Aislamiento**: el `userId` sale solo de la sesión o del token, nunca del body ni de la URL. Acceder a un recurso de otro usuario responde `404`, no `403`.
- **Montos** en JSON como entero `amountMinor` + `currency`. Fechas-hora en ISO 8601 UTC; fechas en `YYYY-MM-DD`.
- **Idempotencia**: `POST /v1/transactions` acepta `id` (UUID v7 del cliente). Si ya existe para ese usuario con los mismos datos → `200` con el existente; con datos distintos → `409`.
- **Paginación** por cursor: `?limit=50&cursor=<opaco>`; respuesta `{ items, nextCursor }`. Cursor = base64 de `(occurredAt, id)`.
- **Borrado** lógico donde exista `deleted_at`; `archived_at` para cuentas, categorías y presupuestos.
- **Errores** con forma única:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Texto para humanos", "details": {} } }
```

| HTTP | code |
|---|---|
| 400 | `VALIDATION_ERROR` |
| 401 | `UNAUTHENTICATED` |
| 403 | `FORBIDDEN` (scope de token insuficiente) |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT` |
| 422 | `BUSINESS_RULE` (ej. eliminar categoría de sistema, monedas distintas en transferencia) |
| 429 | `RATE_LIMITED` |
| 500 | `INTERNAL` (sin detalles internos) |

- Cabeceras de seguridad (`hono/secure-headers`), CORS solo para el origen web configurado, `x-request-id` en cada respuesta.
- Rate limit: auth (10/min por IP), capturas (120/min por usuario), LLM (límite diario por usuario).

## Endpoints

### Sistema
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | `{ status, db }` |
| * | `/api/auth/*` | Better Auth |

### Ajustes
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/v1/settings` | |
| PATCH | `/v1/settings` | moneda, zona horaria, LLM on/off, retención |

### Cuentas
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/v1/accounts` | incluye `balanceMinor` calculado; `?includeArchived=true` |
| POST | `/v1/accounts` | |
| PATCH | `/v1/accounts/:id` | |
| POST | `/v1/accounts/:id/archive` | |
| POST | `/v1/accounts/:id/adjust-balance` | `{ actualBalanceMinor }` → crea movimiento de ajuste confirmado |

### Categorías
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/v1/categories` | árbol (padres con `children`) |
| POST | `/v1/categories` | |
| PATCH | `/v1/categories/:id` | |
| POST | `/v1/categories/:id/archive` | `422` si es de sistema |

### Movimientos
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/v1/transactions` | filtros: `from`, `to`, `accountId`, `categoryId`, `type`, `status`, `source`, `q` (comercio/nota); paginado |
| GET | `/v1/transactions/:id` | |
| POST | `/v1/transactions` | gasto o ingreso; idempotente por `id` |
| PATCH | `/v1/transactions/:id` | |
| DELETE | `/v1/transactions/:id` | borrado lógico; en transferencias borra ambas filas |
| POST | `/v1/transactions/:id/confirm` | body opcional con correcciones; actualiza `merchant_rules` |
| POST | `/v1/transfers` | `{ id, fromAccountId, toAccountId, amountMinor, occurredAt, note }` → crea el par |

### Bandeja y capturas
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/v1/inbox` | movimientos `pending` + capturas `failed` recientes, con datos de la captura asociada |
| POST | `/v1/captures/batch` | desde Android: `{ deviceId, items: [{ localId, sourceApp, title, body, receivedAt }] }` (máx. 50) → `{ results: [{ localId, status: 'accepted' \| 'duplicate_upload' \| 'rejected' }] }` |
| GET | `/v1/captures` | filtros `status`, `source`; paginado |
| POST | `/v1/captures/:id/reprocess` | |
| POST | `/v1/captures/:id/ignore` | marca `ignored` y borra el movimiento `pending` asociado si existe |
| POST | `/v1/captures/shortcut` | token de API con `captures:write` |
| POST | `/v1/captures/email` | firma HMAC en `x-bolsillo-signature`; destinatario identifica al usuario |

### Fuentes de captura
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/v1/capture-sources` | |
| PUT | `/v1/capture-sources` | reemplaza la lista completa (la app Android la sincroniza) |
| PATCH | `/v1/capture-sources/:id` | cuenta por defecto, enabled |

### Presupuestos
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/v1/budgets` | |
| POST / PATCH | `/v1/budgets`, `/v1/budgets/:id` | |
| POST | `/v1/budgets/:id/archive` | |
| GET | `/v1/budgets/summary?month=YYYY-MM` | por presupuesto: monto, gastado, restante, porcentaje |

### Pagos recurrentes
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/v1/recurring` | |
| POST / PATCH | `/v1/recurring`, `/v1/recurring/:id` | |
| GET | `/v1/recurring/upcoming?days=30` | próximos vencimientos (la app programa notificaciones locales con esto) |
| POST | `/v1/recurring/:id/pay` | registra el pago (crea movimiento confirmado) y avanza `nextDueOn` |

### Reportes y exportación
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/v1/reports/monthly?month=YYYY-MM` | ingresos, gastos, neto, por categoría, por cuenta |
| GET | `/v1/reports/trend?months=6` | ingresos y gastos por mes |
| GET | `/v1/export/transactions.csv?from&to` | CSV en UTF-8 con BOM (abre bien en Excel), separador `;` |

### Tokens de API
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/v1/api-tokens` | sin el token, solo prefijo |
| POST | `/v1/api-tokens` | devuelve el token en claro una sola vez |
| DELETE | `/v1/api-tokens/:id` | revoca |

## Pruebas de la API

- Integración contra Postgres real (base de datos de test en el compose de desarrollo o Testcontainers), migraciones aplicadas al iniciar la suite y limpieza entre tests.
- Por cada recurso: caso feliz, validación, `404` para recurso de otro usuario, y reglas de negocio.
- Helper de test para crear usuario autenticado y obtener su sesión.
