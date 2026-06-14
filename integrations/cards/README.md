# Tarjetas de regalo automáticas

Cuando un cliente crea un pedido con **mensaje en la tarjeta** (`card_note`), el
sistema genera automáticamente un **PNG** de la tarjeta que acompaña al arreglo,
usando **una de 5 plantillas elegida al azar**.

## Flujo

1. `POST /api/order` guarda el pedido y responde al cliente de inmediato.
2. En segundo plano (`setImmediate`), [`order-card.js`](order-card.js) rasteriza
   la tarjeta con Puppeteer y la guarda en la columna `orders.card_png` (BYTEA),
   junto con `card_template` y `card_generated_at`. Si falla, el pedido **no se
   ve afectado** — el error queda en `orders.card_error`.
3. En el panel `/admin`, cada pedido con mensaje muestra la **vista previa**, un
   botón **Descargar PNG** y **Otra plantilla** (regenera con otra al azar).

## Endpoints admin (requieren sesión)

| Método | Ruta | Acción |
|---|---|---|
| `GET`  | `/api/admin/orders/:id/card` | Devuelve el PNG (lo genera al vuelo si falta) |
| `POST` | `/api/admin/orders/:id/card` | Regenera con una plantilla al azar |

## Las 5 plantillas

`atelier` (crema · marco rosa) · `jardin` (musgo oscuro · dorado) ·
`blush` (rosa empolvado) · `botanica` (crema editorial · ramas) ·
`minimal` (blanco · punto rosa). Definidas en [`templates.js`](templates.js).

Formato: **1080×1350 px** (4:5, vertical), `deviceScaleFactor 2` → nítido para
pantalla e impresión. Tipografía del design system: Cormorant Garamond (mensaje)
y Jost/Italiana (etiquetas), cargadas desde Google Fonts.

## Límite de caracteres

`CARD_NOTE_MAX = 220` (en [`templates.js`](templates.js)). Es el punto donde un
mensaje cálido cabe holgado y la tipografía sigue respirando; pasado eso, la
fuente se vuelve pequeña y se pierde la elegancia. El `<textarea>` del checkout
usa el mismo límite y un contador en vivo. El tamaño del texto **se auto-ajusta**
según el largo (un "Te amo" se ve grande; 220 caracteres encajan sin desbordar).

## Previsualizar localmente

```bash
node integrations/cards/generate.js --all                  # las 5 plantillas
node integrations/cards/generate.js "Mensaje" "Para" "De"  # una al azar
```

Los PNG salen en `integrations/cards/out/` (ignorado por git).

## Despliegue (Railway)

`puppeteer` es ahora **dependencia de producción** (descarga Chromium en el
build). En Railway/Nixpacks puede requerir librerías de sistema de Chromium; si
la generación falla en producción, se registra en `card_error` sin romper el
pedido, y el atelier puede regenerar desde el panel cuando el entorno esté listo.
