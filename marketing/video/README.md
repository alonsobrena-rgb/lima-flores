# Anuncios en video

La misma fábrica que `marketing/ig-ads/`, para Reels e historias: los datos y el
copy viven en `videos.json`, y `build.mjs` los monta sobre la toma. Se cambia el
JSON, se vuelve a correr, y no se toca un video a mano.

Hace falta **ffmpeg en el PATH**. Si no está en el sistema, sirve el que trae
`pip install imageio-ffmpeg` — es el caso que ya contempla `dur()`, que saca el
largo del clip de lo que ffmpeg escribe en stderr en vez de pedir ffprobe,
justamente porque esa instalación trae el codificador y no la sonda.

```sh
node marketing/video/build.mjs            # todos
node marketing/video/build.mjs VID-01     # solo ese
python3 marketing/video/musica.py 14      # rehacer la cama de música, 14 s
```

El resultado sale también en la galería del cliente
(`limaflores.pe/galeria`), en la ficha del producto que le toca. Ahí es lo único
que no va embebido en la página: el MP4 se sirve por su propia URL
(`/galeria/VID-01.mp4`), así que si se despliega la galería hay que desplegar
`creativos/` con ella.

| | |
|---|---|
| `clips/` | Las tomas de la florería, tal como llegan |
| `creativos/` | Lo que se sube a Instagram, 1080×1920 |
| `musica/` | La cama de música. Se genera sola; no se versiona |
| `.tmp/` | Los rótulos en PNG y su HTML, para depurar un render |

## Cómo se arma

Tres capas y nada más:

1. **La toma**, escalada a 1080×1920 con lanczos. No se recorta: los clips ya
   vienen en 9:16.
2. **El rótulo** —logotipo arriba, titular, bajada y precio abajo— dibujado en
   HTML con las fuentes y los tokens del sistema, exportado como PNG transparente
   y superpuesto con un fundido de entrada al segundo. ffmpeg no sabe componer
   Cormorant en itálica; Chromium sí, y es el mismo que dibuja los creativos
   fijos.
3. **La placa de cierre**: 2,6 s de blanco con el logotipo y el dato. Es la única
   pantalla que no es la toma.

**Hay un solo lavado y está abajo**, debajo del titular. No es decoración: el
rótulo está quieto y la toma se mueve, así que sin él el texto cae unas veces
sobre la pared y otras sobre el ramo. Arriba hubo otro, para que el logotipo se
apoyara en un campo limpio, y se quitó: no cubría texto, solo tapaba el producto.
La regla, corta: **un velo existe para que se lea un texto encima; si no hay
texto, no hay velo.** Y de ahí sale la forma que tiene: **es una banda atada al
bloque de texto, no un degradado que sube desde el filo de abajo.** Cubriendo
desde el filo pasaba una de dos, y las dos se probaron: flojo, los pétalos se
veían por detrás de las letras; fuerte, se tragaba la caja del arreglo y abajo
solo quedaban las flores. Atado al texto, tapa las dos líneas y suelta el resto —
la base de la caja y el banco se ven.

Como la banda vive dentro del contenedor del texto, crece con la copia: si el
titular pasa a dos líneas no hay que recalcular un solo píxel.

**Las dos puntas van por smoothstep, y la de abajo muere en alfa 0.** Con tramos
lineales la banda dejaba dos rayas rectas cruzando el anuncio: una donde el
blanco dejaba de ser sólido —un tramo recto tiene la derivada rota en sus dos
puntas y el ojo lee esa esquina como el borde de un recuadro— y otra, la peor,
donde el velo se cortaba: terminaba en alfa .2 y de ahí saltaba a nada, 51
niveles en un píxel. En video se nota todavía más que en una foto, porque la
toma de abajo se mueve y la línea se queda quieta. Es la misma smoothstep de
`marketing/ig-ads/build.mjs`, y la regla de la que salió está en el README de
allá: *los velos no llevan canto*. Medido después del arreglo, el salto más
grande en toda la caída es de 2 niveles por píxel.

**Área segura: 372 px arriba y abajo.** Es lo que tapan la UI de Instagram, el
avatar y la caja de respuesta. Un titular que entra ahí no existe.

**El rótulo se dibuja dentro de `#lienzo`, una caja de 1080×1920 posicionada.**
No es un detalle de estilo: el viewport de Chromium llega más corto que el
`--window-size` que se le pide, así que un `bottom:0` colgado del viewport deja
el velo cien píxeles antes del filo y una franja de video crudo debajo, con un
corte recto. Pasó una vez. Por eso, además, `png()` comprueba que el archivo mida
exactamente 1080×1920 y revienta el build si no.

## La música

`musica.py` la sintetiza con numpy: un arpegio lento en fa mayor con cola larga y
un colchón de dos notas. No es una pista de banco, así que no hay licencia que
revisar ni reclamo de derechos en Instagram, y suena igual en cada render.

Si algún día se compra o se graba una pista de verdad, se deja el wav en
`musica/` con el mismo nombre (`cama-<segundos>s.wav`) y `build.mjs` la usa sin
cambiar una línea.

## Las reglas son las mismas

