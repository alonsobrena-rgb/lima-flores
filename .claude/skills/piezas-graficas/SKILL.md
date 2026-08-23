---
name: piezas-graficas
description: Reglas de la casa para crear o tocar cualquier pieza gráfica de Lima Flores — anuncios de Instagram, historias, posts, flyers, tarjetas. Úsalo ANTES de generar, editar o entregar una imagen, y antes de añadir una plantilla al pipeline de marketing/ig-ads/. Cubre formatos, tratamiento de foto, uso del logotipo, qué se puede afirmar y cómo revisar antes de entregar.
---

# Piezas gráficas — Lima Flores

Cada regla de acá salió de un error que ya se cometió. Romperlas es repetirlo.

## Antes que nada: ¿pieza o plantilla?

La campaña **no se diseña pieza por pieza**. `marketing/ig-ads/` es una fábrica:
33 creativos salen de `ads.json` (datos + copy) renderizados por `build.mjs` con
Chromium. Antes de dibujar nada, decide cuál de los dos encargos es:

| El encargo | Lo que se hace |
|---|---|
| Un anuncio más, con una forma que ya existe | Una entrada en `ads.json` + `node marketing/ig-ads/build.mjs IG-33` |
| Una forma nueva (otra composición) | **Una plantilla** en `build.mjs`, que después produce N piezas |
| Algo que no es un anuncio (flyer, dossier, tarjeta) | HTML suelto con los tokens del sistema |

Una plantilla se revisa una vez y rinde para siempre; una pieza suelta hay que
revisarla cada vez. **Ante la duda, plantilla.**

```sh
node marketing/ig-ads/build.mjs                 # los 33 + README
node marketing/ig-ads/build.mjs IG-22 IG-30     # solo esos, para iterar
node marketing/ig-ads/build.mjs --pruebas       # el carril de plantillas sin aprobar
python3 marketing/ig-ads/galeria.py             # la galería para el cliente
```

## Las cuatro que no se negocian

### 1. Manda el producto: entero y grande

La foto del producto es el contenido, no el fondo. **Nada cortado, nada dentro de
un marco.** El diseño va encima de la foto, no al lado en una cajita.

Cómo lo resuelve el pipeline, y por qué:

- `fotos/prep-fotos.py` recorta al producto las tomas que traían fondo de sobra y
  **anota el color de ese fondo** en `fotos/encuadres.json`.
- Con eso la foto entra con `contain` sobre un contenedor **del mismo color
  medido**: el producto nunca se corta y tampoco flota en medio del vacío.
- Las tomas que ya llenan el encuadre entran a sangre (`cover`).
- Excepción: en una franja mucho más ancha que alta se usa la toma original, no
  el recorte — un recorte vertical ahí quedaría minúsculo.
- La tira de tres productos recorta **siempre**, aunque gane poco, para que las
  tres fotos vecinas entren del mismo tamaño.

**`cover` recorta por definición, y eso no se juzga de memoria.** Está bien
cuando el encuadre ES la foto —un macro, una toma de ambiente— y está mal cuando
la foto es un objeto sobre ciclorama: ahí se lleva un pedazo del producto y el
JPEG sale impecable igual. Así se fue IG-25 con la maceta cortada al ras de la
ventana, y con ella catorce piezas más que nadie había mirado de cerca: la base
del ramo, el filo de la caja, el borde del florero.

`build.mjs` ya no permite que vuelva a pasar en silencio. Una sonda en `base()`
le pregunta al navegador cuánto se come el `cover` de cada foto —el número
vuelve por `--dump-dom` en la misma corrida del `--screenshot`, gratis— y pasado
el 4% el build **revienta** y nombra las piezas. Dos salidas, una por pieza:

| La foto es | Qué se pone en `creative` |
|---|---|
| Un objeto sobre fondo de estudio | `"fit": "contain"` — y casi siempre `"alas": true` |
| Un macro o una toma de ambiente donde el recorte es el punto | `"recorte": "<el motivo>"` |

