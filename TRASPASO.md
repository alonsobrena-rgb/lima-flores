# Traspaso — dónde está el proyecto

Resumen para retomar en una sesión nueva. Todo lo que sigue está en `main`,
subido, con el árbol limpio.

---

## Antes de empezar: la sesión nueva necesita dos cosas

Se quiere generar imágenes con Higgsfield. Hacen falta **las dos**, y ninguna
aplica a una sesión ya abierta — las variables se inyectan al arrancar el
contenedor, así que hay que abrir sesión **después** de configurarlas.

1. **Permitir el dominio en la política de red del entorno**
   (`claude.ai/code` → entorno). Sin esto la llamada muere antes de
   autenticarse: probado, el gateway responde
   `403 to CONNECT · platform.higgsfield.ai:443`.
   Doc: https://code.claude.com/docs/en/claude-code-on-the-web
2. **Las variables**, con estos nombres exactos — son los que leen los seis
   scripts de `integrations/higgsfield/`:
   - `HF_API_KEY`
   - `HF_API_SECRET`

Para verificar en la sesión nueva, antes de gastar créditos:

```sh
curl -sS --max-time 20 "$HTTPS_PROXY/__agentproxy/status" | head -20   # ¿hay rechazos?
node integrations/higgsfield/probe.js                                   # ¿autentica?
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
