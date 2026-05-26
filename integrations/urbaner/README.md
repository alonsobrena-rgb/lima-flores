# Integración Urbaner — cotización + crear orden + tracking

Cliente mínimo para usar [Urbaner](https://urbaner.com) (mensajería on-demand en Lima con auto/moto/camioneta) desde Lima Flores.

## Qué hace
- **Cotización** (`POST /cli/price/`) → precio del envío antes del checkout.
- **Crear orden** (`POST /cli/order/`) → despacha cuando el pedido está listo (incluye URL pública de tracking en la respuesta).
- **Estado** (`GET /client/orders/{id}/`) → poll del estado para mostrar al cliente.

## Por qué Urbaner
- API REST pública con **sandbox autoservicio** — no necesitas esperar aprobación comercial para integrar.
- Soporta **auto** explícitamente (no solo moto) — clave para arreglos florales grandes.
- Sin mínimo mensual ni cobro fijo (solo pagas por envío realizado).
- Tres modalidades: Express, Same Day, Next Day.

## Paso 1 — Crear cuenta sandbox (lo haces tú)
1. Regístrate en https://app.sandbox.urbaner.com/registro
2. Anota email + password.
3. (Opcional) Escribe a `hola@urbaner.com` para comercial y `tecnologia@urbaner.com` para soporte técnico.
4. Docs: https://developers.urbaner.com/

## Paso 2 — Configurar
```
cp .env.example .env
# completa URBANER_EMAIL y URBANER_PASSWORD
```

## Paso 3 — Probar la cotización
```
node integrations/urbaner/quote.js
```

Salida esperada: precio por tipo de orden, distancia (metros) y duración (segundos).

## Notas
- **Auth:** Urbaner no usa OAuth. El cliente hace login con email+password al primer request, cachea el `auth_token` en memoria y re-loguea si recibe 401.
- **Vehículos:** el ejemplo usa `vehicle_id = 2` (auto). Los IDs exactos los confirmas con tu cuenta — 1 suele ser moto, 2 auto. Documéntalo en `.env`.
- **Producción:** cambia `URBANER_ENV=production` y la base pasa de `api.sandbox.urbaner.com` a `middleware.urbaner.com`. Necesitas credenciales reales de tu cuenta de producción (no las mismas del sandbox).
- El `.env` está ignorado por git. No subas credenciales.
