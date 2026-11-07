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
| Nombre en monoespaciada gris | Nombre en Cormorant itálica, el precio debajo y más chico | Tipografía de Florencia; el precio nunca más grande que el nombre |

**Centrado y en verde, a pedido del cliente.** La ficha va centrada, como en el
catálogo anterior, y todo el texto en `#41542B`, el verde del marco de ese
catálogo (medido sobre su página de Box Yani). No es un token de Florencia: el
verde del sistema (`#88A65C`) se probó y sobre el ciclorama da contraste 2,4,
ilegible en la descripción; `#41542B` da 7,3. Está en `VERDE`, en `build.mjs`.

## De dónde sale cada dato

Nombre, categoría, precio y descripción se leen de `db/products.seed.json`; no
se escriben en `catalogo.json`. Ahí solo va qué foto usar y las **erratas** que
se corrigen al imprimir, a la vista para que se arreglen también en la base.

«Incluye tarjeta de dedicatoria sin costo» se agrega a todas las páginas y se lee
de `PROMESAS` (`app/src/lib/tienda.ts`): si la promesa cambia en la tienda,
cambia en el catálogo.

## Fotos

La foto puede ser una del catálogo de la tienda (`box-rogelia-3.jpg`) o una
propia del impreso, en `fotos/` (`fotos/box-yani-frontal.jpg`), cuando la toma
de la tienda no es la mejor para una página.

**El encuadre es automático.** La plantilla mide el producto y lo centra en el
hueco entre el logotipo y la ficha. Si a todo el ancho no entra, achica la foto,
nunca la recorta. Lo que la foto no cubre se rellena estirando su propia fila o
columna de borde, para que el ciclorama siga sin costura. Antes de eso se
descarta un 2% de cada filo: el viñeteado del borde, estirado, dejaba una franja
oscura cruzando la página (pasó con Box Gaby Café).

## Lo que el build no deja pasar

La página no se genera si el producto toca un borde, si el logotipo o el texto
lo pisan, si es más alto que el hueco libre o si llega al filo de la foto que se
descarta. Aun así, **cada página se abre antes de entregarla**: la regla 4 de
`.claude/skills/piezas-graficas/`.

`DEPURAR=1 node marketing/catalogo/build.mjs <id>` imprime lo que midió la sonda.

## Catálogo de Navidad

El catálogo de Navidad del año pasado (Canva, 9:16) se **edita** en vez de
rehacerse: el cliente quiere mantener el diseño navideño. Los cambios están en
`navidad.py` (páginas que se quitan, fotos que se sacan dejando el recuadro y
dónde entran las páginas nuevas), así que se puede volver a armar desde el
original cada vez que el cliente pida otro ajuste:

```sh
FORMATO=historia node marketing/catalogo/build.mjs     # páginas nuevas en 9:16
python3 -I marketing/catalogo/navidad.py <original.pdf>  # → navidad/catalogo-navidad.pdf
```

Pendiente: la foto nueva de Regalos corporativos y las fotos reales de Centros
de mesa (sus recuadros quedan vacíos).

Los textos que se reescriben (por ahora, los de la página 2) están en
`textos-navidad.mjs`: salen como PDF vectorial en Cormorant y Jost, en el verde
del catálogo de Navidad (`#105B34`), y `navidad.py` los coloca después de borrar
solo el texto viejo. El orden completo:

```sh
FORMATO=historia node marketing/catalogo/build.mjs
node marketing/catalogo/textos-navidad.mjs
python3 -I marketing/catalogo/navidad.py <original.pdf>
```
