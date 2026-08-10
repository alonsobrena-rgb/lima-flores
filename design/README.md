# Direcciones de diseño

Tres propuestas de marca para la tienda, para que la dueña elija **una**.

Las tres son **la misma tienda** — misma portada, mismo catálogo, misma ficha de
producto, con las fotos y los precios reales de `db/products.seed.json`. Lo único
que cambia son los tokens. Si la maqueta cambiara entre direcciones, la dueña
estaría eligiendo maqueta y no marca.

| | Dirección | Manda | Vende por |
|---|---|---|---|
| **A** | Florencia | la rosa `#9E2B5E` | deseo |
| **B** | París | el durazno, con el listón `#B33A48` | insistencia elegante |
| **C** | Ámsterdam | el verde pintado `#0B6E30` | abundancia |

## Los colores están medidos, no elegidos

```sh
python3 design/colores-logo.py
```

Agrupa por tono los píxeles del ramo acuarelado del logotipo, descarta el papel
y los grises del logotipo, y de cada familia devuelve el color medio y el
"hondo". El ramo resulta ser **52% rosa, 29% verde, 13% durazno y crema, 1,4%
azul**, sobre el gris `#A2A19F` del logotipo.

Cada dirección elige cuál de esas familias manda. Ninguna inventa un color.

Dos hallazgos: el `#9E2B5E` que estaba elegido a ojo quedó a un pelo del hondo
real `#930F57` — se confirma. Y el salvia `#7E8E6E` **no existe en el logo**; se
reemplazó por los verdes medidos.

## Cómo se arma

```sh
python3 design/build.py      # las tres direcciones + capturas
python3 design/muestra.py    # la tienda con las tres pieles conmutables
python3 design/galeria.py    # la galería con la comparación lado a lado
```

`build.py` compone `tienda.html` (la maqueta, una sola vez) con
`direcciones/<clave>.css` (los tokens de cada una) y `heroes/<clave>.html`,
incrusta las tipografías (woff2 en base64) y las fotos, y fotografía cada
dirección a 1440 y 430 px.

Debajo de la tienda va `sistema.html`: la paleta, la tipografía, los botones y
las formas de esa dirección. Es una sola pieza compartida — se pinta con las
mismas variables que la tienda, así que cambiar de dirección la cambia entera.
Los nombres de color y de tipografía van por token (`--nom-…`) porque son lo
único que no se deduce del valor.

El hero **no** es compartido: cada dirección tiene el suyo, porque es donde la
marca se juega todo.

| | Hero | Qué hace |
|---|---|---|
| Florencia | la vitrina | la foto ocupa media página y sangra por la derecha |
| París | el escaparate | dos fotos montadas con filete de tinta y la etiqueta colgando |
| Ámsterdam | el puesto | los baldes en fila, en una banda corta antes del catálogo |

`muestra.py` mete las tres pieles en un solo archivo, cada una bajo
`[data-piel="…"]`, y agrega una barra para cambiarlas en vivo. Es lo que
conviene mandarle a la dueña: aprieta un botón y ve la misma tienda cambiar de
marca, en vez de comparar tres capturas.

Todos los archivos de `salida/` se abren solos y se pueden mandar por WhatsApp:
no dependen de red ni de servidor.

## En Claude Design

Las tres viven también como proyectos de sistema de diseño, con los mismos
componentes y el mismo storefront en React:

- **Florencia** — `6322844f-ea50-4887-9467-a7e287b76251`
- **París** — `1349f18c-7d70-4fda-a736-a4b3b3b56a3f`
- **Ámsterdam** — `96db51d5-f22d-436d-b66a-afff3127fb5e`

París y Ámsterdam se crearon clonando Florencia y reescribiendo solo `tokens/`,
igual que acá. Se llega por el MCP `claude_design` (requiere `/design consent`).

**Ojo con cómo se crean.** `mcp__claude_design__create_project` crea un proyecto
normal, y el tipo es **inmutable**: un proyecto normal nunca se convierte en
sistema de diseño, así que no aparece en la pestaña de sistemas de diseño ni
sirve para sincronizar. Para crear uno de verdad va `DesignSync` con
`method: create_project`, y se verifica con `get_project` que devuelva
`type: PROJECT_TYPE_DESIGN_SYSTEM`.

`claude-design/` guarda una copia de lectura de los tokens de Florencia.

## Detalles que cuestan encontrar

- **Chromium no baja de 500 px de viewport.** Pedirle `--window-size=430` rinde a
  500 y recorta: la página se ve rota cuando no lo está. Las capturas de teléfono
  van dentro de un iframe del ancho real (`_banco` en `build.py`).
- **El viewport queda ~78 px más bajo que `--window-size`.** Se pide de más y se
  recorta al alto medido en el navegador.
