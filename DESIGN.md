# Florencia — Style Reference

> Lima Flores. Blanco total, aire, y una sola rosa — la del propio ramo del
> logotipo. La página respira antes de que aparezca el catálogo.

**Theme:** light (única — no hay modo oscuro; el blanco es la marca)

Florencia es el sistema de una florería de Lima, y su regla de origen es que
**los colores no se eligieron: se midieron**. `design/colores-logo.py` agrupa por
tono los píxeles del ramo acuarelado del logotipo, descarta el papel y los grises
de la marca, y devuelve la familia dominante de cada tono. El ramo resulta ser
52 % rosa, 29 % verde, 13 % durazno y crema. De ahí salen el rosa `#9E2B5E`, el
verde `#88A65C` y la tinta cálida `#2A2623`. El fondo es blanco puro, sin marfil,
sin acuarelas de fondo y sin manchas decorativas: la foto de producto es lo único
que aporta color, y todo lo que compita con ella sobra.

La estructura la hace la tipografía, no las cajas. Un display serif en **itálica**
(Cormorant Garamond, peso 500) para todo lo que tenga que sonar, una sans
geométrica (Jost) para todo lo que tenga que leerse, y una sola línea de 1 px
—nunca una tarjeta, nunca una sombra— para separar. La jerarquía es la escala: de
un rótulo de 11 px a un titular de 150 px en la misma página, sin nada en el
medio.

---

## Tokens — Colors

| Nombre | Valor | Token | Rol |
|---|---|---|---|
| Blanco total | `#FFFFFF` | `--bg-page` | El lienzo. Toda sección vive directamente sobre él, sin contenedor |
| Gris de sección | `#F4F4F3` | `--bg-alt` | Segunda superficie: bandas alternas y el hueco de una foto que falta |
| Tinta cálida | `#2A2623` | `--text-strong` | Titulares, y el fondo de las dos únicas zonas oscuras (una sección y el pie) |
| Tinta de cuerpo | `#4A443F` | `--text-body` | Párrafos |
| Apagado | `#6E6862` | `--text-muted` | Rótulos secundarios y notas al pie de un dato |
| Gris del logotipo | `#A2A19F` | `--text-faint` | Medido sobre el archivo del logo. Texto desactivado |
| Filete | `#E6E5E3` | `--border` | La única línea del sistema. 1 px, siempre |
| Filete fuerte | `#CBC9C6` | `--border-strong` | Filete bajo un enlace, o borde de un control |
| Rosa del ramo | `#9E2B5E` | `--accent` | El acento. Rótulos, la palabra que manda dentro de un titular, el botón de compra |
| Rosa hondo | `#842049` | `--accent-hover` | Solo el hover del rosa |
| Rosa claro | `#D584A1` | `rosa-300` | El acento cuando el fondo es tinta: el `#9E2B5E` sobre oscuro no se ve |
| Verde del ramo | `#88A65C` | `--leaf` | Tercer color, casi nunca. Disponibilidad, frescura |
| Durazno | `#FBF0DE` | `pesca-100` | El único fondo cálido: un velo en el borde superior del hero |

**Regla de color:** no hay más. Si un diseño necesita un color nuevo, está mal el
diseño. El caso probado: una sección llegó a tener un morado `#5E4A55` inventado
para ella sola, y se notaba desde el otro lado de la página.

---

## Tokens — Typography

### Cormorant Garamond — display, **siempre en itálica peso 500**

No es decoración: está escrito en el sistema. Se aplica por clase (`.display`),
nunca forzando la serif en todo el documento. Dentro de un titular, un `<em>`
toma el rosa del ramo: así se marca la palabra que manda.

- **Sustituto:** EB Garamond o Cormorant. Evitar Playfair Display — se probó y
  pesa en cada carga sin aportar carácter.
- **Pesos:** 500 (display), 600 (títulos de sección redondos)
- **Tracking:** `-0.018em`
- **Interlínea:** 0.92–1.03 (más ajustada cuanto más grande)

### Jost — todo lo demás

Cuerpo, rótulos, botones, datos, navegación.

- **Sustituto:** Inter o Söhne. Cualquier grotesca neutra sirve; lo que define al
  sistema es la escala, no la letra.