El motivo se escribe, no se piensa: queda en `ads.json`, que es donde se puede
volver a leer dentro de seis meses.

**Las alas.** Un `contain` deja dos franjas vacías a los lados, y pintarlas del
color medido **no alcanza**: el ciclorama de estas tomas es un degradado, así que
contra un relleno plano el filo de la foto se ve como el recuadro que prohíbe la
regla 2 — en IG-25 el salto era de 18 niveles en el lado derecho. Con
`"alas": true` el relleno sale de la propia foto: cada ala estira su franja de
borde, el degradado sigue fila por fila y la unión no existe. Es el mismo
hallazgo que ya tenía anotado `marketing/whatsapp/cabeceras.py`.

Hay que decirle por dónde queda el hueco, porque cada ala estira un borde
distinto: `"alas": true` para los costados, `"alas": "v"` para arriba y abajo
(el caso de IG-26, donde el hueco se leía como una franja blanca al tope). No se
adivina —depende de la caja que da la plantilla— pero tampoco queda a la buena
fe: la sonda compara lo declarado contra lo que midió el navegador y revienta el
build si no coinciden. El `contain` de una foto ya recortada no las necesita:
`prep-fotos.py` deja el borde en el mismo color que midió.

**Y hay un tercer caso: que el borde de la foto no sea fondo.**
`tulipanes-de-amor` termina en la mesa, y al entrar entera ese degradado caía
justo contra el relleno de abajo y se leía como una línea recta cruzando la
pieza, detrás del titular de IG-13. Para eso está `"sangra": 4` — recorta un 4%
por lado *después* de encajar la foto, se lleva la mesa y no toca el ramo, que
empieza al 6% de la altura. Se aplica a la foto y a las alas, así que las dos
siguen mostrando el mismo borde.

Un detalle que se paga caro si se olvida: cuando el anuncio pide `contain` en una
franja, conviene la foto **recortada**, no la original. Misma imagen, menos
ciclorama, producto más grande dentro de la misma caja — en IG-35, 682 px de
ancho en vez de 521.

### 2. El logotipo es intocable

Va **directo sobre la foto**, nunca dentro de una plaquita, un recuadro o una
banda inventada para él. Dos versiones y solo dos (`marketing/ig-ads/marca/`,
las produce `prep-logo.py` desde `app/public/assets/logo.png`):

- **`logo.png`** — la caligrafía gris, sobre fondo claro.
- **`logo-claro.png`** — la versión en hueso, **la única que se lee** sobre foto
  oscura o sobre panel de tinta.

Altura entre 52 y 84 px sobre lienzo de 1080. Nunca se deforma, nunca se recolorea,
nunca se le pone sombra.

**Un velo tampoco es un sitio para apoyarlo.** Un degradado sobre la foto existe
por una sola razón: que se lea un texto encima. Si no hay texto debajo del velo,
el velo sobra — no está protegiendo nada, está tapando el producto, y es la misma
banda inventada de la que habla el párrafo de arriba. Ya pasó en un video: se
puso un lavado blanco arriba para que el logotipo cayera en un campo limpio, y lo
único que hacía era comerse media toma. El logotipo se apoya en la foto y punto;
si sobre esa foto no se lee, se cambia a la versión clara, no se pinta una nube
debajo.

**Y hay una vuelta más, que costó una ronda de correcciones del cliente: un velo
puesto donde la foto YA es vacío tampoco protege nada.** `cuadro` arrastraba un
degradado radial en la esquina superior derecha, y en las tres tomas que usan esa
plantilla la esquina era fondo de estudio: no aclaraba nada que hiciera falta
aclarar, y a cambio lavaba el globo morado de IG-30 y el respaldo del sofá de
IG-16. Se veía como una nube blanca encima del producto, que es exactamente como
lo describió el cliente.

