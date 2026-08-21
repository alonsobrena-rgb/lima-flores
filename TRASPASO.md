# Traspaso — dónde está el proyecto

Resumen para retomar en una sesión nueva. Todo lo que sigue está en `main`,
subido, con el árbol limpio, y desplegado — Railway construye desde `main` en
cada push.

Última sesión (21/08): se conectó WhatsApp al mismo token de Instagram, se armó
la interfaz de contactos con envío suelto, y el admin se arregló para el
teléfono. Lo que sigue está en **Lo que queda pendiente → punto 0**, y para eso
hace falta abrir `graph.facebook.com` en la política de red del entorno.

---

## Antes de empezar: lo que hay que abrir en el entorno

Dos integraciones necesitan salir a internet y **el gateway las bloquea por
defecto**. Ni la política de red ni las variables aplican a una sesión ya
abierta: las dos se inyectan al arrancar el contenedor, así que se configuran
primero y **después** se abre la sesión.

Se permiten dominios en `claude.ai/code` → entorno → política de red.
Doc: https://code.claude.com/docs/en/claude-code-on-the-web

### 1. Meta (WhatsApp + Instagram) — **es lo que está bloqueando ahora**

Para que la sesión pueda crear plantillas de WhatsApp por su cuenta hace falta
permitir **`graph.facebook.com`**. Probado el 21/08: el token ya está puesto en
el entorno (`IG_ACCESS_TOKEN`, 202 caracteres) pero la llamada muere antes de
autenticarse —

```
connect_rejected · gateway answered 403 to CONNECT · graph.facebook.com:443
```

El token **no hace falta pedirlo de nuevo**; el dominio sí.

### 2. Higgsfield (imágenes generadas)

Permitir `platform.higgsfield.ai` y definir, con estos nombres exactos —son los
que leen los seis scripts de `integrations/higgsfield/`—:

- `HF_API_KEY`
- `HF_API_SECRET`

### Verificar, antes de gastar nada

```sh
curl -sS --max-time 20 "$HTTPS_PROXY/__agentproxy/status" | head -30   # ¿hay rechazos?
env | grep -oE '^(IG|WA|HF)_[A-Z0-9_]*' | sort                          # ¿están los nombres? (nunca los valores)
node integrations/higgsfield/probe.js                                   # ¿autentica Higgsfield?
```

---

## Qué es esto

Tienda de flores de Lima. Dos frentes en paralelo:

- **`marketing/ig-ads/`** — campaña de Instagram, 32 creativos generados con
  Node + Chromium desde `ads.json`. Terminada y revisada pieza por pieza.
- **`app/`** — la tienda React (Vite + Tailwind + React Router). **Es lo único
  que sirve producción.** Railway compila `app/dist` en cada deploy
  (`railway.json`), no está versionado. El sitio vanilla que vivía en `site/` se
  borró: sus fotos estaban duplicadas en `app/public/` con el mismo md5, y ahora
  esa es la única copia del catálogo.

El sistema de diseño es **Florencia**: `design/direcciones/florencia.css` es la
fuente de verdad, y sale de **medir el ramo del logotipo** con
`design/colores-logo.py` — los colores no se eligieron, se midieron. Blanco
total `#FFFFFF`, tinta `#2A2623`, rosa `#9E2B5E`, verde del ramo `#88A65C`.
Cormorant Garamond en **itálica peso 500** para el tamaño display (está escrito
en el sistema, no es decoración) y Jost para todo lo demás. Radios 4/8/14/pill.

---

## Reglas que no se negocian

Cada una salió de una corrección del cliente. Romperlas es repetir un error ya
cometido.

- **Las entregas son al día siguiente.** Ninguna pieza promete entrega el mismo
  día: manda el código del checkout, que hoy es `app/src/pages/Checkout.tsx`
  (`minDate` = mañana).
  **Ojo con la franja:** el checkout vanilla daba franjas de 30 minutos con 24 h
  de anticipación, y toda la copia del sitio sigue diciendo eso. El checkout
  React ofrece **tres franjas de cuatro horas** (`app/src/lib/delivery.ts`:
  09–13, 13–17, 17–20). La promesa y el código no coinciden — hay que decidir
  cuál de las dos es la verdad y alinear la otra.