Las de `.claude/skills/piezas-graficas/SKILL.md`, sin excepción: manda el
producto, el logotipo no se toca, nada inventado —precio, composición y tiempos
salen de `db/products.seed.json`, de la landing o del checkout— y cada pieza se
mira antes de entregarla. En video eso quiere decir mirar el arranque, un
fotograma del medio y la placa final, no solo el primero.

## Los videos

| Código | Producto | Embudo | Titular |
|---|---|---|---|
| `VID-01` | Boxsito Crespito · S/180 | Frío | Osito, globo y mini rosas |

## El catálogo (`build-catalogo.mjs`)

`VID-01` es una toma real por producto. Para vender la carta entera —no un solo
arreglo— no hay toma de video de cada línea (orquídeas, arreglos con rosas, box
de rosas, tulipanes en florero, ramo, suscripción), así que `build-catalogo.mjs`
arma un Reel aparte a partir de `catalogo.json`, con estas diferencias:

- **La toma es la foto de catálogo, no un clip.** Nunca una foto generada: la
  regla de `piezas-graficas/SKILL.md` sigue siendo "el catálogo es fotografía
  real". El movimiento sale de un Ken Burns propio (zoom lento y parejo al
  centro, `zoompan` de ffmpeg) sobre esa foto.
- **Cada foto de producto se recorta a mano al bulto real** (campo `crop` en
  `catalogo.json`, en píxeles del archivo original) antes de entrar a la caja
  del video. La toma de estudio trae mucho fondo de sobra alrededor de un
  objeto angosto y alto —una maceta de orquídea, un ramo envuelto—, y sin
  achicar ese sobrante el producto sale chico aunque la caja de destino sea
  grande. El recorte se mira uno por uno, igual que cualquier pieza: un bbox
  calculado solo (se probó y se descartó) corta producto por error, que es
  justo lo que prohíbe la regla 1.
- **El color de relleno se mide en el borde de la foto YA recortada**, no en
  la esquina de la foto original ni en `fotos/encuadres.json` de los
  creativos fijos: esos números vienen de un recorte distinto y, si se
  reusan tal cual, dejan un rectángulo visible —el fondo de estudio tiene
  viñeta, así que el color en una esquina lejana no es el color en el borde
  real que toca el relleno—. Se mide con `ffmpeg ... crop=…,scale=1:1` sobre
  el archivo ya recortado, en una tira ancha lejos de las esquinas.
- **Tres tipos de toma por `item.fit`**: `"contain"` (foto de estudio, fondo
  plano, sin velo —el caso de arriba), `"cover"` (foto de ambiente a sangre,
  con velo detrás del texto: la suscripción y varias fotos de orquídeas que
  mandó el cliente, tomadas en su casa, no en estudio) y `"video"` (un clip
  real del cliente, escalado y recortado a sangre igual que `cover` pero sin
  Ken Burns encima —ya se mueve solo, y sumarle zoom es mover lo que ya se
  mueve—). `cover` y `video` son la excepción que ya contempla la regla 1:
  el recorte a sangre vale cuando la foto ES de ambiente, no de un objeto
  sobre ciclorama.
- **El rótulo tiene que entrar en bucle** (`-loop 1 -t <segundos>`) igual que
  en `build.mjs`: una imagen suelta es un solo fotograma para ffmpeg, y el
  fundido de entrada no tiene sobre qué animar —se queda congelado en el alfa
  de ese único cuadro y el texto nunca aparece. Ya estaba anotado en
  `build.mjs`; acá se repitió el mismo bug al escribirlo de nuevo.
- **El velo lleva smoothstep en las dos puntas, no solo en la de abajo.** La
  primera versión metía la subida como un corte duro (`transparent,
  transparent 190px, rgba(...)`) en vez de la curva `sube()` de `build.mjs`,
  y el rótulo que cae cerca de esa unión —la etiqueta de categoría, arriba
  del titular— salía sobre una franja que todavía no había terminado de
  aclarar. Con `sube(150,.94)` en la punta de arriba y `baja(170,.94)` en la
  de abajo, igual que el rótulo de una sola toma, el texto entero cae sobre
  blanco ya resuelto.
- **El marco fino (`MARCO_PAD`, 3px en `--leaf`, el verde del propio ramo del
  logotipo) va pegado a la caja de la foto** en los tramos `contain`, y se
  omite en `cover`/`video`: puesto sobre una foto a sangre no tiene fondo
  plano donde apoyarse y termina cruzando el producto, que es la misma banda
  inventada que prohíbe la regla del logotipo.
- **Las fotos y videos que manda el cliente por WhatsApp** —no son parte del
  catálogo del sitio, así que no viven en `app/public/products/`— se guardan
  en `marketing/video/fotos-cliente/`, con nombre descriptivo en vez del
  nombre de WhatsApp. Antes de sumar una a `catalogo.json` hay que tener
  nombre y precio confirmados por el cliente: una foto sin esos dos datos no
  entra al video, por más que ya esté en el repo.

```sh
node marketing/video/build-catalogo.mjs
```

Sale como `creativos/VID-CATALOGO.mp4`. Nombre, precio y el dato de la
suscripción (S/130 al mes, cada 15 días) salen de `db/products.seed.json`, de
`app/src/data/plans.ts` o directamente del cliente cuando el producto es nuevo
y todavía no está publicado en la tienda; el titular de la intro es el mismo
del hero del sitio ("Llega mañana. Se queda meses."), no uno nuevo.
