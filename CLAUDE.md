# Lima Flores

Tienda y atelier botánico de Lima: sitio en React (`app/`), backend Node sin
framework (`server.js`, `api/`), Postgres en Railway (`db/`), integraciones de
reparto, pagos, Instagram y WhatsApp (`integrations/`), y las fábricas de
marketing (`marketing/`). El README de cada carpeta cuenta lo suyo; `DESIGN.md`
el sistema visual y `TRASPASO.md` lo que quedó pendiente.

Todo se escribe en español, comentarios incluidos, y los comentarios explican
**por qué** algo está así —el error que evitan—, no qué hace la línea de abajo.

## Reglas de la casa

Las dos que más caro salen si se rompen. Cada una tiene su skill con el detalle;
léela antes de tocar esa parte:

- **Una plantilla de WhatsApp se crea de a dos**: la que saluda por el nombre
  (`{{1}}`) y su gemela `_sin_nombre`. Más de un tercio de los contactos no tiene
  nombre guardado y Meta congela el cuerpo al aprobarlo, así que con una sola
  plantilla a esa gente le llega «Hola&nbsp;&nbsp;,». Nunca se crea una sin la
  otra. → `.claude/skills/plantillas-whatsapp/SKILL.md`
- **Una pieza gráfica no se entrega sin abrirla**, el producto va entero y nada
  de lo que afirma se inventa. → `.claude/skills/piezas-graficas/SKILL.md`

Y una que vale para las dos y para el sitio: **precios, composición y tiempos
salen del catálogo, de `PROMESAS` o del checkout**. Si un dato no está ahí, no se
escribe.

## Cosas que conviene saber antes de romperlas

- **En la base nunca va un token**, solo el **nombre** de la variable de entorno
  que lo contiene (`ig_cuentas`, `wa_conexion`).
- **Las migraciones corren solas** al arrancar el server: se agregan al `SCHEMA`
  de `db/index.js` como `ALTER TABLE … ADD COLUMN IF NOT EXISTS`, idempotentes.
- **La franja horaria de entrega no se promete en marketing**: el sitio dice 30
  minutos y el checkout da franjas de cuatro horas. «Desde el día siguiente» es
  lo único seguro hasta que se decida (pendiente 4 de `TRASPASO.md`).
