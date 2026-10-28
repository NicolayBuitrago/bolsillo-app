# 03 · Modelo de datos

PostgreSQL con Drizzle. Convenciones:

- Nombres de tablas y columnas en `snake_case` en la base; en TypeScript `camelCase` (configurar el casing de Drizzle).
- Llaves primarias `uuid`. Los registros que puede crear el cliente (movimientos) usan **UUID v7 generado en el cliente** para idempotencia; el resto puede generarse en servidor (también v7).
- Toda tabla de dominio tiene `user_id uuid not null` con FK a `user` y `on delete cascade`, más `created_at` y `updated_at` (`timestamptz`, default `now()`).
- Fechas-hora en `timestamptz` (UTC). Fechas sin hora (vencimientos, inicio de presupuesto) en `date`, interpretadas en la zona del usuario.
- Enums de Postgres para los campos con valores cerrados.

> Better Auth crea sus propias tablas (`user`, `session`, `account`, `verification`). Por eso la tabla de cuentas financieras se llama **`financial_accounts`**, para no chocar con `account` de Better Auth.

## Reglas del dinero

- Todo monto se guarda como **entero en unidades menores**: columna `bigint` con sufijo `_minor`. En TypeScript se maneja como `number` validando `Number.isSafeInteger`.
- El exponente de cada moneda sale de una tabla en `packages/core/src/money/currencies.ts` (ISO 4217): `COP` = 2, `USD` = 2. Ej.: $45.900 COP → `4590000`.
- Los montos de movimientos son **siempre positivos**; el signo lo da `type`.
- Parseo de texto a monto (`parseAmount`) debe soportar los formatos que aparecen en Colombia: `$45.900`, `$45.900,50`, `$45,900.50`, `COP 45900`, `45.900,00 COP`, `$ 1.234.567`. Regla de desambiguación: si hay un solo separador seguido de exactamente 3 dígitos al final, es separador de miles; si va seguido de 1–2 dígitos, es decimal. Con tests de casos borde.
- Formato para mostrar: `Intl.NumberFormat('es-CO', { style: 'currency', currency })`, ocultando decimales cuando son cero en COP.
- Nunca sumar montos de monedas distintas.

## Enums

| Enum | Valores |
|---|---|
| `account_type` | `bank`, `credit_card`, `cash`, `digital_wallet`, `savings`, `other` |
| `category_kind` | `expense`, `income` |
| `transaction_type` | `expense`, `income`, `transfer_out`, `transfer_in` |
| `transaction_status` | `pending`, `confirmed` |
| `transaction_source` | `manual`, `notification`, `email`, `shortcut`, `recurring`, `import` |
| `capture_source` | `notification`, `email`, `shortcut` |
| `capture_status` | `received`, `parsed`, `duplicate`, `ignored`, `failed` |
| `recurrence_frequency` | `weekly`, `biweekly`, `monthly`, `yearly` |

## Tablas

### `user_settings`
| Columna | Tipo | Notas |
|---|---|---|
| user_id | uuid PK, FK user | |
| default_currency | char(3) | default `'COP'` |
| timezone | text | default `'America/Bogota'` |
| llm_extraction_enabled | boolean | default `false` |
| capture_body_retention_days | int | default `90` |
| email_capture_address_token | text unique null | parte local aleatoria de su dirección de captura (fase 5) |

### `financial_accounts`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | |
| name | text | |
| type | account_type | |
| institution | text null | ej. "Bancolombia" |
| last4 | char(4) null | para asociar capturas que mencionan los últimos 4 dígitos |
| currency | char(3) | default `'COP'` |
| initial_balance_minor | bigint | default 0 |
| credit_limit_minor | bigint null | solo tarjetas de crédito |
| color, icon | text null | |
| archived_at | timestamptz null | |

Índice: `(user_id)`. Único parcial: `(user_id, name)` donde `archived_at is null`.

### `categories`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | |
| parent_id | uuid null FK categories | un solo nivel de anidación |
| name | text | |
| kind | category_kind | |
| is_system | boolean | default false; "Ajuste" es de sistema y no se puede borrar |
| color, icon | text null | |
| archived_at | timestamptz null | |

Categorías por defecto al registrarse:
- Gasto: Alimentación (Mercado, Restaurantes, Domicilios), Transporte (Gasolina, Transporte público, Taxi/apps, Mantenimiento vehículo), Vivienda (Arriendo, Administración), Servicios (Energía, Agua, Gas, Internet, Celular), Salud, Entretenimiento, Suscripciones, Compras, Educación, Mascotas, Regalos, Impuestos, Comisiones bancarias, Otros gastos.
- Ingreso: Salario, Freelance, Reembolsos, Intereses, Otros ingresos.
- Sistema: Ajuste (gasto e ingreso).

### `transactions`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | UUID v7 del cliente |
| user_id | uuid | |
| account_id | uuid null FK financial_accounts | puede ser null solo si `status = pending` |
| category_id | uuid null FK categories | null permitido (sin categoría) |
| type | transaction_type | |
| status | transaction_status | |
| source | transaction_source | |
| amount_minor | bigint | `check (amount_minor > 0)` |
| currency | char(3) | igual a la de la cuenta cuando hay cuenta |
| occurred_at | timestamptz | |
| merchant | text null | tal como aparece |
| merchant_normalized | text null | minúsculas, sin tildes, sin números de referencia; para reglas |
| note | text null | |
| capture_id | uuid null FK raw_captures | |
| transfer_group_id | uuid null | enlaza `transfer_out` y `transfer_in` |
| recurring_payment_id | uuid null FK recurring_payments | |
| confirmed_at | timestamptz null | |
| deleted_at | timestamptz null | borrado lógico |

