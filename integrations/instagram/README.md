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

## Encenderlo

Tres variables en el servidor:

| Variable | De dónde sale |
|---|---|
| `IG_USER_ID` | El id numérico de la cuenta de Instagram **Business/Creator** (no el `@`) |
| `IG_ACCESS_TOKEN` | Token de larga duración con `instagram_basic` + **`instagram_content_publish`** + `pages_read_engagement` |
| `PUBLIC_BASE_URL` | `https://limaflores.pe` — de ahí baja Meta el archivo |

Las dos primeras son las mismas que ya usa la galería de la portada; lo que hay
que sumarle al token es el permiso de publicación.

Y después, **el interruptor del panel**. Arranca apagado y no lo enciende un
deploy: publicar es hacia afuera y esa decisión es de una persona. Mientras está
apagado la cola se llena y no sale nada.

## Los topes

- **Cinco al día**, configurable, a las 9, 12, 15, 18 y 21 de Lima.
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
| `publisher.js` | El vigía: una vuelta por minuto |
| `agenda.js` | Las horas de Lima, cinco al día |
| `galeria.js` | Lee `marketing/ig-ads/` y `marketing/video/` con su copy |
| `feed.js` | Nada que ver con publicar: es la galería de la portada |
| `../../db/ig-queue-store.js` | La cola |
| `../../api/admin-ig.js` | Lo que usa el panel |
| `../../api/ig-media.js` | El archivo que descarga Meta |

## El caption no se inventa acá

Sale del `primaryText` y los `hashtags` que ya están escritos en
`marketing/ig-ads/ads.json` y `marketing/video/videos.json`. Una sola fuente: si
cambia el copy del anuncio, cambia el caption. Editarlo en el panel afecta a esa
pieza y no al JSON — para cambiarlo en serio, se cambia el JSON.
