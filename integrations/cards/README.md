# Tarjetas de regalo automáticas (plegadas)

Cuando un cliente crea un pedido con **mensaje en la tarjeta** (`card_note`), el
sistema genera automáticamente una **tarjeta plegada** que acompaña al arreglo:
un **PDF de 2 páginas** listo para imprimir y doblar, más un **PNG de
previsualización**. El estilo se elige al azar entre **5**.

La tarjeta es un **díptico** que se dobla por la mitad (doblez superior, se abre
una mitad sobre la otra). La **portada** lleva la marca; el **mensaje del
cliente** va impreso **adentro**.

> **De momento solo se genera la CARA INTERNA (la "segunda hoja").** El diseño
> completo (exterior + interior) sigue definido en [`folded.js`](folded.js) y queda
> archivado en [`designs/`](designs/) (PNG + PDF de los 5 estilos completos). Para
> volver a generar la tarjeta entera, pasa `faces: 'both'` a `generateCard` (o usa
> `--full` en el CLI). El control del default vive en [`generate.js`](generate.js).

## Flujo

1. `POST /api/order` guarda el pedido y responde al cliente de inmediato.
2. En segundo plano (`setImmediate`), [`order-card.js`](order-card.js) genera la
   tarjeta con Puppeteer y guarda en `orders`: `card_pdf` (lámina para imprenta),
   `card_png` (previsualización), `card_template` y `card_generated_at`. Si falla,
   el pedido **no se ve afectado** — el error queda en `orders.card_error`.
3. En el panel `/admin`, cada pedido con mensaje muestra la **vista previa** (las
   dos caras apiladas) y un botón **Descargar PDF** (2 páginas, para doblar).

## Endpoints admin (requieren sesión)

| Método | Ruta | Acción |
|---|---|---|
| `GET`  | `/api/admin/orders/:id/card`            | PNG de previsualización (lo genera al vuelo si falta) |
| `GET`  | `/api/admin/orders/:id/card?format=pdf` | PDF de 2 páginas listo para imprenta |
| `POST` | `/api/admin/orders/:id/card`            | Regenera con un estilo al azar |

## Los 5 estilos

`atelier` (crema · logo acuarela) · `minimal` (vector minimal · wordmark serif) ·
`jardin` (acuarela en el borde) · `botanica` (ramas en esquinas) ·
`blush` (rosa · acento fuerte). Definidos en [`folded.js`](folded.js). Las claves
coinciden con las guardadas en `orders.card_template` (compat con pedidos previos).

## Formato

- **Cerrada** 90×65 mm (apaisada) · **abierta** 90×130 mm (retrato).
- PDF: 2 páginas de **96×136 mm** con **3 mm de sangrado** y marcas de corte/doblez,
  impuesto para **doblez superior** (el panel de atrás va girado 180° en la lámina
  para que quede derecho al doblar).
- Tipografía del design system: Cormorant Garamond (mensaje), Jost (etiquetas/
  contacto), Pinyon Script (wordmark), desde Google Fonts.

## Límite de caracteres

`NOTE_MAX = 220` (en [`folded.js`](folded.js)). El `<textarea>` del checkout usa el
mismo límite con contador en vivo. El tamaño del mensaje **se auto-ajusta** según
el largo (un "Te amo" se ve grande; 220 caracteres encajan sin desbordar).

## Previsualizar localmente

```bash
node integrations/cards/generate.js --all                  # los 5 estilos (cara interna)
node integrations/cards/generate.js --all --full           # los 5 estilos COMPLETOS (ext+int)
node integrations/cards/generate.js "Mensaje" "Para" "De"  # uno al azar (cara interna)
```

Salen en `integrations/cards/out/` (`.pdf` + `.png`, ignorado por git). Los diseños
completos archivados están en `integrations/cards/designs/` (versionados).

## Despliegue (Railway)

`puppeteer` es **dependencia de producción** (descarga Chromium en el build). En
Railway/Nixpacks puede requerir librerías de sistema de Chromium; si la generación
falla en producción, se registra en `card_error` sin romper el pedido, y el
atelier puede regenerar desde el panel cuando el entorno esté listo.
