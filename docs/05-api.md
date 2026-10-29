# 05 · API

Hono sobre Node. Prefijo `/v1`. JSON en request y response. El tipo `AppType` exportado desde `apps/api/src/app.ts` alimenta el cliente tipado de `packages/api-client`.

## Convenciones

- **Validación**: cada ruta valida `param`, `query` y `json` con `@hono/zod-validator` usando esquemas de `packages/core/src/schemas`.
- **Autenticación**: todo `/v1/*` requiere sesión de Better Auth, excepto `/v1/captures/shortcut` (token de API) y `/v1/captures/email` (HMAC). `/health` es público.
- **Aislamiento**: el `userId` sale solo de la sesión o del token, nunca del body ni de la URL. Acceder a un recurso de otro usuario responde `404`, no `403`.
- **Montos** en JSON como entero `amountMinor` + `currency`. Fechas-hora en ISO 8601 UTC; fechas en `YYYY-MM-DD`.
- **Idempotencia**: `POST /v1/transactions` acepta `id` (UUID v7 del cliente). Crearlo responde `201`; si ya existe para ese usuario con los mismos datos → `200` con el existente; con datos distintos (o si el `id` es de otro usuario) → `409`, sin revelar nada del otro registro. `POST /v1/transfers` sigue la misma regla con su `id`, que se usa como `transferGroupId` de las dos filas.
- **Paginación** por cursor: `?limit=50&cursor=<opaco>` (`limit` por defecto 50, máximo 100); respuesta `{ items, nextCursor }`. Cursor = base64url de `(occurredAt, id)`; orden `occurredAt desc, id desc`.
- **Fechas en filtros**: `from` y `to` son `YYYY-MM-DD` en la zona horaria del usuario (`user_settings.timezone`) y ambos incluyen el día completo.
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
| POST | `/v1/accounts` | `currency` opcional (por defecto la de los ajustes); `creditLimitMinor` solo en `credit_card` (`422` si no) |
| PATCH | `/v1/accounts/:id` | la moneda no se puede cambiar; `422` si la cuenta está archivada; pasar de tarjeta a otro tipo borra el cupo |
| POST | `/v1/accounts/:id/archive` | idempotente |
| POST | `/v1/accounts/:id/adjust-balance` | `{ actualBalanceMinor, occurredAt? }` → movimiento confirmado con la categoría de sistema "Ajuste" (ingreso o gasto según la diferencia). Responde `200 { account, transaction }`; `transaction` es `null` si el saldo ya coincide |

Los nombres de cuenta son únicos entre las cuentas activas del usuario (`409`).

### Categorías
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/v1/categories` | árbol (padres con `children`): gastos primero, las de sistema al final, por nombre; `?includeArchived=true` |
| POST | `/v1/categories` | `parentId` debe ser una categoría activa, de primer nivel, del mismo tipo y no de sistema (`422`) |
| PATCH | `/v1/categories/:id` | `kind` no se puede cambiar; las de sistema solo cambian color e ícono (`422`); una categoría con hijas no puede volverse subcategoría |
| POST | `/v1/categories/:id/archive` | `422` si es de sistema; archiva también sus subcategorías |

### Movimientos
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/v1/transactions` | filtros: `from`, `to`, `accountId`, `categoryId` (incluye sus subcategorías), `type`, `status`, `source`, `q` (comercio/nota, sin distinguir mayúsculas); paginado |
| GET | `/v1/transactions/:id` | |
| POST | `/v1/transactions` | gasto o ingreso manual: siempre `status = confirmed` y `source = manual` (lo pendiente solo llega por captura); la moneda es la de la cuenta; idempotente por `id` |
| PATCH | `/v1/transactions/:id` | en una fila de transferencia solo `amountMinor`, `occurredAt` y `note`, que se aplican a las dos filas (otros campos → `422`) |
| DELETE | `/v1/transactions/:id` | `204`; borrado lógico; en transferencias borra ambas filas |
| POST | `/v1/transactions/:id/confirm` | body opcional con correcciones; actualiza `merchant_rules` |
| POST | `/v1/transfers` | `{ id, fromAccountId, toAccountId, amountMinor, occurredAt, note }` → crea el par (`201 { id, out, in }`); cuentas distintas (`400`) y con la misma moneda (`422`) |

Reglas de movimientos: la categoría debe ser del mismo tipo que el movimiento (gasto o ingreso) y estar activa; la cuenta debe estar activa (`422`). Una cuenta o categoría de otro usuario responde `404`.

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
| GET | `/v1/budgets` | `?includeArchived=true` |
| POST / PATCH | `/v1/budgets`, `/v1/budgets/:id` | `{ categoryId, amountMinor, currency?, startsOn? }`: categoría de gasto activa (`422`), una activa por categoría (`409`); `startsOn` (por defecto el mes actual) se guarda como día 1. PATCH solo cambia monto y `startsOn` |
| POST | `/v1/budgets/:id/archive` | |
| GET | `/v1/budgets/summary?month=YYYY-MM` | por presupuesto vigente ese mes: monto, gastado (confirmados de la categoría y sus subcategorías, sin transferencias ni pendientes), restante (negativo si se pasó) y porcentaje entero (puede pasar de 100) |

### Pagos recurrentes
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/v1/recurring` | activos primero, por próximo vencimiento |
| POST / PATCH | `/v1/recurring`, `/v1/recurring/:id` | POST `{ name, frequency, firstDueOn, amountMinor?, accountId?, categoryId?, currency?, remindDaysBefore?, autoCreate? }`. La moneda es la de la cuenta si hay. `autoCreate` exige monto (`400`/`422`). PATCH acepta `nextDueOn` y `active` (pausar); cambiar `nextDueOn` o la frecuencia reinicia el ancla |
| GET | `/v1/recurring/upcoming?days=30` | vencimientos de los pagos activos desde su próximo vencimiento (incluye vencidos) hasta `days` días desde hoy (máx. 90), con `remindOn`. La app programa notificaciones locales con esto |
| POST | `/v1/recurring/:id/pay` | `{ amountMinor?, accountId?, occurredAt? }` (monto obligatorio si es variable; cuenta obligatoria si el pago no tiene). Si el proceso diario ya creó el pendiente del vencimiento, lo confirma; si no, crea un gasto confirmado (`source = recurring`) y avanza `nextDueOn`. `422` si está pausado. Responde `{ recurringPayment, transaction }` |

### Reportes y exportación
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/v1/reports/monthly?month=YYYY-MM` | ingresos, gastos y neto por moneda; por categoría (agrupado en la categoría principal; `categoryId: null` = sin categoría); por cuenta. Mes en la zona del usuario. Existe desde la fase 1 porque lo usa Inicio |
| GET | `/v1/reports/trend?months=6` | ingresos, gastos y neto por mes local y moneda (1 a 24 meses, el actual al final; meses sin datos incluidos) |
| GET | `/v1/export/transactions.csv?from&to` | CSV en UTF-8 con BOM (abre bien en Excel), separador `;`, fin de línea CRLF. Columnas: Fecha (hora local), Tipo, Estado, Cuenta, Categoría (`Padre / Hija`), Comercio, Nota, Monto, Moneda. Monto con signo y coma decimal sin separador de miles (`-45900`, `4200000,50`). Excluye borrados. Los textos que una hoja de cálculo tomaría como fórmula (`=`, `+`, `-`, `@`) se prefijan con `'` |

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
