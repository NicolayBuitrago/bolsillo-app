# 01 · Producto

## Problema

Las apps de finanzas personales disponibles tienen restricciones (funciones tras pago, poca personalización, captura de movimientos limitada o inexistente para bancos colombianos). Registrar todo a mano hace que se abandonen.

## Visión

Una app propia, web y móvil, donde registrar gastos e ingresos cueste casi cero esfuerzo: los movimientos se capturan solos desde las notificaciones y correos del banco, y el usuario solo confirma o corrige.

## Principios

1. **Capturar automático, confirmar humano.** Lo capturado entra como *pendiente*; nada afecta saldos confirmados sin una acción del usuario.
2. **Privacidad primero.** No se piden credenciales bancarias. Los textos capturados se guardan el mínimo tiempo necesario. El LLM es opcional y está apagado por defecto.
3. **Sin dependencia de planes pagos.** Todo el stack es open source y se puede autoalojar.
4. **Registrar manualmente en menos de 5 segundos.** Monto primero, luego categoría; lo demás es opcional.
5. **Multiusuario desde el diseño**, aunque al inicio la use una sola persona.

## Usuario inicial

Desarrollador en Bogotá, Colombia, con cuentas en bancos y billeteras colombianas (Bancolombia, Nequi, etc.), que usa Android y quiere también la vista web en el computador. Moneda principal COP.

## Funcionalidades

### MVP (fases 0–3)

- Registro e inicio de sesión (correo + contraseña).
- **Cuentas**: bancaria, tarjeta de crédito, efectivo, billetera digital, ahorro. Saldo inicial y saldo calculado.
- **Categorías** de gasto e ingreso, con subcategorías y un set por defecto al registrarse.
- **Movimientos**: gasto, ingreso y transferencia entre cuentas propias. Crear, editar, eliminar (borrado lógico), buscar y filtrar.
- **Inicio**: gastado e ingresado del mes, gasto por categoría, saldos por cuenta, número de pendientes.
- **Presupuestos** mensuales por categoría con progreso.
- **Pagos recurrentes** (arriendo, servicios, suscripciones) con recordatorio antes del vencimiento.
- **Reportes básicos**: resumen mensual y tendencia de los últimos 6 meses. Exportar CSV.
- **Captura desde notificaciones (Android)**: el usuario elige qué apps escuchar; las notificaciones de esas apps se convierten en movimientos pendientes.
- **Bandeja de pendientes**: confirmar, editar o ignorar movimientos capturados.
- **Aprendizaje de comercio → categoría**: al confirmar, la app recuerda la categoría para ese comercio.

### Después del MVP (fases 4–6)

- Extracción con LLM cuando ningún parser reconoce una notificación (opcional).
- Captura desde correos bancarios (funciona en cualquier plataforma).
- Captura desde Atajos de iOS (transacciones de Wallet).
- Despliegue de producción autoalojado y build de release del APK.

### Fuera de alcance

- Conexión directa con bancos (open banking o scraping).
- Inversiones, acciones, cripto.
- Conversión automática entre monedas (cada cuenta tiene su moneda; no se convierte).
- Finanzas compartidas entre varias personas.
- Lectura de SMS.

## Pantallas

### Móvil

| Pantalla | Propósito |
|---|---|
| Bienvenida / Login / Registro | Autenticación |
| Inicio | Resumen del mes, gasto por categoría, saldos, acceso a pendientes |
| Movimientos | Lista agrupada por día, filtros (fecha, cuenta, categoría, tipo, estado), búsqueda |
| Nuevo / editar movimiento | Teclado numérico grande primero, luego categoría, cuenta, comercio, nota, fecha |
| Transferencia | Cuenta origen, destino, monto |
| Pendientes | Movimientos capturados por confirmar; acciones rápidas confirmar / editar / ignorar |
| Cuentas | Lista con saldo; crear, editar, archivar |
| Presupuestos | Progreso por categoría en el mes actual |
| Pagos recurrentes | Próximos vencimientos; crear, editar, pausar |
| Reportes | Resumen mensual y tendencia |
| Ajustes → Captura | Estado del permiso, apps escuchadas, cuenta por defecto de cada app, optimización de batería |
| Ajustes → General | Moneda, LLM (on/off), tokens para Atajos, exportar CSV, cerrar sesión |

### Web

Las mismas pantallas excepto lo exclusivo de Android (permiso y apps escuchadas). En web, reportes y lista de movimientos aprovechan pantallas anchas (tablas, más columnas). La bandeja de pendientes también existe en web.

## Reglas de negocio clave

- **Saldo de una cuenta** = saldo inicial + ingresos − gastos ± transferencias, solo con movimientos **confirmados** y no eliminados.
- **Tarjeta de crédito**: los gastos aumentan la deuda; el saldo se muestra como deuda (negativo) y, si hay cupo, el disponible.
- **Transferencia** entre cuentas propias = dos movimientos enlazados; no cuentan como gasto ni ingreso en reportes.
- **Ajuste de saldo**: si el saldo real no coincide, el usuario crea un movimiento de ajuste con categoría de sistema "Ajuste".
- Un **presupuesto** compara lo gastado confirmado de la categoría (y sus subcategorías) en el mes contra el monto definido.
