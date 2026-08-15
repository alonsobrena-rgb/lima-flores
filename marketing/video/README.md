# Anuncios en video

La misma fábrica que `marketing/ig-ads/`, para Reels e historias: los datos y el
copy viven en `videos.json`, y `build.mjs` los monta sobre la toma. Se cambia el
JSON, se vuelve a correr, y no se toca un video a mano.

```sh
node marketing/video/build.mjs            # todos
node marketing/video/build.mjs VID-01     # solo ese
python3 marketing/video/musica.py 14      # rehacer la cama de música, 14 s
```

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

Los dos lavados —arriba y abajo— no son decoración: el rótulo está quieto y la
toma se mueve, así que sin ellos el texto cae unas veces sobre la pared y otras
sobre el ramo, y el logotipo se cruzaba con el que va impreso en la tarjeta del
propio arreglo.

**Área segura: 372 px arriba y abajo.** Es lo que tapan la UI de Instagram, el
avatar y la caja de respuesta. Un titular que entra ahí no existe.

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
