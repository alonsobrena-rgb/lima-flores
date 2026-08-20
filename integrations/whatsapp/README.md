# Promociones por WhatsApp — Meta Cloud API

Integración para enviar **mensajes de marketing con plantillas aprobadas por Meta**
desde el admin (sección *Promociones WhatsApp*). Permite guardar la base de
clientes con su nombre, crear plantillas con foto (subida o generada con IA en el
Marketing Studio), **mandarle una plantilla a un contacto suelto cuando quieras**
y enviar campañas personalizadas a toda la lista.

## El mismo token que Instagram

WhatsApp y el publicador de Instagram viven los dos en el Graph de Meta. Si el
número de WhatsApp y la cuenta de Instagram cuelgan del **mismo Business**, el
token de System User que ya publica en Instagram sirve también acá: se deja
`IG_ACCESS_TOKEN` —que es el valor por defecto— y no hay que agregar ninguna
variable nueva en Railway.

Lo que **no** se hereda son los permisos. Además de los de Instagram, al token le
hacen falta `whatsapp_business_messaging` y `whatsapp_business_management`; se
agregan en *Business Settings → System Users*, se regenera el token y se vuelve a
pegar en Railway. Por eso el panel tiene el botón **Probar**: le pregunta a Meta
por el número y por la WABA antes de que el error salga recién en el primer envío.

Si el número está en otro Business, crea su propio token, ponlo en Railway con un
nombre que empiece por `WA_` y escríbelo en el campo *Variable del token*.

**El token nunca se guarda en la base**, igual que en `ig_cuentas`: la fila
`wa_conexion` solo guarda el **nombre** de la variable de entorno que lo contiene.
Una base con tokens dentro es una base que no se puede volcar, ni copiar a local,
ni mirar en un backup. Por eso solo se aceptan nombres que empiecen por `IG_` o
`WA_`: sin ese cerrojo la conexión podría apuntar a `DATABASE_URL` y mandársela a
Meta como token.

## Conectar el número, desde el panel

Todo se configura en **Admin → Promociones WhatsApp → Conexión**, sin tocar
Railway (salvo el token). Los tres ids salen de
[Meta for Developers](https://developers.facebook.com/) +
[WhatsApp Manager](https://business.facebook.com/wa/manage/):

| Campo | De dónde sale | Para qué |
|---|---|---|
| **ID del número de WhatsApp** | WhatsApp Manager → *API Setup* → *Phone number ID* | enviar mensajes |
| **ID de la cuenta de WhatsApp Business (WABA)** | mismo panel, *WhatsApp Business Account ID* | crear y sincronizar plantillas |
| **ID de la app de Meta** | la app tipo *Business* con el producto WhatsApp | solo para subir la **foto** del encabezado al crear una plantilla |

Son números, no el `+51…`: el teléfono en sí se guarda aparte y solo sirve para
reconocer el número en el panel.

## Variables de entorno

La única que hace falta es el token, y por defecto es la de Instagram:

- `IG_ACCESS_TOKEN` — el token, con los permisos de WhatsApp agregados.

Las de antes siguen valiendo como respaldo, para no romper lo que ya estuviera
puesto (ver `.env.example`): `WA_TOKEN`, `WA_PHONE_NUMBER_ID`, `WA_WABA_ID`,
`WA_APP_ID`. Si el panel tiene el dato, manda el panel; si no, la variable.
`WA_GRAPH_VERSION` cambia la versión del Graph (default `v21.0`) para las dos
integraciones.

- **Local**: copia `.env.example` a `integrations/whatsapp/.env`.
- **Railway**: pégalas en *Variables* del servicio del backend.

Mientras falte algo, la sección WhatsApp del admin funciona en modo
lectura/edición de contactos, avisa arriba qué falta, y crear plantillas o enviar
responde un error claro (503) en vez de fallar.

## Mandar una plantilla a un contacto

En **Contactos**: se elige arriba la plantilla aprobada, y cada fila tiene su
botón **Enviar** (pide confirmación con el nombre y el número a la vista). El
mensaje sale en el momento, con el nombre del contacto puesto en `{{1}}`, y queda
en el historial de **Campañas** marcado como envío directo. Para mandarla a varios
a la vez está la pestaña **Campañas**.

## Notas de cumplimiento (Meta)

- Solo se pueden enviar **plantillas aprobadas** a usuarios con **opt-in**.
- Las plantillas de marketing pasan por revisión de Meta (minutos a horas);
  usa el botón *Sincronizar* para refrescar el estado.
- La foto del header se re-envía en cada mensaje: la plataforma la sube una vez
  por campaña y reutiliza ese `media id`.
