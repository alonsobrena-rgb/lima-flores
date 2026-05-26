# Integración Envíame — cotización + creación de envío + tracking

Cliente mínimo para usar Envíame como plataforma **multicourier** (Olva, 99minutos, Moova, PedidosYa, etc.) desde un solo trámite.

## Qué hace
- **v2 · cotización de tarifas** (`GET /api/s2/v2/rates`) → muestra el precio del envío al cliente en el checkout.
- **v3 · crear envío** (`POST /v3/companies/{company_id}/deliveries`) → despacha cuando el pedido está listo, eligiendo el carrier (ej. **Moova** para entrega en **auto**).
- **v3 · tracking** (`GET /v3/deliveries/{id}/tracking`) → estado para mostrar al cliente; combinable con webhooks de Envíame.

## Paso 1 — Activar la cuenta (lo haces tú)
Envíame requiere alta vía su equipo de soporte; no es self-serve.
1. Solicita acceso a la API v3 a **support@enviame.io** indicando que necesitas:
   - **API key v2** (para cotizar) y
   - **App Auth0 para v3** (te entregan: token URL, audience, client_id, client_secret).
2. Indica país **Perú**, carriers de interés (ej. **Moova, 99minutos**) y zona (Lima/Miraflores).
3. Documentación: https://docs.enviame.io/docs/v3

## Paso 2 — Configurar
```
cp .env.example .env
# completa ENVIAME_API_KEY y las credenciales OAuth de v3
```

## Paso 3 — Probar la cotización
```
node integrations/enviame/quote.js
```

> Los **parámetros exactos** de `/rates` (nombres de origen/destino, peso, etc.) se confirman en tu doc de Envíame al recibir las credenciales. Defínelos en `.env` como `ENVIAME_RATES_PARAMS` (JSON).

## Notas
- v2 (rates) usa header `api-key`.
- v3 (envíos/tracking) usa **Bearer** OAuth — token con caché ~expires_in.
- Entornos: `stage` (`stage.api.enviame.io`) y `production` (`api.enviame.io`).
- El `.env` está ignorado por git (no se sube). No subas tus credenciales.