- **Pesos:** 400, 500

### Escala

| Rol | Tamaño | Interlínea | Tracking | Familia |
|---|---|---|---|---|
| rótulo | 11–12 px | 1.4 | `0.22em`, versalita, en rosa | Jost 500 |
| nota | 10–11 px | 1.3 | `0.18em`, versalita | Jost 500 |
| cuerpo chico | 15 px | 1.5 | — | Jost 400 |
| cuerpo | 16–17 px | 1.6 | — | Jost 400 |
| entrada | 19 px | 1.55 | — | Jost 400 |
| dato / título de ficha | 19–22 px | 1.2 | `-0.018em` | Cormorant *italic* 500 |
| título de sección | `clamp(2.3rem, 5.4vw, 4.6rem)` | 0.98 | `-0.018em` | Cormorant *italic* 500 |
| cartel | `clamp(2.4rem, 6.4vw, 5.6rem)` | 0.98 | `-0.018em` | Cormorant *italic* 500 |
| titular de portada | `clamp(2.9rem, 9.7vw, 158px)` | 0.94 | `-0.018em` | Cormorant *italic* 500 |

El salto entre el rótulo de 11 px y el titular de 150 px es deliberado y es la
firma del sistema. No hay tamaños intermedios que rellenen.

---

## Tokens — Spacing & Shapes

**Densidad:** cómoda. El aire es el lujo.

- **Radios:** 4 px (imagen), 8 px, 14 px, `999px` (píldora). Nada más.
- **Margen de página:** `24px` móvil · `32px` sm · `48px` lg. **Todo cuelga del
  mismo borde izquierdo**: no hay columna centrada ni ancho máximo.
- **Alto de sección:** `clamp(76px, 11vh, 132px)` arriba y abajo.
- **Medida de lectura:** 42–65 caracteres. El cuerpo nunca cruza la página entera.
- **Elevación: no hay.** Ni sombras, ni glass, ni capas. La única profundidad del
  sistema es el velo cálido del borde superior del hero.

---

## Componentes

### Rótulo de sección
Versalita de 11–12 px, `letter-spacing: .22em`, **en rosa**, no en gris. Abre toda
sección. Nunca numerado: una numeración («No. 02 · …») solo se justifica si el
contenido es de verdad una secuencia.

### Título de sección
Cormorant itálica 500 en `clamp(2.3rem, 5.4vw, 4.6rem)`, alineado a la izquierda,
sin ancho máximo. Un `<em>` adentro para la palabra en rosa. A la derecha, si hace
falta, un enlace de texto — nunca un botón.

### Enlace de texto
El único elemento interactivo en contexto de lectura. 14–15 px Jost 500, con un
filete de 1 px permanente debajo (`#CBC9C6`) y un subrayado rosa que se dibuja de
izquierda a derecha al pasar por encima. **Nunca una píldora rellena.**

### Botón de compra
La excepción, y solo para una acción real (agregar al carrito, pagar). Píldora
rosa `#9E2B5E`, versalita de 13 px `letter-spacing: .18em`, texto blanco. Sobre
fondo de tinta se invierte: píldora clara, texto tinta — el rosa sobre oscuro no
se ve.

### Filete de sección
1 px en `#E6E5E3`, de borde a borde. **Es el único elemento estructural del
sistema**: reemplaza a toda tarjeta, panel, recuadro y fondo alterno.

### Ficha de producto
Foto cuadrada sin recuadro (se acerca un 4 % al pasar por encima), y debajo un
filete. Sobre el filete: categoría en versalita a la izquierda y precio a la
derecha, en la misma línea; el nombre debajo, en Cormorant itálica. **El precio
nunca es más grande que el nombre.**

### Hero
Cartel. Rótulo arriba, titular gigante centrado, y la foto de producto calada
—sin fondo, sin marco, sin sombra— **por delante del titular**, saliéndose por
abajo. El texto no se corre para dejarle sitio: se deja tapar. Debajo, una banda
con filete que lleva los enlaces y tres datos. Ver «El movimiento del hero».

### Pie de página
Fondo tinta `#2A2623`. El logotipo va en blanco plano (`brightness-0 invert`),
nunca la acuarela. Tres columnas de 14 px: contacto, catálogo, legal.

