# Plantilla de WhatsApp — BOX SIMONA

Copy aprobado para una plantilla de marketing de Meta. Sale entero del catálogo:
la tabla de abajo dice de dónde viene cada afirmación, igual que la galería de
anuncios. **Si un dato no está en esa tabla, no se escribe.**

- Nombre de plantilla: `box_simona` · Idioma: `es` · Categoría: `MARKETING`
- Ejemplo para `{{1}}`: `Ana`
- Producto: https://limaflores.pe/producto/box-simona

## Cuerpo — la versión que se usa

```
Hola {{1}}, te presentamos el BOX SIMONA: 12 rosas amarillas y 12 rosas lilas con follaje verde, en un box blanco.

Ideal para celebraciones, y va con su tarjeta de dedicatoria sin costo.

S/ 176 · Entrega a domicilio en Lima Metropolitana, al día siguiente.
```

212 caracteres, de los 1024 que deja Meta.

## Variantes

**Más corta**, para que se lea sin abrir la conversación:

```
Hola {{1}}, el BOX SIMONA junta 12 rosas amarillas y 12 rosas lilas con follaje verde en un box blanco. Con tarjeta de dedicatoria, S/ 176, a domicilio en Lima Metropolitana desde el día siguiente.
```

**Sin el nombre**, para una lista con contactos sin nombre guardado — el envío
rellena `{{1}}` con «cliente» cuando el contacto no tiene nombre, y «Hola
cliente,» se lee mal:

```
Un box blanco con 12 rosas amarillas y 12 rosas lilas, follaje verde y tarjeta de dedicatoria: así es el BOX SIMONA.

S/ 176 · A domicilio en Lima Metropolitana, al día siguiente.
```

Pie sugerido (máx. 60): `Lima Flores · Atelier en Miraflores`

## De dónde sale cada afirmación

| Lo que dice | Fuente |
|---|---|
| 12 rosas amarillas + 12 rosas lilas, follaje verde, box blanco | `db/products.seed.json` → `box-simona` |
| Ideal para celebraciones | mismo, `shortDesc` |
| Tarjeta de dedicatoria sin costo | mismo + `PROMESAS` en `app/src/lib/tienda.ts` |
| S/ 176 | mismo, `price` |
| Entrega a domicilio en Lima Metropolitana | `PROMESAS` |
| Al día siguiente | checkout (`minDate` = mañana, `app/src/pages/Checkout.tsx`) |

**La franja horaria no se escribe**, a propósito. La copia del sitio promete
«30 minutos con 24 h de anticipación» y el checkout da tres franjas de cuatro
horas (`app/src/lib/delivery.ts`). Hasta que se decida cuál es la verdad,
«al día siguiente» es lo único seguro. Es el pendiente 4 de `TRASPASO.md`.

## La foto del encabezado

**Ya está lista:** `marketing/whatsapp/encabezados/box-simona.jpg`, 1125 × 600,
que es el tamaño que Meta recomienda para un encabezado de imagen. Se sube tal
cual desde el panel al crear la plantilla.

La toma de catálogo (`app/public/products/box-simona.jpg`) es real, sobre blanco
y con el producto entero: se ven el box y la tarjeta de dedicatoria, así que
respalda dos de las afirmaciones de la tabla. Pero es **vertical (1707 × 2560)**
y WhatsApp muestra el encabezado apaisado, así que metida ahí de cualquier manera
el recorte se comía el box o las rosas.

La prepara `marketing/whatsapp/prep-encabezado.py`, que aplica la regla 1 del
skill de piezas gráficas reutilizando la detección del pipeline de anuncios: mide
el fondo de la toma (`#FDFDFD`), recorta hasta el producto y lo apoya con
`contain` sobre un lienzo de **ese mismo color medido**. El producto entra
entero, ocupa todo el alto y no se ve ninguna costura, porque el lienzo es del
color que ya tenía la foto.

```sh
python3 marketing/whatsapp/prep-encabezado.py box-simona.jpg
```

No lleva logotipo encima ni hace falta: la caligrafía ya está en el box y en la
tarjeta dentro de la foto real, y WhatsApp muestra el nombre del negocio arriba
del mensaje.
