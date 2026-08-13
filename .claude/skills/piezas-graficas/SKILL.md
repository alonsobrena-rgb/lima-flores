---
name: piezas-graficas
description: Reglas de la casa para crear o tocar cualquier pieza gráfica de Lima Flores — anuncios de Instagram, historias, posts, flyers, tarjetas. Úsalo ANTES de generar, editar o entregar una imagen, y antes de añadir una plantilla al pipeline de marketing/ig-ads/. Cubre formatos, tratamiento de foto, uso del logotipo, qué se puede afirmar y cómo revisar antes de entregar.
---

# Piezas gráficas — Lima Flores

Cada regla de acá salió de un error que ya se cometió. Romperlas es repetirlo.

## Antes que nada: ¿pieza o plantilla?

La campaña **no se diseña pieza por pieza**. `marketing/ig-ads/` es una fábrica:
32 creativos salen de `ads.json` (datos + copy) renderizados por `build.mjs` con
Chromium. Antes de dibujar nada, decide cuál de los dos encargos es:

| El encargo | Lo que se hace |
|---|---|
| Un anuncio más, con una forma que ya existe | Una entrada en `ads.json` + `node marketing/ig-ads/build.mjs IG-33` |
| Una forma nueva (otra composición) | **Una plantilla** en `build.mjs`, que después produce N piezas |
| Algo que no es un anuncio (flyer, dossier, tarjeta) | HTML suelto con los tokens del sistema |

Una plantilla se revisa una vez y rinde para siempre; una pieza suelta hay que
revisarla cada vez. **Ante la duda, plantilla.**

```sh
node marketing/ig-ads/build.mjs                 # los 32 + README
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

### 2. El logotipo es intocable

Va **directo sobre la foto**, nunca dentro de una plaquita, un recuadro o una
banda inventada para él. Dos versiones y solo dos (`marketing/ig-ads/marca/`,
las produce `prep-logo.py` desde `app/public/assets/logo.png`):

- **`logo.png`** — la caligrafía gris, sobre fondo claro.
- **`logo-claro.png`** — la versión en hueso, **la única que se lee** sobre foto
  oscura o sobre panel de tinta.

Altura entre 52 y 84 px sobre lienzo de 1080. Nunca se deforma, nunca se recolorea,
nunca se le pone sombra.

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
