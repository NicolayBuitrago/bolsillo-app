# ADR 0001 · Bootstrap de usuario con Better Auth

**Estado:** aceptada (fase 1, octubre de 2026)

## Contexto

`docs/02-arquitectura.md` pedía crear `user_settings` y las categorías por defecto dentro de una transacción al registrarse. Better Auth 1.7 ejecuta `databaseHooks.user.create.after` después de confirmar la creación del usuario y no permite unirse a esa transacción. Si el bootstrap falla, el usuario existe sin sus datos iniciales.

## Decisión

- `ensureUserDefaults(db, userId)` (en `packages/db`) crea settings y categorías en una transacción propia. La fila de `user_settings` (`insert … on conflict do nothing returning`) sirve de marca: si ya existe, no hace nada. Es seguro llamarla en paralelo.
- Se llama en `user.create.after` y en `session.create.after` (cada inicio de sesión). Un error se registra en el log (solo `userId` y el nombre del error) y no rompe el registro.
- Leer los ajustes o ajustar un saldo también repara los datos si faltan.

## Consecuencias

- Un fallo transitorio del bootstrap se corrige solo en el siguiente inicio de sesión o en la primera lectura de ajustes.
- Hay un intervalo mínimo entre el commit del usuario y el bootstrap; los endpoints que dependen de esos datos los reparan bajo demanda.
