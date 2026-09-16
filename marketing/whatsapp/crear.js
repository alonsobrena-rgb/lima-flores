#!/usr/bin/env node
// Manda a revisión de Meta las plantillas de `plantillas.json`.
//
//   node marketing/whatsapp/crear.js            # todas
//   node marketing/whatsapp/crear.js florero_forti
//   node marketing/whatsapp/crear.js --revisar  # solo valida, no llama a Meta
//   node marketing/whatsapp/crear.js --estado   # qué dice Meta de las que ya están
//   node marketing/whatsapp/crear.js --waba=123 --app=456   # ids a mano
//
// El botón de cada plantilla lleva a un producto (`producto` en plantillas.json)
// o a una ruta suelta del sitio (`ruta`): el catálogo filtrado por categoría, la
// suscripción. Los dos destinos se comprueban contra su fuente antes de mandar
// nada — el catálogo, las categorías y las rutas de App.tsx.
//
// Cada plantilla va DOS veces a Meta: la que saluda por el nombre («Hola {{1}},
// el Florero Forti…») y su gemela `_sin_nombre` («Hola, el Florero Forti…»),
// que es la que recibe un contacto sin nombre guardado. Meta congela el cuerpo
// al aprobarlo y no acepta un parámetro vacío, así que es la única forma de que
// ese saludo se lea bien. El cuerpo de la gemela sale del principal quitándole
// el hueco; una plantilla puede traer el suyo escrito en `body_sin_nombre`.
//
// Reusa `integrations/whatsapp/client.js`, que es el mismo cliente que usa el
// panel. De dónde salen los ids, en este orden:
//
//   1. los que se pasen por `--waba=` / `--app=` / `--phone=`;
//   2. la fila `wa_conexion`, que es donde los deja el panel del admin;
//   3. las variables de entorno WA_WABA_ID, WA_APP_ID, WA_PHONE_NUMBER_ID.
//
// El orden importa porque quien configura esto usa el panel, no Railway: la
// primera versión de este script solo miraba el entorno y por eso decía que
// faltaba todo aunque estuviera puesto. El token sí sale siempre del entorno
// (IG_ACCESS_TOKEN), que es la regla de la casa: en la base va el nombre de la
// variable, nunca el valor.
//
// Todo lo que se puede comprobar sin llamar a Meta se comprueba antes. Una
// plantilla rechazada no es gratis: cuenta contra la calidad de la WABA y hay
// que esperar a que Meta la revise para enterarse de que sobraba un carácter.
'use strict';

const fs = require('fs');
const path = require('path');

const wa = require('../../integrations/whatsapp/client.js');

const HERE = __dirname;
const ROOT = path.resolve(HERE, '../..');
const datos = JSON.parse(fs.readFileSync(path.join(HERE, 'plantillas.json'), 'utf8'));

// Límites de Meta para una plantilla de mensaje.
const LIMITES = { nombre: 512, body: 1024, footer: 60, boton: 25, url: 2000 };
const NOMBRE_OK = /^[a-z0-9_]+$/;

// El catálogo, para que el botón no apunte a un producto que no existe. Es el
// mismo criterio que las plantillas de ig-ads: un enlace muerto se ve perfecto
// hasta que alguien lo toca.
const CATALOGO = new Set(
  JSON.parse(fs.readFileSync(path.join(ROOT, 'db/products.seed.json'), 'utf8')).map((p) => p.id),
);

// Las categorías, por lo mismo: un `?cat=` con un slug que no existe no da 404,
// deja el catálogo mostrando todo — se ve bien y no lleva a donde dice. El
// catálogo en vivo sale de la base; este snapshot es el respaldo que la app trae
// dentro, así que un slug que no esté acá ya es sospechoso.
const CATEGORIAS = new Set(
  JSON.parse(fs.readFileSync(path.join(ROOT, 'app/src/data/categories.json'), 'utf8')).map((c) => c.slug),
);