Índices: `(user_id, occurred_at desc, id desc)` para paginación, `(user_id, account_id, occurred_at)`, `(user_id, status)` parcial donde `status = 'pending'`, `(user_id, amount_minor, occurred_at)` para deduplicación.

Restricciones: una transferencia son exactamente dos filas con el mismo `transfer_group_id`, una `transfer_out` y una `transfer_in`, mismo monto y moneda, cuentas distintas. Se crean y eliminan juntas en una transacción de base de datos.

Restricciones en la base (fase 1):
- `check (amount_minor > 0)`, `check (account_id is not null or status = 'pending')` y `check ((transfer_group_id is not null) = (type in ('transfer_out', 'transfer_in')))`.
- Único parcial `(transfer_group_id, type)` donde `transfer_group_id is not null`: como mucho una fila de cada lado por transferencia.
- Llaves foráneas compuestas `(user_id, account_id) → financial_accounts (user_id, id)` y `(user_id, category_id) → categories (user_id, id)` (y `(user_id, parent_id)` en `categories`): la propia base impide enlazar datos de otro usuario.
- `capture_id` y `recurring_payment_id` se agregan junto con sus tablas (fases 3 y 2).

### `raw_captures`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | |
| source | capture_source | |
| source_app | text | paquete Android, remitente del correo o `ios-shortcut` |
| title | text null | se purga tras la retención |
| body | text null | se purga tras la retención |
| structured | jsonb null | datos ya estructurados (Atajos de iOS) |
| received_at | timestamptz | hora en que el dispositivo recibió la notificación |
| device_id | text null | |
| content_hash | text | sha256 de `source_app + title + body + received_at redondeado al minuto` |
| status | capture_status | |
| parser_id | text null | qué parser la procesó (`bancolombia.purchase.v1`, `llm`, ...) |
| parsed | jsonb null | resultado validado del parser |
| error | text null | sin datos sensibles |
| transaction_id | uuid null FK transactions | movimiento creado o enlazado |

Único: `(user_id, content_hash)` → subir la misma captura dos veces no duplica.

### `capture_sources`
Apps o remitentes que el usuario decidió escuchar.

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | |
| source | capture_source | |
| identifier | text | paquete Android o correo remitente |
| label | text | nombre visible ("Bancolombia") |
| default_account_id | uuid null | cuenta a la que se asignan sus capturas si no hay mejor coincidencia |
| enabled | boolean | default true |

Único: `(user_id, source, identifier)`.

### `merchant_rules`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | |
| merchant_normalized | text | |
| category_id | uuid FK categories | |
| account_id | uuid null | |
| hits | int | default 1 |

Único: `(user_id, merchant_normalized)`. Se hace upsert al confirmar un movimiento capturado con comercio y categoría.

### `budgets`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | |
| category_id | uuid FK categories | incluye subcategorías al calcular |
| amount_minor | bigint | > 0 |
| currency | char(3) | |
| starts_on | date | primer mes de vigencia |
| archived_at | timestamptz null | |

Único parcial: `(user_id, category_id)` donde `archived_at is null`. Periodo mensual fijo en el MVP.

### `recurring_payments`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | |
| name | text | "Arriendo", "Netflix" |
| account_id | uuid null | |
| category_id | uuid null | |
| amount_minor | bigint null | null = monto variable |
| currency | char(3) | |
| frequency | recurrence_frequency | |
| next_due_on | date | |
| remind_days_before | int | default 2 |
| auto_create | boolean | default false: crea un movimiento `pending` el día del vencimiento |
| active | boolean | default true |

### `api_tokens`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | |
| name | text | "Atajo iPhone" |
| token_hash | text unique | sha256 del token; el token en claro se muestra una sola vez |
| token_prefix | text | primeros 8 caracteres para identificarlo en la UI |
| scopes | text[] | ej. `{captures:write}` |
| last_used_at | timestamptz null | |
| revoked_at | timestamptz null | |

## Cálculos

- **Saldo de cuenta** (solo `confirmed`, `deleted_at is null`):
  `initial_balance + Σ income + Σ transfer_in − Σ expense − Σ transfer_out`.
  Se calcula con una consulta agregada; no se guarda en columna en el MVP.
- **Reportes**: excluyen `transfer_in` / `transfer_out` y movimientos `pending`.
- **Presupuesto del mes**: Σ `expense` confirmados de la categoría y sus hijas, con `occurred_at` dentro del mes en la zona horaria del usuario.

## Seed de desarrollo

`pnpm db:seed` crea un usuario demo (`demo@bolsillo.local` / contraseña `SEED_DEMO_PASSWORD` de `packages/db/.env.example`), cuentas de ejemplo, ~3 meses de movimientos variados, dos presupuestos, tres pagos recurrentes y algunas capturas pendientes con fixtures `fake: true`.

Cada fase agrega su parte: en la fase 1 son el usuario, cuatro cuentas (incluida una tarjeta de crédito), movimientos y transferencias. El seed es determinista y reemplaza al usuario demo cada vez que corre.
