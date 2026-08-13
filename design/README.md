# Florencia — el sistema de diseño

La dirección de marca de Lima Flores. Manda la **rosa `#9E2B5E`** sobre **blanco
total**, con contención y aire: la página respira antes de que aparezca el
catálogo. Vende por deseo, no por insistencia.

> Acá vivía una comparación de tres direcciones —Florencia, París y Ámsterdam—
> con su galería para el cliente y una página que las conmutaba en vivo. La dueña
> eligió Florencia y las otras dos se borraron, junto con el aparato de comparar:
> un sistema con tres opciones abiertas no es un sistema, es una encuesta. Están
> en el historial de git si alguna vez hicieran falta.

| | |
|---|---|
| **Fuente de verdad de los tokens** | `direcciones/florencia.css` |
| **La referencia portable**, para pasársela a otra persona | [`../DESIGN.md`](../DESIGN.md) |
| Los mismos tokens, aplicados en la tienda | `../app/src/index.css` · `../app/tailwind.config.js` |
| Las reglas que no se negocian | [`../TRASPASO.md`](../TRASPASO.md) |

## Los colores están medidos, no elegidos

```sh
python3 design/colores-logo.py
```

Agrupa por tono los píxeles del ramo acuarelado del logotipo, descarta el papel y
los grises de la marca, y de cada familia devuelve el color medio y el «hondo».
El ramo resulta ser **52 % rosa, 29 % verde, 13 % durazno y crema, 1,4 % azul**,
sobre el gris `#A2A19F` del logotipo.

Dos hallazgos que valieron el script: el `#9E2B5E` que estaba elegido a ojo quedó
a un pelo del hondo real `#930F57` — se confirma. Y el salvia `#7E8E6E` que se
venía usando **no existe en el logotipo**; se reemplazó por el verde medido
`#88A65C`.

Ese es el criterio de la casa: antes de elegir un color, medirlo. Si un diseño
necesita un color que no está en el ramo, está mal el diseño.

## Ver el sistema

```sh
python3 design/build.py     # arma la tienda + el sistema + los posts con los tokens
```

Sale a `design/salida/` (no versionado). Las tres piezas —`tienda.html`,
`sistema.html`, `posts.html`— son la misma maqueta que la tienda real, pintada
solo con las variables de `florencia.css`: si algo se ve distinto ahí y en la
tienda, es que un componente dejó de usar los tokens.

Las fotos y los precios salen de `db/products.seed.json` y de
`app/public/products/`, que es la única copia del catálogo desde que se borró el
sitio vanilla.