- **Nada inventado.** Precios, medidas y contenido salen de
  `db/products.seed.json`, de la landing o del checkout. La galería de anuncios
  lleva una tabla que dice de dónde sale cada afirmación.
- **El logotipo es intocable** y va directo sobre la foto, nunca en una
  plaquita. Sobre fondo oscuro va en blanco plano, no la acuarela.
- **En piezas gráficas manda el producto**, entero y grande, con el diseño
  encima. Nada de marcos, nada cortado. Está todo en
  `.claude/skills/piezas-graficas/SKILL.md` — **leerlo antes de tocar un
  creativo o entregar una imagen**. Ese skill ya está versionado: `.gitignore`
  ignora `.claude/*` pero deja pasar `.claude/skills/`, así que las reglas de la
  casa viajan con el repo en vez de vivir en un solo portátil. La versión para
  quien diseña fuera del repo está en `DESIGN.md`, sección «Piezas gráficas».
- **Mirar cada pieza antes de entregarla, y de a una.** Se perdió una tarde
  optimizando una métrica mientras las piezas salían cortadas y con marcos.

---

## Lo que está hecho

### Anuncios de Instagram

32 creativos en `marketing/ig-ads/creativos/`, revisados uno por uno. Galería:
https://claude.ai/code/artifact/1dc2b03d-3beb-4254-81f4-bc265f8b9c2e

```sh
node marketing/ig-ads/build.mjs                 # los 32 + README
node marketing/ig-ads/build.mjs IG-22 IG-30     # solo esos, para iterar
python3 marketing/ig-ads/galeria.py             # la galería
```

Nueve plantillas en producción. **Tres nuevas en prueba, sin publicar**:
`vitrina` (arco), `tira` (tres productos) y `cifra` (el precio a tamaño de
titular). Viven en un carril aparte que no toca la campaña:

```sh
python3 marketing/ig-ads/fotos/prep-ras.py      # recortes al ras (si hiciera falta)
node marketing/ig-ads/build.mjs --pruebas
python3 marketing/ig-ads/pruebas.py
```

Hoja de prueba:
https://claude.ai/code/artifact/4c223716-2efc-456f-9bf9-694665b82904
**Falta que el cliente diga cuáles entran.**

### El publicador de Instagram

Publica los creativos de `marketing/` en `@lima_flores`, cinco al día, desde
`/admin/instagram`. La cola vive en la BD (el disco de Railway se borra en cada
deploy), un vigía la mira cada minuto y Meta descarga el archivo desde
`/api/ig/media/:id` — que por eso es público y necesita `PUBLIC_BASE_URL`.

Admite **varias cuentas**: se agregan desde el panel y viven en `ig_cuentas`.
**El token no se guarda en la base** — la fila solo dice en qué variable de
Railway está, y solo se aceptan nombres que empiecen por `IG_`. Al cargar la
galería se elige una cuenta o todas las activas, y cada una lleva su copia y su
agenda.

Para que salga algo hacen falta dos cosas: las variables (`IG_ACCESS_TOKEN` con
permiso `instagram_content_publish` y `PUBLIC_BASE_URL`, que ya está) y **el
interruptor del panel, que arranca apagado a propósito**. Un deploy no enciende
una cuenta pública. Todo el detalle en `integrations/instagram/README.md`.

### Promociones por WhatsApp

Manda plantillas de Meta a los clientes desde `/admin/whatsapp`. Cuatro pestañas:
**Conexión**, **Contactos**, **Plantillas** y **Campañas**.

- **El token es el mismo de Instagram.** Por defecto la conexión apunta a
  `IG_ACCESS_TOKEN`: si el número de WhatsApp y la cuenta de IG cuelgan del mismo
  Business de Meta, no hay que agregar ninguna variable nueva. Al token sí hay
  que **agregarle los permisos** `whatsapp_business_messaging` y
  `whatsapp_business_management` y regenerarlo — los de Instagram no alcanzan. El
  botón **Probar** le pregunta a Meta antes de que falle el primer envío.
