# Plantillas de WhatsApp — Lima Flores

Cinco plantillas de marketing para mandar a revisión de Meta, cada una con una
foto en el encabezado y un botón que lleva a su página.

| Plantilla | Qué promociona | Precio | Botón lleva a |
| --- | --- | --- | --- |
| `florero_forti` | Florero Forti | S/210 | `/producto/florero-forti` |
| `box_chococafe` | Box Chococafé | S/220 | `/producto/box-chococafe` |
| `boxsito_crespito` | Boxsito Crespito | S/180 | `/producto/boxsito-ramon` |
| `orquideas_en_maceta` | Las orquídeas, la línea entera | desde S/200 | `/catalogo?cat=orquideas` |
| `suscripcion_estacion` | La suscripción | S/130 al mes | `/suscripcion` |

Las tres primeras son de producto (`producto` en `plantillas.json`, el botón
sale de `base + producto`). Las dos últimas no promocionan un producto suelto,
así que traen `ruta` y el botón sale de `sitio + ruta`: el catálogo filtrado por
categoría y la página de la suscripción. Los dos destinos se comprueban antes de
llamar a Meta, cada uno contra su fuente.

```sh
python3 marketing/whatsapp/cabeceras.py     # prepara las fotos del encabezado
node marketing/whatsapp/crear.js --revisar  # valida sin llamar a Meta
node marketing/whatsapp/crear.js            # las manda a revisión
node marketing/whatsapp/crear.js --estado   # en qué van
```

El copy y los datos están en `plantillas.json`; los cinco cuerpos usan `{{1}}`
para el nombre del contacto.

## De dónde saca los ids

En este orden, y el orden importa: quien configura esto usa el panel, no
Railway. La primera versión del script solo miraba el entorno, así que decía
que faltaba todo aunque estuviera bien puesto en el panel.

1. `--waba=` / `--app=` / `--phone=` en la línea de comandos;
2. la fila `wa_conexion`, que es donde los deja *Admin → Promociones WhatsApp →
   Conexión* — **requiere `DATABASE_URL`**, o sea correrlo con
   `railway run node marketing/whatsapp/crear.js`;
3. las variables `WA_WABA_ID`, `WA_APP_ID`, `WA_PHONE_NUMBER_ID`.

El token es la excepción: sale siempre del entorno (`IG_ACCESS_TOKEN`), porque
en la base va el **nombre** de la variable, nunca el valor.

Corriéndolo desde una máquina sin acceso a la base, basta con pasarle los dos
ids a mano — son ids públicos de Meta, no secretos:

```sh
node marketing/whatsapp/crear.js --waba=<id de la WABA> --app=<id de la app>
```

### `assigned_whatsapp_business_accounts` vacío no significa nada

Anotado porque costó una vuelta entera: `GET /me/assigned_whatsapp_business_accounts`
devuelve `{"data":[]}` con este token, y de ahí se concluyó —mal— que la WABA no
estaba asignada al System User y que no se podía crear nada.

Es falso. El token abre la WABA sin problema: `GET /{waba}/message_templates`
lista y `POST` crea. Ese edge queda vacío por cómo está montado el Business, no
porque falte el acceso. **La prueba que vale es pedirle algo a la WABA**, no
mirar la lista de asignaciones — para eso está `crear.js --estado`.

## Lo que se revisa antes de llamar a Meta

Una plantilla rechazada no es gratis: cuenta contra la calidad de la WABA y hay
que esperar la revisión para enterarse de que sobraba un carácter. Así que
`crear.js` comprueba primero, y si algo falla no manda nada:

- nombre en minúsculas, números y guiones bajos;
- cuerpo ≤ 1024, pie ≤ 60, texto de botón ≤ 25;
- que el cuerpo no use más variables que `{{1}}`, que es la única para la que el
  cliente arma el ejemplo que Meta exige;
- que el destino del botón exista de verdad — un enlace muerto se ve perfecto
  hasta que alguien lo toca: el producto contra `db/products.seed.json`, la ruta
  contra las de `app/src/App.tsx` (leídas del archivo, no copiadas) y el `?cat=`
  contra `app/src/data/categories.json`. Ojo con ese último, que es el único que
  no da 404: un slug mal escrito deja el catálogo mostrando **todo**, se ve bien
  y no lleva a donde dice la plantilla;
- que la cabecera esté generada;
- que la plantilla traiga su tabla de fuentes.

## La foto del encabezado

`cabeceras.py` deja cada foto en 1200 × 628 (1.91:1) con el producto **entero**.
Meta solo impone esa proporción en carruseles y no documenta ninguna para una
cabecera de imagen; 1.91:1 es la que evita que el cliente recorte o haga zoom.

El primer intento fue el mismo truco de `marketing/ig-ads/fotos/prep-fotos.py`:
la foto contenida sobre un lienzo pintado del color medido en las esquinas. No
sirvió. El ciclorama de estas tomas es un **degradado**, así que contra un
relleno plano el borde de la foto se veía como un rectángulo dentro de la
cabecera — el recuadro que prohíbe la regla 2, y el mismo hallazgo que ya tenía
anotado `cifra` en el README de ig-ads.

