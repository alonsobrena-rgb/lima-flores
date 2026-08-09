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
python3 design/galeria.py    # la galería que se le manda a la dueña
```

`build.py` compone `tienda.html` (la maqueta, una sola vez) con
`direcciones/<clave>.css` (los tokens de cada una), incrusta las tipografías
(woff2 en base64) y las fotos, y fotografía cada dirección a 1440 y 430 px.

Los cuatro archivos de `salida/` se abren solos y se pueden mandar por WhatsApp:
no dependen de red ni de servidor.

## En Claude Design

Las tres viven también como proyectos de sistema de diseño, con los mismos
componentes y el mismo storefront en React:

- **Florencia** — `6322844f-ea50-4887-9467-a7e287b76251`
- **París** — `02b879f7-9835-4e07-8836-302453dc1b49`
- **Ámsterdam** — `ad781643-a674-4647-be49-f16b9508fb51`

París y Ámsterdam se crearon clonando Florencia y reescribiendo solo `tokens/`,
igual que acá. Se llega por el MCP `claude_design` (requiere `/design consent`).

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
4. Sanear el catálogo: cinco productos fúnebres sin foto, `box-lupita` con la
   descripción de otro producto, y el Arreglo Florencia cuya foto es un gráfico
   de marketing con texto quemado.