**Y cuando el velo sí hace falta, tiene que morir en alfa 0 y llegar por
smoothstep.** Un tramo lineal tiene la derivada rota en sus dos puntas y el ojo
lee esa esquina como el borde de un recuadro aunque no haya recuadro; un velo
que termina en alfa .2 y de ahí salta a nada deja una raya recta cruzando la
pieza. Las dos cosas pasaron a la vez en la banda de VID-01: 51 niveles de
salto en un píxel. En video se nota más todavía, porque la toma se mueve y la
línea se queda quieta. Las curvas están en `PASOS` (`marketing/ig-ads/build.mjs`
y `marketing/video/build.mjs`); no se escribe un `linear-gradient` a mano.

Y se comprueba midiendo el alfa del PNG, no mirando: al arreglarlo se me fue una
rampa al revés que hacía aparecer el velo de golpe —237 niveles en un píxel, peor
que el problema original— y a ojo, sobre una foto, no se veía.

**El orden correcto es al revés del instinto.** Primero se busca dónde la foto ya
está vacía, y ahí se pone el texto; el velo es el último recurso, para cuando no
hay vacío en ninguna parte. Y ese vacío **se mide, no se mira**: se simula el
encuadre (`cover` + `object-position`) sobre la foto y se saca la luminancia del
5% más oscuro de la caja donde iría el texto. Lo que dieron las cuatro piezas:

| | Dónde acabó el texto | Lo que dijo la medición |
|---|---|---|
| `IG-22` | columna derecha | 231 — fondo de estudio puro |
| `IG-30` | columna derecha | 174; el globo pasa por debajo del bloque |
| `IG-16` | franja al tope | a la derecha, el brazo de madera de la silla: 68, casi negro |
| `IG-11` | columna abajo a la izquierda | centrada no había vacío; al ras izquierdo aparece uno de 585 × 225 en 239 |

Dos cosas que salieron de ahí y sirven siempre: **si la foto no deja hueco donde
va el texto, mueve el encuadre antes que pintar un velo** (IG-11 pasó a
`position: 0% 50%` y el titular entró entero sobre el ciclorama), y **si el hueco
es ancho y bajo, acuesta el bloque en una línea** en vez de apilarlo (en IG-16
apilarlo metía el logotipo sobre el celofán).

### 3. Nada inventado

Precios, medidas, tiempos, composición y contenido salen de `db/products.seed.json`,
de la landing o del checkout. **Si un dato no está ahí, no se escribe.**

Ya pasó: una sección de la web afirmaba «florece entre ocho y doce semanas»,
«60–70 cm» y «maceta de cerámica». Nada de eso existía en el catálogo.

La galería lleva una tabla que dice de dónde sale cada afirmación. Si una pieza
nueva afirma algo, esa tabla tiene que poder citarlo.

Ojo con la entrega: la copia histórica promete «franja de 30 minutos con 24 h de
anticipación», pero el checkout React da **tres franjas de cuatro horas**. Hasta
que se decida cuál es la verdad, **no escribas la franja en una pieza nueva** —
«al día siguiente» sí es seguro.

### 4. Mirar cada pieza antes de entregarla, y de a una

No se entrega un lote sin abrir. Se perdió una tarde optimizando una métrica
mientras las piezas salían cortadas y con marcos.

Abrir el JPEG y comprobar, en este orden: ¿el producto está entero? ¿el logo se
lee sobre lo que tiene debajo? ¿el texto entra en el área segura? ¿lo que afirma
se puede citar?

**Una hoja de contactos no sustituye mirar la pieza.** A 330 px de ancho catorce
recortes pasaron por buenos, y al abrirlos uno por uno la base del ramo estaba
cortada en casi todos. La hoja sirve para decidir a cuáles hay que entrar, no
para aprobar.

**Cuando la duda es «¿esto corta producto o solo fondo?», hay una prueba que no
se equivoca y no necesita ojo.** No hace falta encontrar el recuadro del producto
en toda la foto —eso falla con un ciclorama en degradado, ya se intentó tres
veces—: basta mirar **la franja que el recorte deja fuera** y preguntar qué
proporción de esos píxeles no es fondo. Es una prueba local, sobre la tira
descartada, y es la que separó IG-07 (0,1%: se va ciclorama) de IG-19 (66%: se va
la caja). Ojo con leerla sola: una sombra o el filo de la mesa también dan alto,
así que decide a cuál pieza abrir, no si está bien.