Ahora el relleno sale de la propia foto: se estira su franja de borde, que es
fondo puro, hasta cubrir los lados. El degradado continúa fila por fila y la
unión no existe, porque el relleno arranca con los mismos píxeles que el borde.
Para que esa franja sea fondo y no producto, el recorte se hace al recuadro del
producto **más un 4% de aire** — las cuatro tomas de estudio traían entre 5% y 20% de fondo
por lado, así que alcanza.

El producto ocupa entre el 39% y el 52% del ancho. Es lo que da una toma
cuadrada en un lienzo apaisado sin cortar nada. Si el taller sube una toma
apaisada, la misma rutina la deja a sangre.

### El calado, para lo que no es una toma de estudio

La suscripción no es un producto del catálogo y sus fotos
(`app/public/suscripcion/`) son entregas reales sobre una banqueta: fondo de
ambiente, no ciclorama. Ahí no sirve nada de lo de arriba —ni el color de las
esquinas ni el recuadro del producto significan algo, y estirar ese borde
embarraría el piso de madera a lo ancho de la cabecera.

Lo que sí existe es el **calado** que ya abre `/suscripcion`:
`app/public/calados/ramo-estacion.webp`, el mismo ramo recortado sobre
transparencia. Cuando la foto trae canal alfa, `cabeceras.py` lo compone sobre un
lienzo liso blanco (`--bg-page` del sistema) con un 6% de aire: el ramo entra
entero y **no hay filo de foto**, así que tampoco hay recuadro que tapar. El modo
usado queda anotado en `cabeceras/cabeceras.json` (`"modo": "foto"` o `"calado"`).

`photo` sin barra sale de `app/public/products`; con barra, es una ruta dentro de
`app/public` — que es de donde salen los calados, sin mover ni duplicar archivos.

## De dónde sale cada afirmación

Cada plantilla lleva su tabla en `plantillas.json` → `fuentes`. En resumen:

| Lo que dice | Fuente |
| --- | --- |
| Composición y precio de cada producto | `db/products.seed.json` |
| «Armado a mano» | `app/src/lib/tienda.ts` → `PROMESAS` |
| «Tarjeta de dedicatoria sin costo» | `app/src/lib/tienda.ts` → `PROMESAS` |
| «Entrega a domicilio en Lima Metropolitana» | `app/src/lib/tienda.ts` → `PROMESAS` |
| «Desde el día siguiente» | `app/src/pages/Checkout.tsx:192` → `minDate` = hoy + 1 |
| «Desde S/200» (orquídeas) | la más barata de las 6 de `category: orquideas` en `db/products.seed.json` |
| «Dos entregas al mes», «S/130» | `app/src/data/plans.ts` → plan Mensual y `MONTHLY_PRICE` |
| «Flores de estación armadas a mano» | `app/src/pages/Suscripcion.tsx` |

**La franja horaria no se escribe**, a propósito. `PROMESAS` promete «una franja
de 30 minutos con 24 horas de anticipación» y el checkout da tres franjas de
cuatro horas (`app/src/lib/delivery.ts`). Hasta que se decida cuál es la verdad,
«desde el día siguiente» es lo único seguro. Es el pendiente 4 de `TRASPASO.md`.

Dos cosas más que aparecieron al escribir el copy:

- **`box-chococafe`** — la ficha menciona «toques azules» que no se ven en la
  foto. El cuerpo los omite, igual que hace IG-19.
- **`boxsito-ramon`** — el id del catálogo dice *ramon* y el producto se llama
  *Crespito*. El botón usa el id, que es lo que resuelve `/producto/:id`.
- **`orquideas_en_maceta`** — no hay una toma de las seis orquídeas juntas, así
  que la cabecera es la Sunrise y el cuerpo nombra los tres colores del catálogo
  en vez de describir un arreglo. Quedan fuera dos cosas que no valen para las
  seis: «instrucciones de mantenimiento» (lo dicen 3 de 6 fichas) y «de dos
  varas» (4 de 6).
- **`suscripcion_estacion`** — el encargo hablaba de «los envíos semanales» y lo
  que vende el sitio son **dos entregas al mes** (`app/src/data/plans.ts`, plan
  Mensual: `deliveries: 2`). El cuerpo dice dos al mes. Lo semanal que sí existe
  es el abastecimiento —«cada semana elegimos las flores que están en su mejor
  momento», en `Suscripcion.tsx`—, que es otra cosa y no se promete como entrega.
  Si el plan pasa a semanal, se cambia en `plans.ts` y en `plantillas.json` a la
  vez.

## Cumplimiento

- Solo se pueden enviar plantillas **aprobadas**, y solo a contactos con opt-in.
- Las de marketing pasan por revisión de Meta (de minutos a horas).
- Ninguna de las cinco lleva alcohol, así que no necesitan restricción de edad.
  Ojo si alguna vez entra el Box Yani, que trae espumante.

Ver también `box-simona.md`, la primera plantilla que se escribió a mano, y
`integrations/whatsapp/README.md` para el envío y el panel.
