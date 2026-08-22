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

## Los números

Una sola regla, sin desplegable de países: **si el número empieza con `+`, se
guarda tal cual; si no, se le pone el +51 de Perú.** Vale igual para el alta
individual y para el lote que se importa, así que un CSV que ya viene en formato
internacional entra bien sin tocar nada.

Había un selector de código de país y se quitó: la lista es de Lima, elegir el
país en cada alta era un paso que nadie cambiaba, y era uno que se podía dejar
mal puesto sin notarlo.

Dos detalles de `normalizePhone()` (`db/whatsapp-store.js`) que no son evidentes:

- El `00` se sigue respetando, porque es el prefijo internacional escrito a la
  vieja usanza: `0056912345678` es un chileno, y tratarlo como local lo dejaría
  en `+510056912345678`.
- Un número que ya trae el 51 delante pero sin `+` (`51987654321`) no se duplica.
  El margen de cinco dígitos evita confundirlo con un número nacional que empiece
  por 51; los celulares peruanos empiezan por 9, así que en la práctica no se
  cruzan.

Todo se guarda en E.164 (`+51987654321`), que es lo único que acepta Meta.

## Mandar una plantilla a un contacto

En **Contactos**: se elige arriba la plantilla aprobada, y cada fila tiene su
botón **Enviar** (pide confirmación con el nombre y el número a la vista). El
mensaje sale en el momento, con el nombre del contacto puesto en `{{1}}`, y queda
en el historial de **Campañas** marcado como envío directo. Para mandarla a varios
a la vez está la pestaña **Campañas**.

## Programadas: «el día N de cada mes a tal hora»

La pestaña **Programadas** guarda reglas: un día del mes, una hora, una
plantilla aprobada. A esa hora el vigía crea una campaña a todos los contactos
activos, con la misma maquinaria que un envío manual.

- **El día y la hora son de Lima.** El servidor corre en UTC, así que una regla
  «día 2 a las 10:00» guardada tal cual se dispararía a las 5 de la mañana. La
  conversión vive en `integrations/whatsapp/agenda.js`, y el offset sale de
  `Intl`, no cableado a −5.
- **Si el mes no llega a ese día, sale el último.** Un 31 en febrero se manda el
  28 (o el 29). Saltárselo dejaría media docena de meses en silencio.
- **Repetir**: todos los meses, o una sola vez.
- **El interruptor arranca apagado**, igual que el del publicador de Instagram y
  por lo mismo: mandar marketing es hacia afuera y no se enciende con un deploy.
  Se puede dejar todo programado y encenderlo después.

### Lo que evita que se mande dos veces, o a destiempo

- `marca_disparada` guarda la ocurrencia ya mandada (`'YYYY-MM-DD HH:MM'` de
  Lima). El vigía mira cada minuto: sin esa marca, una regla saldría sesenta
  veces en una hora. Se sella **antes** de enviar, para que un fallo a mitad de
  campaña no la repita entera en la vuelta siguiente.
- Esa marca se sella **también al crear o al editar** la regla, con la última
  ocurrencia ya pasada. Sin eso, programar «día 2 a las 10:00» un día 2 a las
  10:05 mandaría la campaña en el acto.
- Ojo con la consecuencia: para saber si una regla de **una sola vez** ya salió,
  lo que vale es `ultimo_envio`, no la marca — la marca la tiene desde que
  nació. Mirando la marca, esas reglas nacían diciendo «ya se mandó» y no
  llegaban a mandarse nunca.
- **Ventana de gracia de una hora.** Si el servidor estuvo caído, al volver no
  se manda lo que tocaba hace tres horas: un mensaje de marketing a destiempo es
  peor que uno no enviado, y una ráfaga de campañas atrasadas al arrancar sería
  peor todavía.
- Una regla por vuelta. Dos que coincidan en el mismo minuto salen en minutos
  distintos, para no chocar con los límites de Meta.

## Notas de cumplimiento (Meta)

- Solo se pueden enviar **plantillas aprobadas** a usuarios con **opt-in**.
- Las plantillas de marketing pasan por revisión de Meta (minutos a horas);
  usa el botón *Sincronizar* para refrescar el estado.
- **Sincronizar también importa.** Lo creado fuera del panel —desde WhatsApp
  Manager, o desde `marketing/whatsapp/crear.js`— no está en la tabla local, y
  antes el sync solo hacía un `UPDATE`: no encontraba fila, no tocaba nada y
  respondía `synced: N` como si hubiera ido bien, así que esas plantillas nunca
  aparecían en el panel aunque estuvieran aprobadas. Ahora las inserta.
- **La foto del encabezado también se recupera.** Al leer una plantilla, Meta
  pone en `example.header_handle` una URL de `scontent.whatsapp.net` al JPEG de
  muestra, y se descarga sin token. El sync la baja y guarda el binario, así que
  una plantilla importada queda lista para enviar como cualquier otra. La URL va
  firmada y caduca: se guarda la imagen, nunca el enlace. Solo se descarga si la
  fila no tenía foto, para no repetir la bajada en cada sincronización.
- Una plantilla creada desde el panel **no se pisa**. Al sincronizar solo se
  actualiza su estado; el texto, los botones y la foto que guardó el panel se
  quedan como estaban, porque esa fila es la que tiene el binario bueno.
- La foto del header se re-envía en cada mensaje: la plataforma la sube una vez
  por campaña y reutiliza ese `media id`.