## Formatos y área segura

| Sitio | Lienzo | Área segura |
|---|---|---|
| Feed de Instagram (4:5) | **1080 × 1350** | 76 px por lado |
| Historias / Reels (9:16) | **1080 × 1920** | **372 px arriba y abajo** — ahí van la UI de Instagram, el avatar y la caja de respuesta |

Los 372 px de las historias no son un margen estético: es lo que Instagram tapa.
Un titular que entra ahí no existe.

## El sistema, aplicado a una pieza

Los tokens salen de `design/direcciones/florencia.css` — `build.mjs` los **lee
del CSS**, no los copia, para que un cambio del sistema llegue solo. Ver
[`DESIGN.md`](../../../DESIGN.md) para el sistema completo. Lo mínimo:

- **Cormorant Garamond en itálica peso 500** para el titular; **Jost** para todo
  lo demás. Dos familias, ninguna más.
- La jerarquía es la escala: un rótulo de 11 px y un titular enorme, sin tamaños
  intermedios que rellenen.
- Rosa `#9E2B5E` para la palabra que manda. Sobre tinta, `#D584A1`.
- Filete de 1 px `#E6E5E3` para separar. **Nunca una tarjeta, nunca una sombra.**
- Si una pieza necesita un color que no está en el ramo del logotipo, está mal la
  pieza.

## Trampas del render (probadas, no teóricas)

- **Chromium no baja de 500 px de viewport**, y su alto queda ~78 px por debajo
  del `--window-size`. Se pide de más y se recorta.
- **Nada se ancla al viewport: todo se dibuja dentro de una caja del tamaño
  exacto de la pieza.** Es la otra mitad de la trampa de arriba y es la que se
  cuela: si el `bottom:0` de un velo cuelga del viewport y no de un contenedor
  posicionado de 1080×1920, el velo termina cien píxeles antes del filo y queda
  una franja de foto cruda abajo, con un corte recto. `build.mjs` lo resuelve con
  `body{position:relative;width;height}` y `marketing/video/build.mjs` con un
  `#lienzo` de medidas fijas. **Y después se comprueba la medida del PNG**: si no
  mide lo que tiene que medir, el build revienta en vez de entregar la franja.
- **Sin `<meta charset>`, Chromium abre `file://` como windows-1252** y parte
  todos los acentos.
- **Una imagen es un elemento reemplazado**: con `left` y `right` puestos y
  `width:auto`, el navegador ignora `right` y usa el tamaño del archivo. Va dentro
  de un div con los cuatro lados y el 100 % adentro.
- Fotos y fuentes van **embebidas en base64**: el render no debe depender de la
  red ni del orden de carga.

## Si el encargo es generar una imagen con IA

Higgsfield (`integrations/higgsfield/`) está para eso.

1. **Por defecto, la foto de producto no se genera.** El catálogo es fotografía
   real, y una orquídea inventada es una promesa que la florería no puede
   cumplir. Fondos, texturas y video ambiente: adelante, sin preguntar.
2. **Salvo que el cliente lo pida.** Entonces se hace: es su decisión, no una
   regla del sistema. Dos cosas al hacerlo:
   - No reemplaza a la foto de catálogo de un producto que se vende. Ahí manda la
     foto real, siempre.
   - Se anota en la pieza —en `ads.json` o en el README que genera `build.mjs`—
     que esa imagen es generada. Dentro de seis meses nadie se acuerda, y la
     tabla de fuentes existe justamente para no tener que adivinar.
3. No lo propongas tú. Si una pieza pide una foto que no existe en el catálogo,
   dilo y pregunta; no la generes por tu cuenta para rellenar el hueco.
4. Requiere que `platform.higgsfield.ai` esté permitido en la política de red del
   entorno, y eso solo aplica a una sesión abierta **después** de configurarlo.