// Las rutas de la app, leídas de App.tsx en vez de copiadas: una plantilla vive
// meses y las rutas se mueven. Las que llevan `:param` quedan fuera a propósito —
// /producto/:id se valida contra el catálogo, que es más estricto.
const RUTAS = new Set(
  [...fs.readFileSync(path.join(ROOT, 'app/src/App.tsx'), 'utf8').matchAll(/path="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((r) => r.startsWith('/') && !r.includes(':') && !r.includes('*')),
);

/**
 * A dónde lleva el botón. Una plantilla apunta a un producto (`producto`) o a
 * una ruta suelta del sitio (`ruta`): el catálogo filtrado, la suscripción.
 */
function urlDe(t) {
  return t.producto ? datos.base + t.producto : datos.sitio + t.ruta;
}

/** Los problemas del destino del botón. Un enlace muerto se ve perfecto. */
function revisarDestino(t) {
  if (t.producto && t.ruta) return ['tiene `producto` y `ruta`: el botón lleva a un sitio solo'];
  if (t.producto) {
    return CATALOGO.has(t.producto)
      ? []
      : [`«${t.producto}» no existe en db/products.seed.json, el botón caería en un 404`];
  }
  if (!t.ruta) return ['sin `producto` ni `ruta`: el botón no lleva a ninguna parte'];
  if (!datos.sitio) return ['la plantilla trae `ruta` y plantillas.json no tiene `sitio`'];
  const malo = [];
  if (!t.ruta.startsWith('/')) malo.push('la `ruta` tiene que empezar por «/»');
  const [camino, query] = t.ruta.split('?');
  if (!RUTAS.has(camino)) malo.push(`«${camino}» no es una ruta de app/src/App.tsx`);
  const cat = new URLSearchParams(query || '').get('cat');
  if (cat) {
    const sueltos = cat.split(',').filter((c) => c && !CATEGORIAS.has(c));
    if (sueltos.length) malo.push(`el filtro pide categorías que no existen: ${sueltos.join(', ')} (app/src/data/categories.json)`);
  }
  return malo;
}

/** El cuerpo de la gemela: el escrito a mano, o el principal sin el hueco. */
function cuerpoGemela(t) {
  return (t.body_sin_nombre || wa.cuerpoSinNombre(t.body)).trim();
}

/** ¿Esta plantilla tiene gemela? Solo tiene sentido si el cuerpo usa {{1}}. */
function tieneGemela(t) {
  return /\{\{1\}\}/.test(t.body || '') && t.sin_nombre !== false;
}

/** Todo lo que se puede saber sin preguntarle a Meta. Devuelve los problemas. */
function revisar(t) {
  const malo = [];
  const url = urlDe(t);
  if (!NOMBRE_OK.test(t.name)) malo.push(`el nombre «${t.name}» tiene que ser minúsculas, números y guiones bajos`);
  if (t.name.length > LIMITES.nombre) malo.push(`el nombre pasa de ${LIMITES.nombre}`);
  if (!t.body) malo.push('falta el cuerpo');
  if (t.body && t.body.length > LIMITES.body) malo.push(`el cuerpo tiene ${t.body.length} caracteres y el tope es ${LIMITES.body}`);
  // Meta exige un ejemplo por cada variable, y el cliente solo arma el de {{1}}.
  const vars = [...new Set((t.body || '').match(/\{\{\d+\}\}/g) || [])];
  if (vars.length > 1) malo.push(`usa ${vars.join(', ')} y el cliente solo manda ejemplo para {{1}}`);
  // Meta no aprueba un cuerpo que empiece o termine con una variable. Se revisa
  // acá porque el rechazo llega horas después y sin decir cuál era el problema.
  const cuerpo = (t.body || '').trim();
  if (/^\{\{\d+\}\}/.test(cuerpo)) malo.push('el cuerpo no puede empezar con una variable: Meta lo rechaza');
  if (/\{\{\d+\}\}$/.test(cuerpo)) malo.push('el cuerpo no puede terminar con una variable: Meta lo rechaza');
  if (t.footer && t.footer.length > LIMITES.footer) malo.push(`el pie tiene ${t.footer.length} caracteres y el tope es ${LIMITES.footer}`);
  if (t.boton && t.boton.length > LIMITES.boton) malo.push(`el texto del botón tiene ${t.boton.length} y el tope es ${LIMITES.boton}`);
  if (url.length > LIMITES.url) malo.push('la URL pasa del tope');
  malo.push(...revisarDestino(t));
  const cab = path.join(HERE, 'cabeceras', `${t.name}.jpg`);
  if (!fs.existsSync(cab)) malo.push('falta la cabecera: corre `python3 marketing/whatsapp/cabeceras.py`');
  if (!Array.isArray(t.fuentes) || !t.fuentes.length) malo.push('sin tabla de fuentes: el copy tiene que poder citarse');
  // La gemela: mismo cuerpo sin el hueco del nombre, así que se revisa igual.
  if (tieneGemela(t)) {
    const g = cuerpoGemela(t);
    if (!g) malo.push('la versión sin nombre queda vacía; escríbela en `body_sin_nombre`');
    if (g.length > LIMITES.body) malo.push(`la versión sin nombre tiene ${g.length} caracteres y el tope es ${LIMITES.body}`);
    if (/\{\{\d+\}\}/.test(g)) malo.push('la versión sin nombre no puede llevar variables');
    if (wa.nombreSinNombre(t.name).length > LIMITES.nombre) malo.push('el nombre de la versión sin nombre pasa del tope');
  }
  return malo;
}

/** Un `--clave=valor` de la línea de comandos. */
function flag(args, nombre) {
  const hit = args.find((a) => a.startsWith(`--${nombre}=`));
  return hit ? hit.slice(nombre.length + 3).trim() : '';
}

/**
 * La fila de conexión. La base solo se toca si hay DATABASE_URL: sin eso,
 * `db/index.js` deshabilita la persistencia y requerirlo revienta al primer
 * query. Si la base no está a mano, se sigue con el entorno y los flags.
 */
async function cargarConexion(args) {
  const manual = {
    waba_id: flag(args, 'waba'),
    app_id: flag(args, 'app'),
    phone_number_id: flag(args, 'phone'),
  };
  const puestos = Object.entries(manual).filter(([, v]) => v);

  let fila = null;
  if (process.env.DATABASE_URL) {
    try {
      fila = await require('../../db/whatsapp-store').conexion();
    } catch (e) {
      console.error(`  · no pude leer wa_conexion (${e.message}); sigo con el entorno.`);
    }
  }

  if (!fila && !puestos.length) return null;
  const cx = Object.assign({}, fila);
  for (const [k, v] of puestos) cx[k] = v;
  cx._origen = puestos.length
    ? (fila ? 'panel + línea de comandos' : 'línea de comandos')
    : 'panel (wa_conexion)';
  return cx;
}

async function main() {
  const args = process.argv.slice(2);
  const soloRevisar = args.includes('--revisar');
  const estado = args.includes('--estado');
  const pedidas = args.filter((a) => !a.startsWith('--'));
  const lista = pedidas.length
    ? datos.plantillas.filter((t) => pedidas.includes(t.name))
    : datos.plantillas;
  if (pedidas.length && !lista.length) throw new Error(`no existe ninguna de: ${pedidas.join(', ')}`);

  // 1. Revisión local, siempre. Si algo está mal, no se llama a Meta.
  let problemas = 0;
  for (const t of lista) {
    const malo = revisar(t);
    if (malo.length) {
      problemas += malo.length;
      console.error(`  ✗ ${t.name}`);
      for (const m of malo) console.error(`      ${m}`);
    } else {
      console.log(`  ✓ ${t.name.padEnd(22)} cuerpo ${String(t.body.length).padStart(4)}/${LIMITES.body}`
        + `  pie ${String((t.footer || '').length).padStart(2)}/${LIMITES.footer}`
        + `  botón → ${urlDe(t)}`);
      if (tieneGemela(t)) {
        console.log(`    + ${wa.nombreSinNombre(t.name).padEnd(20)} cuerpo ${String(cuerpoGemela(t).length).padStart(4)}/${LIMITES.body}`
          + `  «${cuerpoGemela(t).split('\n')[0].slice(0, 48)}…»`);
      }
    }
  }
  if (problemas) throw new Error(`${problemas} problema(s): no se mandó nada a Meta.`);
  if (soloRevisar) {
    console.log('\nRevisión local en orden. Sin --revisar, esto las manda a Meta.');
    return;
  }

  // 2. La conexión: panel primero, entorno después, y lo que diga la línea de
  //    comandos por encima de las dos.
  const conexion = await cargarConexion(args);
  const cfg = wa.config(conexion);
  console.log(`\n  conexión  WABA ${cfg.wabaId || '—'}  ·  app ${cfg.appId || '—'}`
    + `  ·  número ${cfg.phoneNumberId || '—'}  ·  token ${cfg.tokenEnv}${cfg.token ? '' : ' (no está en el entorno)'}`
    + `  ·  origen ${conexion && conexion._origen ? conexion._origen : 'entorno'}`);
  if (estado) {
    if (!cfg.wabaId) throw new Error('Falta el ID de la WABA (WA_WABA_ID o la conexión del panel).');
    const enMeta = await wa.listTemplates(conexion);
    const estadoDe = (nombre) => {
      const m = enMeta.find((x) => x.name === nombre);
      if (!m) return '— no está en Meta';
      const motivo = m.rejected_reason && m.rejected_reason !== 'NONE' ? ` (${m.rejected_reason})` : '';
      return `${m.status}${motivo}`;
    };
    for (const t of lista) {
      console.log(`  ${t.name.padEnd(28)} ${estadoDe(t.name)}`);
      if (tieneGemela(t)) console.log(`  ${wa.nombreSinNombre(t.name).padEnd(28)} ${estadoDe(wa.nombreSinNombre(t.name))}`);
    }
    return;
  }

  if (!wa.canCreateTemplates(conexion)) {
    const falta = wa.faltantes(conexion);
    if (!cfg.appId) falta.push('el ID de la app de Meta, que hace falta para subir la cabecera');
    throw new Error(
      `No se puede crear todavía. Falta: ${falta.join(', ')}.\n`
      + 'Si ya están puestos en el panel del admin, este script necesita DATABASE_URL para\n'
      + 'leer esa fila: córrelo con `railway run node marketing/whatsapp/crear.js`, o pásale\n'
      + 'los ids a mano con --waba= y --app= (son ids públicos de Meta, no secretos).',
    );
  }

  // 3. Subir la cabecera y crear. La foto va por resumable upload y devuelve un
  //    handle; el handle es lo que Meta guarda como ejemplo de la plantilla.
  // Lo que ya está en Meta se salta. Correr esto dos veces es lo normal —se
  // agrega una plantilla al archivo, o aparece la gemela de las que ya
  // existían— y sin esto la segunda corrida muere en la primera repetida con
  // un error de nombre duplicado, sin llegar a las que faltaban.
  const yaEstan = new Set((await wa.listTemplates(conexion)).map((x) => x.name));

  // Una plantilla y su gemela son lo mismo con otro cuerpo: se crean igual.
  const crear = async (nombre, bodyText, bodyExample, t, buffer) => {
    if (yaEstan.has(nombre)) {
      console.log(`  · ${nombre.padEnd(28)} ya está en Meta, se salta`);
      return;
    }
    // La foto se sube por plantilla: un handle es de un solo uso en la
    // práctica, y una subida de más sale más barata que una plantilla aprobada
    // a la que Meta no le encuentra la cabecera.
    const handle = await wa.uploadResumable(conexion, { buffer, mime: 'image/jpeg', filename: `${nombre}.jpg` });
    const res = await wa.createTemplate(conexion, {
      name: nombre,
      language: datos.idioma,
      category: t.category,
      bodyText,
      bodyExample,
      headerHandle: handle,
      footerText: t.footer,
      buttons: [{ type: 'URL', text: t.boton, url: urlDe(t) }],
    });
    console.log(`  → ${nombre.padEnd(28)} ${res.status}  id ${res.id}`);
  };

  for (const t of lista) {
    const buffer = fs.readFileSync(path.join(HERE, 'cabeceras', `${t.name}.jpg`));
    await crear(t.name, t.body, datos.ejemplo_nombre, t, buffer);
    if (tieneGemela(t)) await crear(wa.nombreSinNombre(t.name), cuerpoGemela(t), null, t, buffer);
  }
  console.log('\nMandadas a revisión. `node marketing/whatsapp/crear.js --estado` para ver en qué van.');
}

main().catch((err) => {
  console.error(`\n${err.message}`);
  process.exit(1);
});