---

## Do's and Don'ts

### Do
- Medir el color antes de elegirlo. Todo color sale del ramo del logotipo.
- Usar Cormorant **en itálica peso 500** para todo lo que sea display, y Jost para
  el resto. Dos familias, ninguna más.
- Dejar que la escala haga la jerarquía: rótulo de 11 px y titular de 150 px, sin
  escalones intermedios.
- Separar con aire y un filete de 1 px.
- Colgar todo del mismo margen izquierdo, sin columna centrada.
- Dejar que el producto sea lo único con color. Una foto calada apoyada sobre el
  blanco vale más que cualquier ilustración.
- Poner el logotipo directo sobre la foto, nunca dentro de una plaquita. Sobre
  fondo oscuro, en blanco plano.

### Don't
- **No inventar datos.** Precios, medidas, tiempos de floración y contenidos salen
  del catálogo (`db/products.seed.json`), de la landing o del checkout. Si un dato
  no está ahí, no se escribe. Es la regla más dura del sistema.
- No prometer entrega el mismo día. **Las entregas son al día siguiente**: se
  elige el día y una franja de 30 minutos, con 24 h de anticipación.
- No usar tarjetas, paneles, badges, bordes de color ni sombras.
- No poner texto blanco sobre un degradado oscuro encima de una foto de producto
  para poder leerlo: bajar el texto y dejar la foto entera.
- No sumar un color. Ni un morado de sección, ni un salvia que no está en el logo.
- No recortar el producto en una pieza gráfica: entero y grande, con el diseño
  encima.
- No usar el marfil viejo `#F6F3EC` ni fondos florales generados. El fondo es
  blanco.

---

## El movimiento del hero

Es la única «animación conceptual» del sistema y conviene entenderla antes de
copiarla: **la planta pasa por delante del titular**. La foto va en `z-20`, el
titular en `z-10`, y el titular se coloca a la altura donde la planta es *fina*
—tallos, no pétalos— para que la oclusión se vea sin volver ilegible el texto.

Si la foto tiene la masa arriba (flores) y lo fino abajo (tallos), el titular baja.
Si es al revés, el titular sube. La regla no es «poner la foto encima»: es que el
texto cruce la parte rala de la planta.

En pantallas chicas la foto se **agranda** (hasta 190 % del ancho) en vez de
achicarse: al reducirla, toda la masa de flores cae justo sobre las letras. Y el
titular se escalona: una línea arriba a la izquierda, la otra abajo a la derecha,
para que cada una caiga en un hueco distinto de la planta.

El mismo movimiento abre las páginas interiores, con el producto **calado** en vez
de la foto entera: `EncabezadoCalado` en `app/src/components/sections/Seccion.tsx`.
Los calados se hacen con `design/calar.py` (rembg, fondo fuera) desde la foto real
del catálogo y viven en `app/public/calados/`. Dos avisos:

- **No toda foto cala.** Las tomas cenitales quedan como una mancha y las varas
  finas de orquídea se pierden. Sirven las siluetas —una corona sobre trípode, un
  ramo de pie—, que además dejan huecos por donde se lee el titular.
- **El texto se deja tapar, pero no borrar.** Que el bulto muerda el final del
  titular está bien; que se coma una línea entera, no. En escritorio el texto vive
  en el 60 % de la izquierda y el calado cuelga del borde de arriba a la derecha
  —anclado abajo se sale por la cabecera y aparece descabezado.

---

## Imagery

Fotografía de producto real, sobre fondo claro uniforme, y calada contra el
blanco cuando se pueda (un calado sobre blanco no necesita ser perfecto: el borde
antialiaseado ya trae blanco). Sin filtros, sin duotono, sin marco, sin sombra,
con radio 4 px como máximo. Una foto por sección, rodeada de blanco.

Nada de ilustración, iconos como decoración, formas geométricas ni fotos de banco
de imágenes: un hero fue durante un tiempo un video de stock de una mujer rubia
con tulipanes, sin relación con el catálogo, y era exactamente el «genérico sin
personalidad» que el sistema existe para evitar.

---

## Layout

