# Publicador de Instagram

Publica en `@lima_flores` los creativos que ya se hacen en `marketing/`: cinco al
día, a horas fijas, desde el panel (`/admin/instagram`).

## Cómo funciona

1. **La cola vive en la BD** (`ig_queue`), con el binario adentro. En disco no
   sobreviviría: Railway lo borra en cada deploy y una pieza programada para el
   jueves tiene que aguantar los deploys del miércoles.
2. **Un vigía** (`publisher.js`) mira la cola cada minuto y publica lo vencido.
   Una pieza por vuelta.
3. **Meta descarga el archivo él mismo** desde `/api/ig/media/:id`, que por eso
   es público y por eso hace falta `PUBLIC_BASE_URL` con el dominio de
   producción. Desde localhost esto no puede funcionar, y no es un error.

Instagram **no programa por API**: el Graph publica en el momento en que se le
pide. La hora es nuestra (`agenda.js`, en hora de Lima).

## La cola guarda una copia, no una referencia

Al encolar IG-25 se copia el JPEG **de ese momento**. Es lo correcto para
publicar —el punto 1 de arriba— y además una pieza subida a mano no está en
ningún repo. El precio es que rehacer un creativo no alcanza: la galería pública
cambia con el deploy porque lee los archivos, y la cola se queda con la copia
vieja. Pasó exactamente eso: se arregló la raya de la banda de VID-01, se
desplegó, la galería mostró el video bueno y el panel siguió enseñando el viejo.

**Por eso el sincronizado corre solo en cada arranque**
(`sincronizar.js` → `alArrancar()`, lo llama `publisher.start()`), que es justo
cuando el disco acaba de cambiar. La primera versión de esto era solo un botón,
y un botón que alguien tiene que acordarse de apretar no es «estar conectados»:
es la misma trampa con un paso más. El botón sigue estando —**«Volver a leer del
repo»**, `POST /api/admin/ig/resincronizar`— para hacerlo sin esperar un deploy,
y usa exactamente el mismo código.

Las reglas:

- **Compara por SHA-256, no por tamaño.** Un JPEG reencodeado puede pesar igual
  y ser otro. El hash vive en `ig_queue.media_sha` justamente para que la pasada
  del arranque **no tenga que bajarse los blobs**: son treinta y pico de piezas
  de medio mega y un MP4 de siete, por cuenta. Las filas anteriores a la columna
  lo tienen en NULL, se calcula una vez y queda guardado.
- **No toca lo ya publicado ni lo que se está publicando.** El archivo de una
  pieza publicada es historia, y cambiarle el binario a algo que Meta está
  descargando en ese instante es la forma de que el reel quede a medias. El
  `status IN ('queued','paused','failed')` del `UPDATE` es el mismo candado que
  usa `tomarVencida`.
- **El archivo se reemplaza siempre; el caption solo si nadie lo editó a mano.**
  Para eso está `ig_queue.caption_editado`, que se enciende cuando el panel
  manda un caption. Sin esa columna, apretar el botón borraba en silencio un
  texto escrito por una persona.
- **Una pieza que ya no está en el repo se deja quieta** y se informa: puede ser
  un anuncio retirado que todavía se quiere publicar.

### ¿Y si el creativo se arregló DESPUÉS de publicarlo?

Para eso está **«Volver a encolar con el archivo de hoy»**, el botón que sale en
las tarjetas ya publicadas (`POST /api/admin/ig/cola/:id/reencolar`).

El sincronizado no toca una pieza publicada, y no debe: su binario es el
registro de lo que salió. Pero VID-01 se publicó con la banda que terminaba en
una raya, se arregló después, y hacía falta poder mandarlo otra vez. El botón
crea una **fila nueva** con el archivo actual, agendada a continuación de la
cola; la tarjeta publicada se queda donde está, con su enlace.

Dos cosas que conviene tener claras:

- **El post viejo no se borra de Instagram.** Por API no se puede: eso se hace a
  mano desde la app. El botón solo prepara el nuevo.
- **No sirve para una pieza subida a mano** (`origen = 'manual'`): no está en
  ningún repo, así que no hay de dónde volver a leerla. El endpoint lo dice.

Las dos vistas salen del mismo sitio: `integrations/instagram/galeria.js`
(`porCodigo()`) y `marketing/ig-ads/galeria.py` leen los mismos archivos, y
`galeria.py` revienta si alguna pieza de `ads.json` no cae en ningún producto —
sin eso, se perdería en la galería y seguiría encolándose en el panel.

## Las cuentas y el token

**Las cuentas se agregan desde el panel** y viven en `ig_cuentas`: el id numérico
que da Meta, el `@` para reconocerla, y el **nombre de la variable de entorno**
que tiene su token.

**El token no se guarda en la base de datos.** El valor vive en Railway y la fila
solo lo nombra. Una base con tokens dentro es una base que no se puede volcar, ni
copiar a local, ni mirar en un backup — y el token de Meta abre la cuenta entera.

- Si todas las cuentas están en el **mismo Business de Meta**, un solo token de
  System User sirve para todas: se deja `IG_ACCESS_TOKEN` en las tres.
- Si son negocios distintos, cada cuenta apunta a su variable
  (`IG_ACCESS_TOKEN_DISENO`, etc.).

Solo se aceptan nombres que empiecen por `IG_`. No es capricho: el nombre lo
escribe quien administra el panel, y sin ese cerrojo una cuenta podría apuntar a
`DATABASE_URL` y mandársela a Meta como token.

Cada pieza de la cola lleva su cuenta. Al cargar la galería se elige una o
**todas las activas** — cada cuenta recibe su propia copia y su propia agenda,
porque publican en paralelo y una no tiene por qué esperar a la otra.

