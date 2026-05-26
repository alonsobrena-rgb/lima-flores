# Deploy a Vercel — activar cotización Urbaner en vivo

GitHub Pages es 100 % estático, así que no puede correr la función `/api/quote.js`. Para que el checkout muestre el costo de envío real (cotizado por Urbaner) necesitamos un host que soporte funciones serverless.

**Vercel** es la opción más simple: gratis (Hobby tier), sin tarjeta de crédito, deploy automático desde el repo de GitHub. Toma ~5 minutos.

---

## Paso 1 — Crear cuenta y conectar el repo (5 min)

1. Entra a https://vercel.com/signup → **Continue with GitHub** (usa la misma cuenta de GitHub donde está `lima-flores`).
2. Cuando te pida permisos, dale acceso al repo `lima-flores` (puedes elegir "Only select repositories" y marcar solo ese).
3. En el dashboard, click **Add New… → Project**.
4. Selecciona el repo `alonsobrena-rgb/lima-flores` → **Import**.
5. En la pantalla de configuración:
   - **Framework Preset:** Other (déjalo así, Vercel detecta `vercel.json`)
   - **Root Directory:** `.` (raíz del repo)
   - **Build Command:** déjalo vacío (no hay build)
   - **Output Directory:** `site` (ya viene del `vercel.json`)
6. **NO le des Deploy todavía** — antes hay que poner las variables de entorno (paso 2).

## Paso 2 — Variables de entorno (las credenciales de Urbaner)

En la misma pantalla de **Import Project**, abre **Environment Variables** y agrega:

| Name | Value |
|------|-------|
| `URBANER_ENV` | `production` |
| `URBANER_EMAIL` | `alonsomartinbrena@gmail.com` |
| `URBANER_PASSWORD` | `Salvador04#` |

(Estos valores son los mismos que están en `integrations/urbaner/.env` local — ese archivo está en `.gitignore` y nunca se sube al repo. Vercel los inyecta como `process.env.*` en tiempo de ejecución.)

Aplica a: **Production + Preview + Development** (los tres checks).

Ahora sí: click **Deploy**.

## Paso 3 — Verificar (1 min)

Cuando termine el build (≈30 s), Vercel te da una URL tipo `lima-flores-xxx.vercel.app`. Abre:

1. `https://<tu-url>.vercel.app/` — el sitio debe verse igual que en GitHub Pages.
2. `https://<tu-url>.vercel.app/api/quote?lat=-12.0972&lng=-77.0363` — debe responder algo como:
   ```json
   {"price":9,"currency":"PEN","order_type":"NEXTDAY","distance_m":3878,"duration_s":588}
   ```
3. `https://<tu-url>.vercel.app/checkout.html` — agrega un producto al carrito, ve al checkout, elige distrito **San Isidro** → el campo "Envío estimado" debe cambiar de `— por calcular` a `S/ 9.00 · Urbaner NEXTDAY`.

## Paso 4 — Dominio (opcional, después)

- Vercel da `*.vercel.app` gratis (perfecto para empezar).
- Si compras un dominio (ej: `limaflores.pe`), entra a **Project → Settings → Domains → Add** y sigue las instrucciones de DNS (CNAME `cname.vercel-dns.com`). Vercel emite el certificado SSL automático.
- GitHub Pages puede quedar apagado (Settings → Pages → None) o convivir en paralelo en `alonsobrena-rgb.github.io/lima-flores/` — pero esa URL **no tendrá la cotización en vivo** (la función `/api` solo existe en Vercel).

---

## Cómo funciona el flujo end-to-end

```
Cliente abre /checkout.html
        │
        ├─ elige distrito "San Isidro" en el <select>
        │
        ▼
checkout.js  →  fetch('/api/quote?lat=-12.0972&lng=-77.0363')
                                  │
                                  ▼ (Vercel ejecuta la función Node)
                       api/quote.js  →  Urbaner POST /cli/price/
                                              (con URBANER_EMAIL/PASSWORD del env)
                                  │
                                  ◄── { price: 9, order_type: 'NEXTDAY', ... }
                                  │
                                  ▼
                       JSON al navegador
        │
        ▼
checkout.js actualiza "Envío estimado" → "S/ 9.00 · Urbaner NEXTDAY"
```

Las credenciales de Urbaner viven solo en el servidor (Vercel env vars). El navegador nunca las ve.

## Re-deploys

Cada `git push` a `main` dispara un deploy automático en Vercel. No tienes que hacer nada más.

## Cuando llegue 99minutos

Cuando te aprueben las credenciales de 99minutos:

1. Agrega `NINETYNINE_CLIENT_ID` y `NINETYNINE_CLIENT_SECRET` a Vercel (mismo flujo que Urbaner).
2. Modificamos `/api/quote.js` para cotizar con ambos y devolver el más barato (o ambos para que el cliente elija).
