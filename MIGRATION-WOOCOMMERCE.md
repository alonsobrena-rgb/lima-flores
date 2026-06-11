# Migración WooCommerce → site nuevo

> Pendiente: que Fiorella nos pase las API keys de la tienda actual.
> 48 productos confirmados en https://limaflores.pe/tienda/ (3 páginas × 16).

---

## Paso 1 — Que Fiorella genere las API keys

1. Entrar a https://limaflores.pe/wp-admin (con su usuario admin de WordPress).
2. Menú lateral: **WooCommerce → Settings**.
3. Tab **Advanced** (arriba).
4. Click en el link **REST API**.
5. Botón **"Add key"** (o "Crear una clave de API").
6. Llenar:
   - **Description**: `Migración Lima Flores 2026`
   - **User**: su usuario admin
   - **Permissions**: `Read` (NO write — por seguridad)
7. Click **"Generate API Key"**.
8. La pantalla muestra **una sola vez** dos strings:
   - **Consumer Key** → empieza con `ck_...`
   - **Consumer Secret** → empieza con `cs_...`
9. **Copiarlos a un sitio seguro** (gestor de passwords, Notion, etc.) y pasármelos por canal privado.
   ⚠️ Si cierra la pantalla sin copiarlos, hay que regenerarlos — no se pueden ver de nuevo.

---

## Paso 2 — Yo extraigo los datos (cuando tenga las keys)

```bash
# Una sola llamada autenticada, trae los 48 productos completos:
curl -u ck_XXXX:cs_XXXX \
  'https://limaflores.pe/wp-json/wc/v3/products?per_page=100&status=publish' \
  > productos-woocommerce.json

# Y las categorías reales:
curl -u ck_XXXX:cs_XXXX \
  'https://limaflores.pe/wp-json/wc/v3/products/categories?per_page=100' \
  > categorias-woocommerce.json
```

Lo que devuelve por cada producto (campos relevantes):
- `id`, `name`, `slug`
- `price`, `regular_price`, `sale_price`
- `description` (HTML largo) y `short_description`
- `categories` (array con id + nombre)
- `tags` (array)
- `images` (array con URL original sin redimensionar, `src`)
- `attributes` (talla, color, etc. si las usan)
- `stock_status`, `stock_quantity`
- `weight`, `dimensions`
- `meta_data` (SEO, custom fields)

---

## Paso 3 — Mapeo de categorías

La tienda nueva tiene **4 categorías principales**. Las 8 de WooCommerce se mapean así:

| WooCommerce origen | Nueva categoría | Notas |
|---|---|---|
| Arreglos | `arreglos` | directo |
| Ramos | `ramos` | directo |
| Florero | `floreros` | renombrar |
| Macetas y plantas | `plantas` | renombrar |
| Boxes | `arreglos` | subtipo de arreglo |
| Celebra el Amor | (tag) `amor` | no es categoría principal — etiqueta estacional |
| Feliz Día Mamá | (tag) `mama` | etiqueta estacional |
| Regalos | (tag) `regalos` | etiqueta genérica |

Los productos que estaban en categorías estacionales pasan a su categoría principal real (ej. "Box Lupita" estaba en `Boxes, Celebra el Amor, Feliz Día Mamá` → queda en `arreglos` con tags `["amor", "mama"]`).

---

## Paso 4 — Imágenes

1. **Descargar la imagen `images[0].src` de cada producto** (URL original, sin sufijo `-380x380`).
2. Guardar en `site/assets/products/<slug>.jpg`.
3. Optimizar a **800×800 max** con compresión JPEG quality 85 (~150 KB cada una).
   - Total estimado: ~7 MB para los 48 productos.
4. Si un producto tiene varias imágenes (`images[1]`, `images[2]`, etc.), guardar también como `<slug>-2.jpg`, `<slug>-3.jpg` para galería.

Herramientas que puedo usar: `sharp` (Node), `imagemagick`, o un script Node de una sola pasada.

---

## Paso 5 — Reescribir `site/js/data.js`

Convertir cada producto al formato del nuevo sitio:

```js
{
  id: 'slug-del-producto',
  name: 'Box Lupita',
  category: 'arreglos',
  categoryLabel: 'Arreglos',
  price: 220,
  image: 'assets/products/box-lupita.jpg',
  palette: '#E8DDD0',  // auto-detectada del thumbnail con sharp
  tags: ['amor', 'mama'],
  shortDesc: '<extraído de short_description, máx 120 chars>',
  description: '<extraído de description, limpio HTML>',
  details: [
    ['Composición', '...'],  // si está en attributes
    ['Duración', '...'],
  ]
}
```

Auto-detectar el `palette` (color dominante) sacando el promedio HSL del thumbnail con `sharp` — es lo que da el degradé bonito en la card del catálogo.

---

## Paso 6 — Verificación

1. Borrar productos placeholder actuales (Toscana, Amalfi, Bohemia, etc. — son inventados míos).
2. Levantar el sitio local: `node server.js` → http://localhost:3000/catalogo.html
3. Revisar que se vean los 48 productos, las imágenes carguen, los filtros por categoría funcionen.
4. Confirmar con Fiorella antes de pushear a producción.

---

## Riesgo a tener en cuenta

- **Antes de borrar los productos placeholder**, hacer un commit aparte con la migración para poder revertir si algo sale mal.
- **La URL `/wp-json/wc/v3/products` puede estar bloqueada** por algún plugin de seguridad (Wordfence, etc.). Si Fiorella dice "no me deja generar la key", revisar plugins de seguridad primero.
- **Permisos Read-only**: nunca pedirle `Read/Write` — con `Read` basta y reduce el riesgo de tocar algo por error.
