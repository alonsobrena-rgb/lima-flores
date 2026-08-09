# Sistema de diseño de Claude Design — copia en el repo

Origen: proyecto **Lima Flores Design System** en Claude Design
(`6322844f-ea50-4887-9467-a7e287b76251`), leído por el MCP `claude_design`.

Esto es una **copia de lectura**, no la fuente. La fuente sigue siendo el
proyecto en Claude Design. Está acá para que el código del repo pueda consumir
los tokens y para poder versionarlos.

## Qué se trajo

- `styles.css` — punto de entrada, importa los cuatro archivos de tokens.
- `tokens/colors.css` · `typography.css` · `spacing.css` · `fonts.css`

## Qué falta traer

Los componentes (`components/core/*.jsx`), el kit de tienda
(`ui_kits/storefront/`), las fichas de guidelines y los binarios (logo y fotos).
Los binarios no se pueden leer por el MCP — hay que exportarlos aparte.

## El sistema en corto

Carrito de flores italiano: marfil cálido, aire, y **una sola rosa**.

| | |
|---|---|
| Fondo | `--ivory-100 #F6F3EC` — nunca blanco puro |
| Tinta | `--ink-900 #2A2623` — negro cálido, nunca `#000` |
| Acento | `--rosa-500 #9E2B5E`, sacado del ramo del logo |
| Apoyos | salvia `#7E8E6E`, durazno `#F0D9B5` |
| Títulos | Cormorant Garamond, seguido en itálica |
| Texto y UI | Jost |
| Firma | Pinyon Script, solo para florituras |
| Radios | 8px tarjetas, 4px inputs. Nada burbujeante |
| Sombras | casi inexistentes, cálidas |

## Un conflicto que hay que resolver antes de codificar

El `readme.md` del sistema propone copy de ejemplo con **entrega el mismo día**:

- «Te lo llevamos hoy»
- CTA «Enviar flores hoy»
- «Cada ramo se arma a mano el mismo día»

**Eso no es cierto.** Según `site/js/checkout.js` (`LEAD_MS = 24h`), la entrega
es **al día siguiente**, con día y franja de 30 minutos elegidos por el cliente.
Si ese copy se lleva a la tienda, se promete algo que no se cumple.

Al implementar, esas tres frases van reemplazadas por algo como «Elige el día y
la hora» o «Pídelo hoy, llega mañana».