- **El ID de WhatsApp se conecta desde el panel**, no por variables: el id del
  número, el de la WABA y el de la app viven en `wa_conexion`. **El token no está
  en la base** —solo el nombre de la variable de Railway que lo contiene, y solo
  se aceptan nombres que empiecen por `IG_` o `WA_`—, mismo criterio que
  `ig_cuentas`.
- **Contactos**: nombre + teléfono, uno por uno o pegando/subiendo un CSV. Se
  normalizan a E.164 con el **código de país que se elige en el desplegable**,
  que arranca en **+51** porque es casi toda la lista; un número escrito con `+`
  o `00` manda sobre esa elección. Se pueden editar y borrar.
- **Enviar una plantilla a uno solo**: se elige la plantilla arriba de la tabla y
  cada fila tiene su botón **Enviar**, con confirmación. Sale en el momento, con
  el nombre del contacto en `{{1}}`, y queda en el historial marcado como envío
  directo. Para varios a la vez, **Campañas**.
- Meta solo deja enviar **plantillas aprobadas** y a quien dio su consentimiento.
  Una plantilla nueva tarda de minutos a horas; el estado se refresca con
  *Sincronizar*.

**Está desplegado y funcionando en producción**, pero **sin conectar todavía**:
faltan el ID del número y el de la WABA, que se ponen en la pestaña *Conexión*.
Hasta que eso pase, crear plantillas y enviar responden 503 con el motivo, y el
panel avisa arriba qué falta.

El copy del primer envío —BOX SIMONA— ya está escrito y con sus fuentes citadas
en `marketing/whatsapp/box-simona.md`. Todo el detalle de la integración, en
`integrations/whatsapp/README.md`.

### La web

Primera pasada del sistema Florencia sobre `app/`:

- Blanco total. Fuera el fondo floral generado de la portada, las manchas de
  acuarela globales y la foto de carretilla fija del catálogo.
- El hero era un video de banco de imágenes. Pasó por **la vitrina**
  (`HeroVitrina.tsx`, foto sangrando por la derecha) y hoy en la portada va
  **el herbario** (`HeroHerbario.tsx`): la mecánica de la referencia
  «Leandra Isler» —lienzo de borde a borde, la escala como única jerarquía, la
  planta apoyada sobre el papel sin marco, filete de 1 px, enlaces subrayados en
  vez de píldoras— vestida con Florencia. La vitrina queda en el repo sin usar,
  como repuesto: volver es cambiar dos líneas en `Home.tsx`.
- La misma mecánica abre las páginas interiores, con el producto **calado**:
  `EncabezadoCalado` (en `Seccion.tsx`) para condolencias y suscripción, y a mano
  en el catálogo. Los calados se hacen con `design/calar.py` —rembg sobre la foto
  real, nada generado— y viven en `app/public/calados/`. Hace falta
  `pip install rembg onnxruntime` (baja un modelo de 176 MB la primera vez), así
  que en una sesión nueva no está instalado.
- Una sola cabecera en todo el sitio.
- Datos comunes en `app/src/lib/tienda.ts`: redes, contacto, medios de pago y
  la letra chica de producto. La letra chica tiene que decir lo mismo en la
  ficha, el pie y el checkout.

### El panel de admin en el teléfono

El admin se usa desde el celular y no entraba. Las siete secciones vivían en una
tira horizontal que se apretaba hasta ser ilegible; ahora, por debajo de `lg`,
la navegación es un **cajón lateral** (la barra dice en qué sección estás y el
botón lo abre) y de `lg` para arriba siguen las pestañas de siempre. El corte es
`lg` y no `md` porque las siete pestañas piden unos 940 px: en una tablet de 768
se salían de la pantalla.

**La navegación va pegada al borde superior**, así se alcanza desde cualquier
punto del scroll sin volver al principio de una lista larga.

De paso se cerraron dos desbordes horizontales que hacían que la página se
pudiera arrastrar de lado: la tira de estados de Pedidos y, en Productos, el
buscador con sus dos botones. Comprobado a 360, 390, 640, 768, 1024, 1100 y
1280 px que `scrollWidth == clientWidth` en todos.

### Los seis puntos pedidos