## Encenderlo

En el servidor:

| Variable | De dónde sale |
|---|---|
| `IG_ACCESS_TOKEN` | Token de larga duración con `instagram_basic` + **`instagram_content_publish`** + `pages_read_engagement` |
| `PUBLIC_BASE_URL` | `https://limaflores.pe` — de ahí baja Meta el archivo |
| `IG_USER_ID` | Opcional. Es el respaldo de cuando había una sola cuenta y ninguna tabla |

Y en el panel, la cuenta (o las cuentas) con su id de Meta.

Y después, **el interruptor del panel**. Arranca apagado y no lo enciende un
deploy: publicar es hacia afuera y esa decisión es de una persona. Mientras está
apagado la cola se llena y no sale nada.

## El ritmo, y sacar una tanda ya

Las dos cosas se manejan desde el panel, en la cabecera del publicador:

- **Publicaciones al día** y **a qué horas** (`ig_settings.por_dia` / `horas`).
  Cambia lo que se agende de ahí en adelante; lo que ya está en la cola conserva
  su hora, que para eso cada pieza lleva la suya.
- **Publicar ahora las N siguientes** — el `Publicar ya` de una pieza, pero de a
  varias.

Un detalle que se ve raro si no se sabe: `agenda.parseHoras` **recorta** la lista
de horas al número elegido. Pedir 8 al día con cinco horas puestas sigue dando
cinco, así que el panel avisa en vez de dejar el número mintiendo.

Adelantar **no publica**: mueve la hora a ahora y las toma el vigía, una por
vuelta —o sea una por minuto—. Ese camino es a propósito: sigue respetando el
interruptor y el tope propio, y no es una puerta de atrás para publicar con el
publicador apagado. Si algo de eso va a frenar la tanda, la respuesta lo dice.

## Los topes

- **Cinco al día** por defecto, configurable de 1 a 25 desde el panel, a las 9,
  12, 15, 18 y 21 de Lima.
- Meta permite **50 publicaciones cada 24 h** por cuenta; el panel muestra el
  consumo real (`content_publishing_limit`).
- El vigía tiene además un tope propio del doble de lo configurado, para que un
  error de agenda no dispare una ráfaga.

## Cuando algo falla

Un fallo reintenta a la media hora, dos veces. Al tercero la pieza se queda en
**Falló** con el mensaje de Meta entero —no un «error» a secas— y espera a una
persona. Desde el panel se corrige el caption o la hora y se le da *Publicar ya*.

Errores que se ven seguido:

- *«The user is not an Instagram Business»* — la cuenta no está convertida a
  Business/Creator, o el token no es de esa cuenta.
- *«Media ID is not available»* en un reel — se publicó antes de que Meta
  terminara de procesar el video. El código espera a `FINISHED`, así que si sale,
  es que el video tardó más de cinco minutos.
- Un 403 con *«Host not in allowlist»* no viene de Meta: es un proxy de red
  delante. En Railway no pasa.

## Los archivos

| | |
|---|---|
| `publish.js` | Las llamadas al Graph: contenedor → espera (video) → publicar |
| `formato.js` | Mide el JPEG y decide si es post del feed o historia |
| `publisher.js` | El vigía: una vuelta por minuto |
| `agenda.js` | Las horas de Lima, cinco al día (por cuenta) |
| `galeria.js` | Lee `marketing/ig-ads/` y `marketing/video/` con su copy |
| `feed.js` | Nada que ver con publicar: es la galería de la portada |
| `../../db/ig-queue-store.js` | La cola |
| `../../api/admin-ig.js` | Lo que usa el panel |
| `../../api/ig-media.js` | El archivo que descarga Meta |

## Post, historia o reel

Lo decide **el tamaño del archivo**, no una etiqueta. Nueve de los 33 creativos
son 9:16, y el feed de Instagram solo admite de 4:5 a 1.91:1: todo lo más alto
que 4:5 **lo recorta Meta**, que es donde estaban el titular y el logotipo. Esas
nueve van a historias, que es el sitio para el que se diseñaron.

| El archivo mide | Va a | Contenedor del Graph |
|---|---|---|
| Hasta 4:5 de alto (1080×1350, 1080×1080) | Feed | `image_url` |
| Más alto que 4:5 (1080×1920) | Historias | `media_type: STORIES` |
| MP4 | Reels | `media_type: REELS` |

`ads.json` trae un `placement` que dice lo mismo, y aun así no se usa: es texto
que escribe quien redacta el anuncio, y si alguien cambia la plantilla y olvida
la línea, la pieza vuelve al feed y sale recortada sin que nada avise. El JPEG no
puede mentir sobre cuánto mide. La medición está en `formato.js` y sale del
marcador SOF, así que le basta la cabecera.

Dos cosas de las historias:

- **No llevan caption.** El texto va dentro de la pieza. El panel sigue
  mostrando el copy del anuncio —de ahí sale— pero avisa que no se publica.
- **Duran 24 h.** Por eso se encolan al final: no compiten con los posts por el
  sitio del perfil.

Las que ya estaban en la cola marcadas como post se corrigen solas: el vigía
pasa `repararFormatos()` al arrancar, mira la cabecera de cada pieza sin
publicar y cambia las 9:16. Lo ya publicado no se toca — de Instagram no se
borra por API.

## El caption no se inventa acá

Sale del `primaryText` y los `hashtags` que ya están escritos en
`marketing/ig-ads/ads.json` y `marketing/video/videos.json`. Una sola fuente: si
cambia el copy del anuncio, cambia el caption. Editarlo en el panel afecta a esa
pieza y no al JSON — para cambiarlo en serio, se cambia el JSON.
