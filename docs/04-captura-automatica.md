# 04 · Captura automática

Es la parte más delicada del producto. Lee este documento completo antes de tocar `packages/core/src/capture`, `apps/api/src/modules/captures` o `apps/mobile/modules/notification-listener`.

## Fuentes por plataforma

| Fuente | Plataforma | Fase | Cómo llega |
|---|---|---|---|
| Notificaciones push de apps bancarias | Android | 3 | `NotificationListenerService` → cola nativa → `POST /v1/captures/batch` |
| Correos de alerta del banco | Todas | 5 | Reenvío a dirección de captura → Worker → `POST /v1/captures/email` |
| Atajos de iOS (transacciones de Wallet) | iOS 17+ | 5 | Automatización del usuario → `POST /v1/captures/shortcut` |
| Registro manual | Todas | 1 | Formulario |

iOS no permite leer notificaciones de otras apps. No intentes ningún mecanismo para hacerlo.

## Pipeline en el servidor

```
captura recibida
  1. Validar con Zod y calcular contentHash
  2. Insertar en raw_captures (on conflict (user_id, content_hash) do nothing → responder "ya existía")
  3. Filtro OTP → si coincide: status=ignored, borrar title/body, fin
  4. Parsers deterministas (registro ordenado) → ParsedTransaction | null
  5. Si null y parece transacción y el usuario activó LLM → extracción con LLM
  6. Si sigue null → status=failed (o ignored si claramente no es transacción), fin
  7. Resolver cuenta (ver "Asociación de cuenta")
  8. Deduplicación contra movimientos existentes
       - duplicado único → status=duplicate, enlazar transaction_id, completar campos vacíos del movimiento existente
       - sin duplicado → crear movimiento status=pending, source=<origen>, status de captura=parsed
       - varios candidatos → crear pending y marcar `possibleDuplicateOf` en parsed
  9. Sugerir categoría con merchant_rules
```

Todo el pipeline de una captura corre en una transacción de base de datos. Es **reprocesable**: `POST /v1/captures/:id/reprocess` lo vuelve a ejecutar desde el paso 3 si la captura no está enlazada a un movimiento confirmado.

## Filtro OTP y contenido sensible

Antes de cualquier otro procesamiento, descartar si el texto contiene señales de código de verificación: palabras como "código", "clave dinámica", "OTP", "token", "no compartas", "verificación", combinadas con una secuencia de 4–8 dígitos. Implementar en `packages/core/src/capture/sensitive.ts` con tests. Ante la duda, descartar.

Además, al guardar cualquier `body`, enmascarar secuencias de 9 o más dígitos (números de cuenta o documento) dejando solo los últimos 4: `******1234`.

## Parsers

### Contrato (`packages/core/src/capture/types.ts`)

```ts
export interface CaptureInput {
  source: 'notification' | 'email' | 'shortcut';
  sourceApp: string;          // paquete Android, remitente o 'ios-shortcut'
  title?: string;
  body: string;
  receivedAt: Date;
  structured?: Record<string, unknown>; // Atajos de iOS
}

export interface ParsedTransaction {
  type: 'expense' | 'income' | 'transfer_out' | 'transfer_in';
  amountMinor: number;
  currency: string;           // ISO 4217
  merchant?: string;
  counterparty?: string;      // quién envía o recibe en transferencias
  accountHint?: { last4?: string; institution?: string };
  occurredAt?: Date;          // si el texto trae fecha/hora; si no, receivedAt
  confidence: number;         // 0..1
}

export interface CaptureParser {
  id: string;                 // 'bancolombia.purchase.v1'
  institution: string;
  sources: CaptureInput['source'][];
  matches(input: CaptureInput): boolean;     // barato: remitente/paquete + palabras clave
  parse(input: CaptureInput): ParsedTransaction | null;
}
```

- Registro en `capture/parsers/index.ts`: lista ordenada; se usa el primero cuyo `matches` sea true y cuyo `parse` devuelva algo.
- Cada institución en su carpeta: `capture/parsers/<institucion>/{index.ts, fixtures.ts, <institucion>.test.ts}`.
- Un parser no lanza excepciones: devuelve `null` si no entiende.
- Montos siempre con `parseAmount` de `core/money`.
- Las notificaciones que no son transacciones (promociones, avisos de inicio de sesión, recordatorios) deben devolver `null` y terminar como `ignored`, no como `failed`. Para eso existe `isLikelyTransaction(input)`: requiere un monto con símbolo o código de moneda y al menos una palabra clave (compra, pago, transferencia, recibiste, enviaste, retiro, consignación, abono, débito, cargo).

### Fixtures

