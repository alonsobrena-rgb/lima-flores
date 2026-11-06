# Catálogo — una página por producto

`build.mjs` arma cada página (1080 × 1350, 4:5) a partir de `catalogo.json` y la
deja en `paginas/<id>.jpg`.

```sh
node marketing/catalogo/build.mjs              # todas
node marketing/catalogo/build.mjs box-yani     # una, para iterar
```

## Qué cambió respecto del catálogo del año pasado

| Antes | Ahora | Por qué |
|---|---|---|
| Foto dentro de un marco verde | Foto a sangre | El marco es la «cajita» que prohíbe `DESIGN.md`: el producto manda |
| Fondo marfil | Ciclorama de la propia foto | El marfil `#F6F3EC` es el fondo viejo del sistema |
| Advertencia de alcohol girada sobre la foto | Al pie, horizontal | La ley pide que esté; girada sobre el ciclorama no se lee |
| Nombre en monoespaciada gris, todo centrado | Cormorant itálica, colgado del margen izquierdo | Tipografía y alineación de Florencia |
| `S/180.00` debajo del nombre | `S/ 180` a la derecha, más chico que el nombre | Ficha de producto del sistema |

## De dónde sale cada dato

Nombre, categoría, precio y descripción se leen de `db/products.seed.json`; no
se escriben en `catalogo.json`. Lo único que va en `catalogo.json` es qué foto
usar, cuánto subirla y las **erratas** que se corrigen al imprimir. Las erratas
quedan a la vista ahí para que se arreglen también en la base.

## Lo que el build no deja pasar

Una sonda mide el producto dentro de la página y el build falla si el producto
toca un borde o si el logotipo o el texto lo pisan. Aun así, **cada página se
abre antes de entregarla**: la regla 4 de `.claude/skills/piezas-graficas/`.
