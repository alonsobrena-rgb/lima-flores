# Direcciones de diseño

Tres propuestas de identidad para la tienda, para que la clienta elija **una**.
No son bocetos: cada una es una página que funciona, armada sobre las mismas
tres pantallas reales — portada, catálogo y ficha de producto — con las fotos y
los precios que hoy están en `db/products.seed.json`.

| | Dirección | En una línea |
|---|---|---|
| **A** | Mercado | El catálogo manda. Entras y ya estás comprando. |
| **B** | Atelier | Cada pieza es una pieza, con su número y su ficha. |
| **C** | Botánica | Verde profundo, magenta que grita, y una barra que no te suelta. |

## Cómo se arma

```sh
python3 design/build.py      # direcciones + capturas
python3 design/galeria.py    # la galería que se le manda a la clienta
```

`build.py` toma cada plantilla de `direcciones/`, le incrusta las tipografías
(woff2 en base64, subset latino) y las fotos, y deja el resultado autocontenido
en `salida/`. Después la fotografía a 1440 y a 430 px de ancho.

`galeria.py` junta las tres con su paleta, su tipografía y lo que gana y cuesta
cada una, en `salida/galeria.html`.

Los tres archivos de `salida/` se abren solos y se pueden mandar por WhatsApp:
no dependen de red ni de servidor.

## Detalles que cuestan encontrar

- **Chromium no baja de 500 px de viewport.** Pedirle `--window-size=430` rinde
  a 500 y recorta: la página se ve rota cuando no lo está. Por eso las capturas
  de teléfono se hacen dentro de un iframe del ancho real (`_banco` en
  `build.py`).
- **El viewport queda ~78 px más bajo que `--window-size`.** Se pide de más y se
  recorta al alto medido en el navegador.
- **`padding: X 0` sobre un elemento que también es `.wrap` mata los márgenes
  laterales.** En estas plantillas va siempre `padding-block`.

## Lo que no se toca

- **El logo.** Las tres usan el original; C usa la versión clara sobre verde.
- **Las entregas son al día siguiente.** Se elige el día y una franja de 30
  minutos (`site/js/checkout.js`). Ninguna dirección promete el mismo día.
- **Nada inventado.** Precios, medidas y contenido de cada caja salen del
  catálogo real.

## Después de que elija

Recién ahí se codifica: se consolidan los tokens de la dirección elegida en una
sola fuente que consuman la app de React y el sitio legacy, y se retiran los
restos del sistema actual (entre otros, el import de Playfair Display en
`app/src/index.css` y `serifAlt` en `app/tailwind.config.js`, que hoy no se usan).