```ts
export const fixtures: CaptureFixture[] = [
  {
    name: 'compra con tarjeta débito',
    fake: true,   // true = inventado; false = muestra real anonimizada aportada por el usuario
    input: { source: 'notification', sourceApp: '...', title: '...', body: '...', receivedAt: new Date('...') },
    expected: { type: 'expense', amountMinor: 4590000, currency: 'COP', merchant: '...' },
  },
];
```

Un test genérico recorre todos los fixtures de todos los parsers. **No asumas el formato real de ningún banco.** En la fase 3 se crean los parsers iniciales con fixtures `fake: true` y un `TODO` visible; el usuario aporta muestras reales y entonces se ajustan. Para agregar un banco: el usuario pega muestras anonimizadas → se agregan como fixtures `fake: false` → se escribe el parser hasta que pasen.

Parsers iniciales a crear como esqueleto: **Bancolombia** y **Nequi** (confirmar con el usuario antes de la fase 3; puede cambiar la lista).

### Parser de Atajos de iOS

`ios-shortcut.v1`: no parsea texto; valida `structured` con Zod (`amount` como texto, `merchant`, `cardName` opcionales) y convierte el monto con `parseAmount`.

## Extracción con LLM (fase 4, opcional)

- Solo si `user_settings.llm_extraction_enabled = true`, ningún parser respondió y `isLikelyTransaction` es true.
- Corre únicamente en la API (`apps/api/src/modules/captures/llm-extractor.ts`) con el SDK oficial de Anthropic. Modelo por variable de entorno `ANTHROPIC_MODEL` (usar el modelo pequeño y económico más reciente).
- Se envía solo el texto ya enmascarado, nunca el OTP (el filtro corre antes) ni datos del usuario.
- Se pide salida JSON con un esquema fijo; la respuesta se valida con el mismo esquema Zod de `ParsedTransaction`. Si no valida → `failed`, sin reintentos infinitos.
- Opcional: incluir la lista de nombres de categorías del usuario para que sugiera una; la sugerencia se guarda en `parsed.suggestedCategoryId` y nunca se aplica sin confirmación.
- `parser_id = 'llm'` y `confidence` máxima 0.7 para que la UI lo marque como "revisar".
- Límite de llamadas por usuario por día (variable de entorno) y caché por `content_hash`.
- Tests con el SDK simulado; ningún test llama a la API real.

## Asociación de cuenta

En este orden, el primero que resuelva:
1. `accountHint.last4` coincide con `financial_accounts.last4` del usuario (no archivada).
2. `capture_sources.default_account_id` de la fuente.
3. Única cuenta no archivada cuya `institution` coincide con `accountHint.institution`.
4. Sin cuenta: el movimiento queda `pending` con `account_id = null` y el usuario elige al confirmar.

## Deduplicación

El mismo pago puede llegar por notificación, correo y además haberse registrado a mano.

**Nivel 1 – misma captura**: `unique (user_id, content_hash)`. También en el dispositivo: el servicio nativo ignora una notificación si ya guardó una con la misma `key` de Android y el mismo texto (las apps actualizan notificaciones).

**Nivel 2 – mismo movimiento, distinto canal**: candidatos = movimientos del usuario no eliminados con
- mismo `type` y mismo `amount_minor` y `currency`,
- `|occurred_at − candidato.occurred_at| ≤ 15 minutos` (configurable),
- cuenta compatible: misma cuenta, o alguna de las dos es null,
- y que no estén ya enlazados a otra captura de la **misma** fuente (dos compras iguales seguidas por notificación son dos compras).

Resultado:
- 0 candidatos → crear `pending`.
- 1 candidato → `duplicate`: enlazar y completar campos vacíos (comercio, cuenta). No cambiar el estado del existente.
- 2+ → crear `pending` con `parsed.possibleDuplicateOf = [ids]`; la UI muestra "¿es el mismo que…?".

Implementar la lógica de decisión como función pura en `packages/core/src/capture/dedup.ts` (recibe la captura parseada y la lista de candidatos) con tests exhaustivos; la consulta de candidatos va en el repositorio de la API.

## Categorización y aprendizaje

- `normalizeMerchant(text)`: minúsculas, sin tildes, sin puntuación, sin números de referencia o sucursal al final, espacios colapsados. Función pura con tests.
- Al crear un `pending` con comercio: buscar `merchant_rules` por `merchant_normalized` y precargar categoría (y cuenta si la regla la tiene).
- Al confirmar con comercio y categoría: upsert de la regla e incrementar `hits`.

## Módulo Android: `apps/mobile/modules/notification-listener`

Módulo local con **Expo Modules API** (Kotlin) más un **config plugin** que agrega al `AndroidManifest`:

```xml
<service
  android:name=".BankNotificationListenerService"
  android:label="Bolsillo"
  android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"
  android:exported="true">
  <intent-filter>
    <action android:name="android.service.notification.NotificationListenerService" />
  </intent-filter>
</service>
```

### Servicio (`onNotificationPosted`)

1. Ignorar si el paquete no está en la lista permitida (guardada en `SharedPreferences`, sincronizada desde JS).
2. Ignorar notificaciones `ongoing`, resúmenes de grupo y las de la propia app.
3. Extraer `EXTRA_TITLE`, y como texto `EXTRA_BIG_TEXT` si existe, si no `EXTRA_TEXT`; además `postTime`, `packageName`, `key`.
4. Filtro OTP también aquí (mismas reglas que en core, portadas a Kotlin con los mismos casos de prueba) para que los códigos nunca se escriban en disco.
5. Insertar en una tabla SQLite nativa propia (`capture_queue`) con `id`, campos anteriores, `created_at`, `synced = 0`. Evitar duplicados por (`key`, hash del texto).
6. Si la app está en primer plano, emitir evento `onCapture` a JS.
7. Implementar `onListenerDisconnected` → `requestRebind`.

Para construir el selector de apps sin leer contenido ajeno: registrar en una tabla aparte solo `packageName` y la etiqueta de la app de cualquier notificación vista en los últimos 7 días (sin título ni texto).

### API expuesta a JS

```ts
isPermissionGranted(): Promise<boolean>
openPermissionSettings(): void
isIgnoringBatteryOptimizations(): Promise<boolean>
openBatterySettings(): void
setAllowedPackages(packages: string[]): Promise<void>
getRecentlySeenPackages(): Promise<{ packageName: string; label: string; lastSeenAt: number }[]>
drainQueue(limit: number): Promise<QueuedCapture[]>   // no marca nada
ackQueue(ids: string[]): Promise<void>                // marca synced y borra el texto
addListener('onCapture', cb)
// Solo en builds de desarrollo:
debugInjectCapture(input: { packageName: string; title: string; text: string }): Promise<void>
```

### Sincronización

Al volver la app a primer plano, después del login y al recibir `onCapture`: `drainQueue(50)` → `POST /v1/captures/batch` → `ackQueue` con los ids aceptados (incluye los que el servidor reporta como "ya existía"). Si falla, no se hace `ack` y se reintenta luego. Filas `synced` se eliminan tras 7 días.

### Onboarding del permiso (pantalla Ajustes → Captura)

Guiar paso a paso, con estado en vivo:
1. Explicar qué se lee, qué no, y que todo se puede apagar.
2. Botón para abrir el ajuste de "Acceso a notificaciones".
3. **Android 13+ con APK instalado fuera de Play Store**: el sistema bloquea ese permiso como "ajuste restringido". Explicar: *Información de la app → menú ⋮ → Permitir ajustes restringidos*, y luego volver al paso 2.
4. Elegir las apps a escuchar desde `getRecentlySeenPackages` y asignar cuenta por defecto.
5. Recomendar excluir la app de la optimización de batería (algunas marcas como Xiaomi o Samsung matan servicios en segundo plano).

## Correo (fase 5)

- Cada usuario tiene una dirección única `c-<token>@<dominio-de-captura>` (`email_capture_address_token`).
- El usuario crea en su correo un filtro que reenvía las alertas de su banco a esa dirección.
- **Recomendado**: Cloudflare Email Routing → Worker (`infra/email-worker`) que extrae remitente original, asunto y la parte de texto plano (o HTML convertido a texto), y hace `POST /v1/captures/email` con firma HMAC-SHA256 en cabecera.
- El primer correo de reenvío de Gmail es un mensaje de confirmación: el Worker debe detectarlo y dejarlo disponible para el usuario (se guarda como captura `ignored` con un flag que la UI muestra con el enlace de confirmación).
- Alternativa descartada para el MVP: API de Gmail. Su scope de lectura es restringido y exige verificación de Google para uso público.
- La fuente de la captura es `email` y `source_app` es el remitente original; los parsers de correo usan `sources: ['email']`.

## Atajos de iOS (fase 5)

- En Ajustes → General el usuario genera un token de API (`captures:write`); se muestra una sola vez.
- La app (web o iOS) muestra instrucciones: crear automatización personal con el disparador **Transacción** de Wallet → acción "Obtener contenido de URL" → `POST https://<api>/v1/captures/shortcut`, cabecera `Authorization: Bearer <token>`, cuerpo JSON con monto, comercio y nombre de tarjeta tomados de las variables del disparador.
- Solo cubre tarjetas agregadas a Apple Wallet.