De borde a borde siempre. Sin `max-width`, sin columna centrada, sin barra
lateral. Las secciones se apilan sobre el mismo blanco, separadas por
`clamp(76px, 11vh, 132px)` de aire y un filete de 1 px. La tinta aparece dos
veces en toda la página —una sección a la mitad y el pie— y son los dos únicos
respiros oscuros.

El ritmo es de revista: una imagen, un titular, mucho blanco, repetir. No hay
grillas de «features», ni tablas de precios, ni tarjetas.

---

## Piezas gráficas — anuncios, historias, posts

El sistema no vive solo en la web. Estas reglas son para cualquier imagen que
lleve la marca, y **cada una salió de un error ya cometido**. Van aparte porque
son las que más caro cuestan romper.

**Formatos y área segura**

| Sitio | Lienzo | Área segura |
|---|---|---|
| Feed de Instagram (4:5) | 1080 × 1350 | 76 px por lado |
| Historias / Reels (9:16) | 1080 × 1920 | **372 px arriba y abajo** |

Los 372 px de las historias no son margen estético: es lo que tapan la UI de
Instagram, el avatar y la caja de respuesta. Un titular que entra ahí no existe.

**Manda el producto: entero y grande.** La foto es el contenido, no el fondo.
Nada cortado, nada dentro de un marco; el diseño va encima de la foto, no al lado
en una cajita. Cuando una toma trae fondo de sobra se recorta al producto y **se
mide el color de ese fondo**, para que la foto entre con `contain` sobre un
contenedor del mismo color: así el producto nunca se corta y tampoco flota en el
vacío. Las tomas que ya llenan el encuadre entran a sangre.

**El logotipo va directo sobre la foto**, nunca en una plaquita ni en una banda
inventada para él. Dos versiones y solo dos: la caligrafía gris sobre fondo claro,
y la versión en hueso —la única que se lee— sobre foto oscura o panel de tinta.
Entre 52 y 84 px de alto sobre lienzo de 1080. No se deforma, no se recolorea, no
lleva sombra.

**Nada inventado.** Precios, medidas, tiempos y composición salen del catálogo,
de la landing o del checkout. Si un dato no está ahí, no se escribe: hubo una
pieza que afirmaba «florece entre ocho y doce semanas», «60–70 cm» y «maceta de
cerámica», y nada de eso existía. Toda afirmación tiene que poder citarse.

**Mirar cada pieza antes de entregarla, y de a una.** No se entrega un lote sin
abrir. ¿El producto está entero? ¿El logo se lee sobre lo que tiene debajo? ¿El
texto entra en el área segura? ¿Lo que afirma se puede citar?

**Con IA:** por defecto la foto de producto no se genera — el catálogo es
fotografía real, y una orquídea inventada es una promesa que la florería no puede
cumplir. Fondos, texturas y video ambiente, adelante. **Salvo que el cliente lo
pida**, y entonces se hace: es su decisión. Con dos condiciones — no reemplaza a
la foto de catálogo de un producto que se vende, y queda anotado que esa imagen
es generada.

> En el repo, estas reglas están como skill de Claude Code en
> `.claude/skills/piezas-graficas/SKILL.md` —con los comandos del pipeline y las
> trampas del render— y se cargan solas al abrir una sesión ahí.

---

## Agent Prompt Guide

**Referencia rápida de color**
- texto: `#2A2623` (fuerte) · `#4A443F` (cuerpo) · `#6E6862` (apagado)
- fondo: `#FFFFFF` · alterno `#F4F4F3` · oscuro `#2A2623`
- filete: `#E6E5E3` (1 px, siempre)
- acento: `#9E2B5E` (sobre tinta: `#D584A1`)
- tercero: `#88A65C`

**Prompts de ejemplo**

1. *Hero:* lienzo blanco de borde a borde con un velo `#FBF0DE` que se apaga
   antes de la mitad. Titular de tres líneas en Cormorant Garamond itálica 500 a
   `clamp(2.9rem, 9.7vw, 158px)`, interlínea 0.94, centrado, con la segunda línea
   en `#9E2B5E`. Foto de producto calada, sin fondo ni sombra, apoyada abajo y
   **por delante** del titular, saliéndose por el borde inferior.

2. *Enlace de texto:* 15 px Jost 500 en `#2A2623`, filete de 1 px `#CBC9C6`
   debajo, subrayado rosa que crece de izquierda a derecha en 0.4 s al pasar por
   encima. Sin fondo, sin padding, sin radio.

