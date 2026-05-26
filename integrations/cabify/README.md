# Integración Cabify Logistics — cotización de envío

Prueba el cálculo del **costo de envío** (y qué vehículo asignaría: auto/van) para una
entrega del atelier (Miraflores) a una dirección de cliente, usando la API de Cabify Logistics.

## Qué hace
1. Obtiene un **access token** (OAuth `client_credentials`).
2. Lista los **tipos de envío** disponibles para el punto de recojo.
3. **Cotiza** una entrega de ejemplo y muestra **precio + vehículo (`asset_kind`) + ETA**.

> El campo `asset_kind` en la respuesta del estimate indica el vehículo (`car`, `van`,
> `moped`, `scooter`, `bicycle`). Así confirmamos si el envío iría en **auto**.

## Paso 1 — Crear la cuenta y obtener las credenciales (lo haces tú)
La cuenta/credenciales **no se pueden crear por API**; la key se muestra una sola vez.
1. Crea o inicia sesión: https://cabify-api.readme.io/docs/create-or-login
2. Obtén tu **Logistics API key**: https://cabify-api.readme.io/docs/get-logistics-api-key
3. Eso te da un `client_id` (OAUTH_ID) y un `client_secret`.
   - Para **sandbox**: el sandbox se genera a partir de tu cuenta; pide/activa la key de sandbox.

Docs de referencia:
- Access token: https://cabify-api.readme.io/docs/get-your-access-token
- Entorno sandbox: https://cabify-api.readme.io/docs/sandbox-environment

## Paso 2 — Configurar
```
cp .env.example .env
# edita .env y pega CABIFY_CLIENT_ID y CABIFY_CLIENT_SECRET
```

## Paso 3 — Ejecutar
```
node integrations/cabify/estimate.js
```

Salida esperada (ejemplo):
```
• Same day default (same_day) → 12.50 PEN · vehículo: car · entrega aprox: 2026-05-21T15:10:00Z
```

## Notas
- Coordenadas de recojo por defecto = Miraflores (aprox.). Ajusta `LF_PICKUP_*` en `.env`.
- Endpoints usados:
  - Auth: `POST {auth}/auth/api/authorization`
  - Tipos: `GET {logistics}/v1/shipping_types/available?location=lat,lon`
  - Cotización: `POST {logistics}/v3/parcels/estimate`
- El `.env` está ignorado por git (no se sube). No subas tus credenciales.
