# Promociones por WhatsApp — Meta Cloud API

Integración para enviar **mensajes de marketing con plantillas aprobadas por Meta**
desde el admin (sección *WhatsApp*). Permite cargar la base de clientes, crear
plantillas con foto (subida o generada con IA en el Marketing Studio) y enviar
campañas personalizadas con el nombre de cada cliente.

## Cómo obtener las credenciales

Todo se hace en [Meta for Developers](https://developers.facebook.com/) +
[WhatsApp Manager](https://business.facebook.com/wa/manage/).

1. **App de Meta** → crea (o usa) una app tipo *Business* y agrega el producto
   **WhatsApp**. Anota el **App ID** → `WA_APP_ID`.
2. **Número emisor** → en *WhatsApp → API Setup* verás el **Phone number ID**
   (`WA_PHONE_NUMBER_ID`) y el **WhatsApp Business Account ID** (`WA_WABA_ID`).
   Para producción registra y verifica tu número de empresa.
3. **Token permanente** → crea un *System User* en
   *Business Settings → Users → System Users*, asígnale la app y la WABA, y
   genera un token con los permisos `whatsapp_business_messaging` y
   `whatsapp_business_management`. Ese token va en `WA_TOKEN`.

## Configuración

Define las variables (ver `.env.example`):

- **Local**: copia `.env.example` a `integrations/whatsapp/.env`.
- **Railway**: pégalas en *Variables* del servicio del backend.

Mientras falten, la sección WhatsApp del admin funciona en modo lectura/edición
de contactos, pero crear plantillas y enviar campañas responde un error claro
(503) en vez de fallar.

## Notas de cumplimiento (Meta)

- Solo se pueden enviar **plantillas aprobadas** a usuarios con **opt-in**.
- Las plantillas de marketing pasan por revisión de Meta (minutos a horas);
  usa el botón *Sincronizar* para refrescar el estado.
- La foto del header se re-envía en cada mensaje: la plataforma la sube una vez
  por campaña y reutiliza ese `media id`.