- **Sin `<meta charset>`, Chromium abre `file://` como windows-1252** y parte
  todos los acentos.
- **Los tokens se inyectan antes que el CSS de la tienda**, así que una regla
  suelta en el archivo de tokens pierde contra la de la maqueta. Lo que la
  dirección quiera cambiar va por variable (`--tt-titulo`), no por regla.
- **Un nombre de producto en minúscula se lee como error de tipeo.** La minúscula
  de Ámsterdam es solo para titulares y cabeceras de sección.
- **El CSS de la tienda se inyecta después de los tokens**, así que una regla
  `.add{...}` escrita en un archivo de dirección pierde contra la `.add` de la
  maqueta. Pasó dos veces. Lo que una dirección cambia va **siempre por token**.
- **`margin: 0 auto` dentro de un contenedor grid anula el estiramiento.**
  El `.wrap` del hero de Florencia se encogía a 559px en vez de 1200 y el texto
  terminaba debajo de la foto. Se arregla con un `width:100%` explícito.
- **`content: var(--x)` solo lee tokens del ámbito del elemento.** Los nombres
  del sistema tienen que declararse dentro de `:root`; metidos por error dentro
  de una regla suelta al final del archivo, las etiquetas salen vacías.
- **En `muestra.html` conviven las tres pieles**, así que ocultar y mostrar los
  textos tiene que empatarle en especificidad a las reglas de dirección. Una
  regla como `.heroIn h1{display:inline-block}` de una dirección le ganaba a un
  `.solo{display:none}` y salían los tres titulares apilados.

## Lo que dice el sistema original y hay que respetar

En Florencia el **tamaño display va en itálica, peso 500**, y los títulos de
sección quedan **redondos en 600**. No es decoración: está escrito en
`guidelines/type-display.html` del sistema de Claude Design.

```
.d  { font-size:60px; font-weight:500; font-style:italic }   /* display  */
.h1 { font-size:40px; font-weight:600 }                       /* sección  */
.h2 { font-size:28px; font-weight:500 }
```

Va por token (`--titular-estilo`, `--titular-peso`) para que las otras dos
direcciones no lo hereden: en París un Bodoni display en itálica sería otra
cosa, y Ámsterdam va en minúscula redonda.

**El rótulo va en el color de acento**, peso 500 — no en gris. Está en
`type-eyebrow-script.html` (`color: var(--rosa-500)`) y en
`brand-photography.html`. Va por `--eti-color`, con el tono propio de cada
dirección cuando el fondo es de color.

**Los radios son 4 / 8 / 14 / pill** (`radii-shadows.html`). Florencia tenía lg
en 10 por error.

**El logotipo nunca va sobre fondos movidos** (`brand-logo.html`): «Give it air;
never on busy backgrounds». Sobre oscuro va en blanco plano
(`filter: brightness(0) invert(1)`), no la acuarela.

### Tres «mismo día» que estaban dentro del propio sistema

No solo en el readme. Corregidos en los tres proyectos:

| Archivo | Decía | Dice |
|---|---|---|
| `type-body.html` | Cada ramo se arma a mano el mismo día | …el día de la entrega |
| `type-body.html` | Entrega el mismo día en San Isidro, Miraflores y Barranco | Eliges el día y una franja de 30 minutos. Cobertura en Lima Metropolitana |
| `type-eyebrow-script.html` | Entrega en Lima · Hoy | Entrega en Lima · Elige el día |

Lo segundo además reducía la cobertura a tres distritos, cuando `checkout.js`
cubre Lima Metropolitana entera.

## Lo que no se toca

- **El logo.** Las tres usan el original.
- **Las entregas son al día siguiente.** Se elige el día y una franja de 30
  minutos (`site/js/checkout.js`). Ninguna dirección promete el mismo día.
- **Nada inventado.** Precios, medidas y contenido de cada caja salen del
  catálogo real.

## Después de que elija

1. Consolidar los tokens de la elegida en una sola fuente que consuman `app/`
   (React + Tailwind), `site/` (legacy) y `marketing/ig-ads/build.mjs`.
2. Rehacer las pantallas de la tienda.
3. Rehacer los anuncios: hoy `build.mjs` tiene 11 colores escritos a mano en 9
   plantillas que cada una se inventó su look. Ya usa Cormorant Garamond y Jost,
   así que la mitad del camino está hecha.
4. Sanear el catálogo: `box-lupita` tiene la descripción de otro producto, y la
   foto del Arreglo Florencia es un gráfico de marketing con el texto quemado
   encima.

   (Los cinco productos fúnebres **sí** tienen foto, a 1080×1440 en
   `app/public/products/`. Faltan en `site/assets/products/`, la carpeta del
   sitio viejo, que producción ya no sirve — mirar ahí lleva a conclusiones
   falsas.)