| | |
|---|---|
| 1 | Categoría «Tierras y sustratos» |
| 8 | «Accesorios» visible en portada, catálogo y pie |
| 4 | Redes junto al contacto, en el pie |
| 5-6 | Los dos avisos debajo de cada producto, en la ficha |
| 7 | Medios de pago: bloque en la ficha, línea en el pie |

Las dos categorías nuevas no tienen productos: en portada la tarjeta dice
«muy pronto» en vez de ponerles la foto de otra categoría.

---

## Lo que queda pendiente

### 0. Lo primero: dejar lista la plantilla del BOX SIMONA

Es lo que quedó a medias y para lo que se abre la sesión nueva. El copy ya está
escrito y con sus fuentes citadas en **`marketing/whatsapp/box-simona.md`** —
no hay que volver a redactarlo.

El encargo del cliente es explícito: **la plantilla la crea la sesión, no él.**
Orden de trabajo:

1. Comprobar que `graph.facebook.com` ya está permitido (ver la sección de
   arriba). Si sigue bloqueado, no se puede hacer nada de esto: decirlo y parar.
2. Con `IG_ACCESS_TOKEN`, preguntar a Meta qué abre ese token —**los permisos de
   Instagram no alcanzan**, hacen falta `whatsapp_business_messaging` y
   `whatsapp_business_management`:
   ```sh
   # scopes del token, sin imprimir el token
   curl -sS "https://graph.facebook.com/v21.0/debug_token?input_token=$IG_ACCESS_TOKEN&access_token=$IG_ACCESS_TOKEN" \
     | python3 -c 'import json,sys; d=json.load(sys.stdin)["data"]; print(d.get("type"), d.get("app_id"), d.get("scopes"))'
   ```
3. Sacar de Meta el **ID del número** y el **ID de la WABA**:
   `/me/businesses` → `/{business}/owned_whatsapp_business_accounts` →
   `/{waba}/phone_numbers`. Con el token alcanza; no hace falta el panel.
4. **Crear la plantilla** con el cuerpo de `box-simona.md`:
   `POST /{waba}/message_templates`. Esto sí se puede hacer con el token solo.
5. Pasar esos dos ids a la pestaña *Conexión* del panel. **Acá hace falta el
   cliente**: guardar la conexión es `POST /api/admin/wa/conexion`, que va detrás
   del login del admin, y la sesión no tiene esas credenciales (viven en Railway
   como `ADMIN_USER` / `ADMIN_PASS` y **no deben pedirse ni copiarse acá**). Son
   dos campos: se le pasan los ids ya averiguados y los pega él en 30 segundos.
   Sin eso el panel no puede enviar, aunque la plantilla ya exista en Meta.
6. Avisarle que Meta revisa la plantilla (de minutos a horas) y que hasta que
   quede `APPROVED` no se puede enviar; el estado se refresca con *Sincronizar*
   —leer antes el punto 0b, que ahí hay un agujero.

**Ojo con la foto del encabezado:** la del catálogo es vertical y WhatsApp la
mostraría cortada. Hay que preparar una horizontal con el producto entero antes
de usarla — está explicado al final de `box-simona.md`. Una plantilla de solo
texto se puede crear ya mismo; con foto, primero la foto.

### 0b. Agujero conocido: sincronizar no da de alta plantillas

Si la plantilla se crea **directo contra Meta** (no por `POST
/api/admin/wa/templates`), **no aparece en el panel**, y por lo tanto no se
puede enviar desde ahí. La causa está localizada:
`db/whatsapp-store.js → updateTemplateStatus()` es un `UPDATE ... WHERE name AND
language` pelado — refresca el estado de las que ya existen localmente y no
inserta las que no.

Arreglo, si se toma ese camino: pedirle a Meta también `components` en
`listTemplates()` (`integrations/whatsapp/client.js`) y convertir esa función en
un upsert, sacando de los componentes el `body_text`, el `header_kind` y los
botones.

Queda un cabo suelto aunque se haga: **una plantilla con foto adoptada desde
Meta no trae los bytes de la foto**, y `runCampaign()` los necesita para subir el
`media id` en cada envío. Dos salidas — guardar la foto en la fila con un
endpoint nuevo, o enviar el encabezado por `link` público (Meta acepta
`image: { link }`, y las fotos de producto ya son públicas en
`limaflores.pe/products/…`). **Lo más simple es no meterse en esto**: crear la
plantilla por la API del panel, que ya deja la fila y los bytes en su sitio de
una sola pasada.