3. *Título de sección:* rótulo de 12 px en versalita `letter-spacing: .22em` en
   `#9E2B5E`, y debajo el título en Cormorant itálica 500 a
   `clamp(2.3rem, 5.4vw, 4.6rem)`, con una palabra en rosa.

4. *Ficha de producto:* foto cuadrada, filete de 1 px debajo, y sobre él la
   categoría en versalita de 10 px a la izquierda y el precio de 13 px a la
   derecha; el nombre debajo en Cormorant itálica de 22 px.

5. *Pieza gráfica / anuncio:* el producto entero y grande, nunca cortado, con el
   diseño encima. El logotipo directo sobre la foto, jamás en una plaquita.

---

## Marcas cercanas

- **Aesop** — la misma contención editorial: fondo neutro, casi-negro, foto de
  producto como único color y filetes en vez de botones.
- **Officine Universelle Buly** — la misma serif itálica a tamaño grande sobre
  papel claro.
- **Flowerbx** — la misma disciplina de foto de flor sobre fondo limpio.

---

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Color — medido del ramo del logotipo */
  --bg-page:#FFFFFF; --bg-alt:#F4F4F3;
  --text-strong:#2A2623; --text-body:#4A443F; --text-muted:#6E6862; --text-faint:#A2A19F;
  --border:#E6E5E3; --border-strong:#CBC9C6;
  --accent:#9E2B5E; --accent-hover:#842049; --accent-soft:#D584A1;
  --leaf:#88A65C; --peach:#FBF0DE;

  /* Tipografía */
  --font-display:'Cormorant Garamond', Georgia, serif;
  --font-sans:'Jost', ui-sans-serif, system-ui, sans-serif;
  --titular-estilo:italic; --titular-peso:500;
  --ls-tight:-0.018em; --ls-wide:.18em; --ls-widest:.22em;
  --lh-tight:0.94; --lh-normal:1.55;

  /* Forma y espacio */
  --radius-sm:4px; --radius-md:8px; --radius-lg:14px; --radius-pill:999px;
  --gutter:48px; --sec-pad:clamp(76px, 11vh, 132px);
}

/* El display SIEMPRE en itálica 500, y por clase — no forzar la serif entera */
.display {
  font-family: var(--font-display);
  font-style: italic;
  font-weight: 500;
  letter-spacing: var(--ls-tight);
  line-height: 1.03;
}
.display em { font-style: italic; color: var(--accent); }

.rotulo {
  font-size: 12px; font-weight: 500;
  letter-spacing: var(--ls-widest); text-transform: uppercase;
  color: var(--accent);
}
```

### Tailwind (v3)

```js
colors: {
  ivory: { 50:'#FFFFFF', 100:'#FFFFFF', 200:'#F4F4F3', 300:'#E6E5E3', 400:'#CBC9C6' },
  ink:   { 300:'#B4ADA4', 400:'#A2A19F', 500:'#6E6862', 700:'#4A443F', 900:'#2A2623' },
  rosa:  { 100:'#F4D6E0', 300:'#D584A1', 500:'#9E2B5E', 600:'#842049' },
  verde: { 100:'#EDF1E4', 300:'#B6C2A7', 500:'#88A65C' },
  pesca: { 100:'#FBF0DE', 300:'#F0D9B5' },
}
```

---

## Dónde vive todo esto

| | |
|---|---|
| Fuente de verdad de los tokens | `design/direcciones/florencia.css` |
| De dónde salen los colores | `design/colores-logo.py` |
| Los mismos tokens en la tienda | `app/src/index.css` · `app/tailwind.config.js` |
| El molde de las secciones | `app/src/components/sections/Seccion.tsx` |
| El hero | `app/src/components/sections/HeroHerbario.tsx` |
| Las reglas que no se negocian | `TRASPASO.md` |
| Cómo se ve el sistema solo | `python3 design/build.py` → `design/salida/` |
| Las reglas de piezas gráficas, como skill | `.claude/skills/piezas-graficas/SKILL.md` |
| La fábrica de anuncios | `marketing/ig-ads/` — `ads.json` + `build.mjs` |
