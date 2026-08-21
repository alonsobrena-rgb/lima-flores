# Plantillas de WhatsApp — Lima Flores

Tres plantillas de marketing para mandar a revisión de Meta, cada una con la
foto del producto en el encabezado y un botón que lleva a su página.

| Plantilla | Producto | Precio | Botón lleva a |
| --- | --- | --- | --- |
| `florero_forti` | Florero Forti | S/210 | `/producto/florero-forti` |
| `box_chococafe` | Box Chococafé | S/220 | `/producto/box-chococafe` |
| `boxsito_crespito` | Boxsito Crespito | S/180 | `/producto/boxsito-ramon` |

```sh
python3 marketing/whatsapp/cabeceras.py     # prepara las fotos del encabezado
node marketing/whatsapp/crear.js --revisar  # valida sin llamar a Meta
node marketing/whatsapp/crear.js            # las manda a revisión
node marketing/whatsapp/crear.js --estado   # en qué van
```

El copy y los datos están en `plantillas.json`; los tres cuerpos usan `{{1}}`
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

### Si Meta responde que no encuentra la WABA

Puede que la cuenta no esté asignada al System User del token:
`GET /me/assigned_whatsapp_business_accounts` devolvía `{"data":[]}` cuando se
escribió esto. Se arregla en *Business Settings → System Users → Add Assets →
WhatsApp Accounts*, dando acceso completo a la WABA.

## Lo que se revisa antes de llamar a Meta

Una plantilla rechazada no es gratis: cuenta contra la calidad de la WABA y hay
que esperar la revisión para enterarse de que sobraba un carácter. Así que
`crear.js` comprueba primero, y si algo falla no manda nada:

- nombre en minúsculas, números y guiones bajos;
- cuerpo ≤ 1024, pie ≤ 60, texto de botón ≤ 25;
- que el cuerpo no use más variables que `{{1}}`, que es la única para la que el
  cliente arma el ejemplo que Meta exige;
- que el producto del botón exista en `db/products.seed.json` — un enlace muerto
  se ve perfecto hasta que alguien lo toca;
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
producto **más un 4% de aire** — las tres tomas traían entre 5% y 20% de fondo
por lado, así que alcanza.

El producto ocupa entre el 39% y el 49% del ancho. Es lo que da una toma
cuadrada en un lienzo apaisado sin cortar nada. Si el taller sube una toma
apaisada, la misma rutina la deja a sangre.

## De dónde sale cada afirmación

Cada plantilla lleva su tabla en `plantillas.json` → `fuentes`. En resumen:

| Lo que dice | Fuente |
| --- | --- |
| Composición y precio de cada producto | `db/products.seed.json` |
| «Armado a mano» | `app/src/lib/tienda.ts` → `PROMESAS` |
| «Tarjeta de dedicatoria sin costo» | `app/src/lib/tienda.ts` → `PROMESAS` |
| «Entrega a domicilio en Lima Metropolitana» | `app/src/lib/tienda.ts` → `PROMESAS` |
| «Desde el día siguiente» | `app/src/pages/Checkout.tsx:192` → `minDate` = hoy + 1 |

**La franja horaria no se escribe**, a propósito. `PROMESAS` promete «una franja
de 30 minutos con 24 horas de anticipación» y el checkout da tres franjas de
cuatro horas (`app/src/lib/delivery.ts`). Hasta que se decida cuál es la verdad,
«desde el día siguiente» es lo único seguro. Es el pendiente 4 de `TRASPASO.md`.

Dos cosas más que aparecieron al escribir el copy:

- **`box-chococafe`** — la ficha menciona «toques azules» que no se ven en la
  foto. El cuerpo los omite, igual que hace IG-19.
- **`boxsito-ramon`** — el id del catálogo dice *ramon* y el producto se llama
  *Crespito*. El botón usa el id, que es lo que resuelve `/producto/:id`.

## Cumplimiento

- Solo se pueden enviar plantillas **aprobadas**, y solo a contactos con opt-in.
- Las de marketing pasan por revisión de Meta (de minutos a horas).
- Ninguna de las tres lleva alcohol, así que no necesitan restricción de edad.
  Ojo si alguna vez entra el Box Yani, que trae espumante.

Ver también `box-simona.md`, la primera plantilla que se escribió a mano, y
`integrations/whatsapp/README.md` para el envío y el panel.
