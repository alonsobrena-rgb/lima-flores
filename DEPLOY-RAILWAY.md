# Deploy a Railway — activar cotización Urbaner en vivo

> **Por qué Railway sobre Vercel:** preferencia del cliente. Funciona igual de bien para nuestro caso (sitio estático + 1 endpoint Node).
>
> **Costo:** Railway ya no tiene tier 100 % gratuito permanente. Hay un **free trial de $5 USD de crédito** suficiente para semanas de uso bajo (este sitio gasta muy poco). Después, el **Hobby plan ($5 USD/mes)** cubre proyectos pequeños. Si quieres 100 % gratis, mejor Vercel (`DEPLOY-VERCEL.md`).

---

## Paso 1 — Conectar el repo (5 min, todo desde el dashboard)

1. Entra a https://railway.app → **Login** → **Continue with GitHub** (usa la cuenta `alonsobrena-rgb`).
2. En el dashboard click **+ New Project** → **Deploy from GitHub repo**.
3. Si es la primera vez, Railway te pedirá instalar su GitHub App. Marca **Only select repositories** → elige `lima-flores` → **Install & Authorize**.
4. De vuelta en Railway, selecciona el repo `alonsobrena-rgb/lima-flores`.
5. Railway empieza a buildear automáticamente. **NO importa si el primer build falla** — lo vamos a arreglar con env vars en el paso 2.

## Paso 2 — Variables de entorno (credenciales Urbaner)

1. En el proyecto recién creado, click sobre el servicio (cuadro con el nombre `lima-flores`).
2. Tab **Variables** → **+ New Variable** (o **Raw Editor** si quieres pegar todo de un golpe).

Modo Raw Editor (lo más rápido), pega:

```
URBANER_ENV=production
URBANER_EMAIL=alonsomartinbrena@gmail.com
URBANER_PASSWORD=Salvador04#
```

3. Click **Save Variables**. Railway re-deploya automáticamente (~30 s).

## Paso 3 — Generar dominio público

1. Mismo servicio → tab **Settings** → sección **Networking** → click **Generate Domain**.
2. Te da una URL tipo `lima-flores-production-xxxx.up.railway.app`.

## Paso 4 — Verificar

Abre en tu navegador:

1. `https://<tu-url>.up.railway.app/` → el sitio debe verse igual que en GitHub Pages.
2. `https://<tu-url>.up.railway.app/api/quote?lat=-12.0972&lng=-77.0363` → debe responder algo como:
   ```json
   {"price":9,"currency":"PEN","order_type":"NEXTDAY","distance_m":3878,"duration_s":588}
   ```
3. `https://<tu-url>.up.railway.app/checkout.html` → agrega un producto al carrito, ve al checkout, elige distrito **San Isidro** → el campo "Envío estimado" debe cambiar de `— por calcular` a `S/ 9.00 · Urbaner NEXTDAY`.

---

## Cómo funciona el deploy

```
git push origin main
        │
        ▼
GitHub recibe el commit
        │
        ▼ (webhook automático)
Railway detecta cambios → builds con NIXPACKS
        │
        ▼
Detecta Node por package.json → npm install (cero deps aquí) → ejecuta `node server.js`
        │
        ▼
server.js escucha en $PORT, sirve site/ y monta /api/quote
        │
        ▼
Tu URL pública responde con el sitio + la cotización Urbaner en vivo
```

Cada `git push` a `main` dispara un re-deploy automático. No tienes que tocar nada en Railway después de la configuración inicial.

## Dominio propio (opcional, después)

Cuando compres un dominio (`limaflores.pe` o el que elijas):

1. Railway → Service → Settings → Networking → **Custom Domain** → ingresa el dominio.
2. Railway te muestra el record DNS a crear (un CNAME).
3. Vas a tu registrador (GoDaddy, Cloudflare, Namecheap…) y agregas el CNAME.
4. Espera ~5 min. SSL es automático.

## Cuando llegue 99minutos

Cuando te aprueben las credenciales:

1. Agrega `NINETYNINE_CLIENT_ID` y `NINETYNINE_CLIENT_SECRET` a Railway Variables.
2. Yo modifico `/api/quote.js` para cotizar con ambos y devolver el más barato.

## Troubleshooting

- **Build falla con "no engines specified":** revisa que `package.json` tenga `"engines": { "node": ">=18" }`.
- **`/api/quote` devuelve 401 Urbaner login:** las variables de entorno no se guardaron — revisa Variables tab.
- **Health check timeout:** Railway pide que el server responda en `/` dentro de 30 s. Si tarda más, sube el `healthcheckTimeout` en `railway.json`.
- **GitHub no aparece en Railway:** ve a https://github.com/settings/installations → Railway → Configure → marca `lima-flores`.
- **Quieres apagar GitHub Pages:** GitHub repo → Settings → Pages → Source = None. (O déjalo en paralelo; el campo de envío mostrará "Coordinamos por WhatsApp" porque no tiene `/api`.)