### El resto

1. **Faltan los puntos 2 y 3** de la lista del cliente — nunca llegaron, saltó
   del 1 al 4. Hay que pedírselos.
2. **Categorías repetidas en la base de producción.** Aparecían dos
   «Accesorios». La causa está tapada (`ensureSeeded` ahora compara también por
   etiqueta), pero **la fila duplicada sigue en la base**. Se limpia desde la
   consola de Railway — este contenedor no tiene `DATABASE_URL`:
   ```sh
   node scripts/dedupe-categories.js            # solo informa
   node scripts/dedupe-categories.js --aplicar  # mueve productos y borra
   ```
3. **Pulir el resto de la web** a la altura del hero nuevo: suscripción,
   checkout, condolencias, y las secciones internas de la portada (manifiesto,
   historia del atelier).
4. **La franja de entrega no coincide con el checkout.** Ver la regla de arriba:
   la copia promete 30 minutos y el código da cuatro horas. Es una decisión de
   operación, no de diseño.
5. **Confirmar cuánto dura la flor.** El hero dice «Llega mañana. Se queda
   meses.» y esa segunda frase **no sale de ninguna fuente**: el catálogo no dice
   cuánto florece una Phalaenopsis. Es la única afirmación del sitio sin
   respaldo, y está puesta a pedido del cliente. Preguntar a la dueña y anotarlo
   —o cambiar la frase, que es una línea en `HeroHerbario.tsx`.
6. **Sanear el catálogo**: `box-lupita` tiene la descripción de otro producto, y
   la foto del Arreglo Florencia es un gráfico de marketing con el texto quemado
   encima — no sirve para un creativo.

---

## Trampas del entorno, para no volver a tropezar

- **Chromium no baja de 500 px de viewport** y su alto queda ~78 px por debajo
  del `--window-size`. Se pide de más y se recorta.
- **Sin `<meta charset>`, Chromium abre `file://` como windows-1252** y parte
  todos los acentos.
- **Una imagen es un elemento reemplazado**: con `left` y `right` puestos y
  `width:auto` el navegador ignora `right` y usa el tamaño del archivo. Va
  dentro de un div con los cuatro lados y el 100% adentro.
- **Algo puede leer un archivo desde fuera del repo.** Al borrar `site/` se
  buscó quién lo leía *dentro* del código y no apareció nada roto — pero un
  workflow de GitHub Actions subía esa carpeta a Pages en cada push, y reventó.
  Antes de borrar una carpeta, mirar también `.github/workflows/`.
- El login del admin corta a los **8 intentos por IP cada 15 minutos**
  (`server.js:99`), en memoria: un redeploy lo limpia.
- `claudeusercontent.com` está bloqueado por el proxy, así que las vistas
  previas de Claude Design no se pueden capturar desde acá.
- **`limaflores.pe` también está bloqueado por el proxy**: la web en producción
  no se puede abrir desde la sesión. Para mirar la interfaz hay que levantarla
  local — `PG_MEM=1` monta un Postgres en memoria y no hace falta base de datos:
  ```sh
  npm i --no-save pg-mem puppeteer-core
  cd app && npm ci && npm run build && cd ..
  PG_MEM=1 ADMIN_USER=demo ADMIN_PASS=demo1234 \
    ADMIN_SESSION_SECRET=cualquiercosalarga PORT=8099 node server.js &
  ```
  Y las capturas, con el Chromium del sistema:
  `puppeteer-core` + `executablePath: '/opt/pw-browsers/chromium'`. Así se revisó
  el admin en móvil. `pg-mem` **no** está en `package.json` a propósito: sumarlo
  engorda el build de Railway por un script de prueba.
- El estado del deploy se mira con el MCP de Railway (`list-deployments`,
  `get-logs`): proyecto **Lima Flores**, servicio `lima-flores`, que despliega
  desde **`main`**. Un push a otra rama no llega a producción — ya pasó: se
  perdió un rato buscando por qué el panel no tenía los cambios.
