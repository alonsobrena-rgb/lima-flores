# Integración 99minutos — cotización + crear envío + tracking

Cliente mínimo para usar [99minutos](https://99minutos.com) (last-mile e-commerce en LATAM, opera en Perú) desde Lima Flores.

## Qué hace
- **Cotización** (`POST /api/v3/shipping/rates`) → precio + cobertura por origen, destino, peso y dimensiones.
- **Crear orden** (`POST /api/v3/orders`) → despacha cuando el pedido está listo.
- **Tracking** (`GET /api/v3/shipments/tracking?identifiers=…`) → estado del envío (también versión batch).

## Por qué 99minutos
- API REST pública, [OpenAPI documentado](https://developers.99minutos.com/llms.txt), creación de cuenta sin gating comercial.
- Sin mínimo mensual ni cobro fijo (solo pagas por envío realizado).
- Cubre 40+ ciudades LATAM incluyendo Lima.

## ⚠️ Verificar antes de producción
- 99minutos se enfoca en **last-mile e-commerce con moto/van**. **No publican explícitamente la modalidad "auto sedan"** para Perú. Confirma con `comercial@99minutos.com` si soportan vehículo auto para arreglos florales grandes/frágiles.
- Si solo ofrecen moto, úsalo como respaldo para ramos pequeños/medianos y deja Urbaner como principal.

## Paso 1 — Crear cuenta (lo haces tú)
1. Regístrate en https://developers.99minutos.com/ (la cuenta sandbox y producción son independientes).
2. Genera `client_id` y `client_secret` en la sección developer.
3. Comercial: `comercial@99minutos.com` (respuesta <30 min en horario hábil).

## Paso 2 — Configurar
```
cp .env.example .env
# completa NINETYNINE_CLIENT_ID y NINETYNINE_CLIENT_SECRET
```

## Paso 3 — Probar la cotización
```
node integrations/99minutos/quote.js
```

Default: Miraflores → San Isidro, paquete 3 kg / 30×30×40 cm.

## Notas técnicas
- **Auth:** OAuth 2.0 client_credentials → `POST /api/v3/oauth/token` (form-urlencoded). El token se cachea en memoria con su `expires_in`.
- **Base URL:** `https://delivery.99minutos.com` para sandbox y producción (la doc usa la misma base; lo que cambia son las credenciales).
- El `.env` está ignorado por git. No subas credenciales.
