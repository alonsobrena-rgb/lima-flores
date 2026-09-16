---
name: plantillas-whatsapp
description: Reglas de la casa para crear, escribir o mandar a revisión una plantilla de mensaje de WhatsApp (Meta Cloud API) de Lima Flores. Úsalo ANTES de tocar marketing/whatsapp/plantillas.json, de correr crear.js o de crear una plantilla desde Admin → Promociones WhatsApp. La regla que más se rompe: cada plantilla se crea DOS veces, con nombre y sin nombre.
---

# Plantillas de WhatsApp — Lima Flores

Cada regla de acá salió de un error que ya se cometió. Romperlas es repetirlo.

## 1. Siempre las dos: con nombre y sin nombre

**Una plantilla que saluda con `{{1}}` no se crea sola. Se crean dos:**

| | Cuerpo |
| --- | --- |
| `florero_forti` | «Hola {{1}}, el Florero Forti lleva…» |
| `florero_forti_sin_nombre` | «Hola, el Florero Forti lleva…» |

Por qué, y no es una preferencia de estilo: **más de un tercio de la libreta no
tiene nombre guardado**. Meta congela el cuerpo al aprobarlo y no acepta un
parámetro vacío, así que con una sola plantilla a esa gente le llega
«Hola&nbsp;&nbsp;,» — el espacio y la coma son del cuerpo aprobado, no del dato,
y desde el envío no hay forma de quitarlos. Tampoco se puede empezar el cuerpo
con una variable: Meta lo rechaza.

Cómo se hace, según por dónde entres:

- **`marketing/whatsapp/crear.js`** ya las crea las dos: el cuerpo de la gemela
  sale del principal quitándole el hueco y el espacio de antes. Solo hay que
  mirar que el resultado se lea bien (`--revisar` lo imprime). Si esa pieza
  necesita otro saludo, se escribe en `body_sin_nombre`; `sin_nombre: false` la
  deja sin gemela, y eso hay que justificarlo.
- **Panel (Admin → Promociones WhatsApp → Plantillas)**: la casilla «Crear
  también la versión sin nombre» viene marcada. No la desmarques sin motivo.

Tres cosas que no se tocan, porque el envío depende de ellas
(`integrations/whatsapp/campanas.js`):

- **El emparejado es por el nombre**: gemela = nombre + `_sin_nombre`
  (`integrations/whatsapp/client.js`). No hay columna que relacione la pareja; si
  le cambias el sufijo, el envío deja de encontrarla y nadie se entera.
- **La gemela no lleva variables.** Es justamente la que no saluda por el nombre.
- **La gemela no se elige a mano.** No aparece en los desplegables de envío ni se
  le apunta una campaña o una programada: la elige el envío, contacto por
  contacto. Se elige la principal, siempre.

Y una que es de operación, no de código: una gemela aprobada en Meta **no sirve
hasta que el panel la tenga**. *Plantillas → Sincronizar estados* la importa con
su foto. Hasta entonces el envío la ignora —mandar una plantilla en revisión
falla— y sigue saliendo el «Hola&nbsp;&nbsp;,».

## 2. Nada inventado

Precios, composición, tiempos y medidas salen de `db/products.seed.json`, de
`app/src/lib/tienda.ts` (PROMESAS), de `app/src/data/plans.ts` o del checkout.
**Si un dato no está ahí, no se escribe.**

Cada plantilla de `plantillas.json` lleva su tabla `fuentes`, y `crear.js` se
niega a mandar una que no la traiga. Es la misma regla que la galería de
anuncios: si una afirmación no se puede citar, no va.

**La franja horaria no se escribe.** La copia del sitio promete «30 minutos con
24 h de anticipación» y el checkout da tres franjas de cuatro horas
(`app/src/lib/delivery.ts`). Hasta que se decida cuál es la verdad, «desde el día
siguiente» es lo único seguro.

Y lo que vale para una pieza vale para una plantilla de categoría: si el cuerpo
habla de varias cosas a la vez («nuestras orquídeas»), cada afirmación tiene que
valer para **todas**. En `orquideas_en_maceta` quedaron fuera «instrucciones de
mantenimiento» (lo dicen 3 de 6 fichas) y «de dos varas» (4 de 6).

## 3. Los límites de Meta, antes de llamar a Meta

Una plantilla rechazada no es gratis: cuenta contra la calidad de la WABA y hay
que esperar la revisión para enterarse de que sobraba un carácter. `crear.js`
comprueba todo esto **antes** de mandar nada, y `--revisar` lo corre sin llamar a
Meta. No lo saltes:

- nombre en minúsculas, números y guiones bajos;
- cuerpo ≤ 1024, pie ≤ 60, texto de botón ≤ 25;
- el cuerpo no puede empezar ni terminar con una variable;
- una sola variable, `{{1}}`, que es la única para la que el cliente arma el
  ejemplo que Meta exige;
- el destino del botón tiene que existir de verdad: el producto contra
  `db/products.seed.json`, la ruta contra las de `app/src/App.tsx`, el `?cat=`
  contra `app/src/data/categories.json`. Ojo con el último, que es el único que
  no da 404: un slug mal escrito deja el catálogo mostrando todo y la plantilla
  se ve perfecta.

`crear.js` es idempotente —pregunta qué hay en Meta y se salta lo que ya
existe—, así que correrlo de nuevo para agregar una plantilla o una gemela es lo
normal, no un riesgo.

## 4. La cabecera

`python3 marketing/whatsapp/cabeceras.py` deja cada foto en 1200 × 628 (1.91:1)
con el producto **entero**, nunca un recorte que lo corte. Dos modos, y el
script elige solo: foto de estudio (rellena los lados estirando su propia franja
de borde, porque el ciclorama es un degradado y un relleno plano se ve como un
recuadro) o calado con transparencia sobre lienzo liso, para lo que no es una
toma de estudio.

Para cualquier decisión de imagen —recortes, logotipo, colores— manda
`.claude/skills/piezas-graficas/SKILL.md`.

## 5. Cumplimiento

- Solo se envían plantillas **aprobadas**, y solo a contactos con opt-in.
- Las de marketing pasan por revisión de Meta (de minutos a horas).
- Si alguna vez entra un producto con alcohol (el Box Yani trae espumante), esa
  plantilla necesita restricción de edad.

## Dónde está cada cosa

| | |
| --- | --- |
| Copy, fuentes y destinos | `marketing/whatsapp/plantillas.json` |
| Crear / revisar / estado | `marketing/whatsapp/crear.js` |
| Cabeceras 1.91:1 | `marketing/whatsapp/cabeceras.py` |
| Cómo se elige la pareja al enviar | `integrations/whatsapp/campanas.js` |
| Nombres de la pareja, cuerpo derivado | `integrations/whatsapp/client.js` |
| El panel y la operación | `integrations/whatsapp/README.md` |
