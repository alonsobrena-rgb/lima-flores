#!/usr/bin/env node
// Manda a revisión de Meta las plantillas de `plantillas.json`.
//
//   node marketing/whatsapp/crear.js            # las tres
//   node marketing/whatsapp/crear.js florero_forti
//   node marketing/whatsapp/crear.js --revisar  # solo valida, no llama a Meta
//   node marketing/whatsapp/crear.js --estado   # qué dice Meta de las que ya están
//
// Reusa `integrations/whatsapp/client.js`, que es el mismo cliente que usa el
// panel: la conexión sale de la tabla `wa_conexion` o, si no hay base, de las
// variables de entorno (WA_WABA_ID, WA_APP_ID y el token IG_ACCESS_TOKEN).
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

function urlDe(t) {
  return datos.base + t.producto;
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
  if (t.footer && t.footer.length > LIMITES.footer) malo.push(`el pie tiene ${t.footer.length} caracteres y el tope es ${LIMITES.footer}`);
  if (t.boton && t.boton.length > LIMITES.boton) malo.push(`el texto del botón tiene ${t.boton.length} y el tope es ${LIMITES.boton}`);
  if (url.length > LIMITES.url) malo.push('la URL pasa del tope');
  if (!CATALOGO.has(t.producto)) malo.push(`«${t.producto}» no existe en db/products.seed.json, el botón caería en un 404`);
  const cab = path.join(HERE, 'cabeceras', `${t.name}.jpg`);
  if (!fs.existsSync(cab)) malo.push('falta la cabecera: corre `python3 marketing/whatsapp/cabeceras.py`');
  if (!Array.isArray(t.fuentes) || !t.fuentes.length) malo.push('sin tabla de fuentes: el copy tiene que poder citarse');
  return malo;
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
      console.log(`  ✓ ${t.name.padEnd(18)} cuerpo ${String(t.body.length).padStart(4)}/${LIMITES.body}`
        + `  pie ${String((t.footer || '').length).padStart(2)}/${LIMITES.footer}`
        + `  botón → ${urlDe(t)}`);
    }
  }
  if (problemas) throw new Error(`${problemas} problema(s): no se mandó nada a Meta.`);
  if (soloRevisar) {
    console.log('\nRevisión local en orden. Sin --revisar, esto las manda a Meta.');
    return;
  }

  // 2. La conexión. Sin base de datos, sale de las variables de entorno.
  const conexion = null;
  const cfg = wa.config(conexion);
  if (estado) {
    if (!cfg.wabaId) throw new Error('Falta el ID de la WABA (WA_WABA_ID o la conexión del panel).');
    const enMeta = await wa.listTemplates(conexion);
    for (const t of lista) {
      const m = enMeta.find((x) => x.name === t.name);
      console.log(`  ${t.name.padEnd(18)} ${m ? `${m.status}${m.rejected_reason && m.rejected_reason !== 'NONE' ? ` (${m.rejected_reason})` : ''}` : '— no está en Meta'}`);
    }
    return;
  }

  if (!wa.canCreateTemplates(conexion)) {
    const falta = wa.faltantes(conexion);
    if (!cfg.appId) falta.push('el ID de la app de Meta (WA_APP_ID), que hace falta para subir la cabecera');
    throw new Error(
      `No se puede crear todavía. Falta: ${falta.join(', ')}.\n`
      + 'Los ids salen de WhatsApp Manager → API Setup. Además, la WABA tiene que estar\n'
      + 'asignada al System User del token en Business Settings → System Users → Add Assets.',
    );
  }

  // 3. Subir la cabecera y crear. La foto va por resumable upload y devuelve un
  //    handle; el handle es lo que Meta guarda como ejemplo de la plantilla.
  for (const t of lista) {
    const buffer = fs.readFileSync(path.join(HERE, 'cabeceras', `${t.name}.jpg`));
    const handle = await wa.uploadResumable(conexion, { buffer, mime: 'image/jpeg', filename: `${t.name}.jpg` });
    const res = await wa.createTemplate(conexion, {
      name: t.name,
      language: datos.idioma,
      category: t.category,
      bodyText: t.body,
      bodyExample: datos.ejemplo_nombre,
      headerHandle: handle,
      footerText: t.footer,
      buttons: [{ type: 'URL', text: t.boton, url: urlDe(t) }],
    });
    console.log(`  → ${t.name.padEnd(18)} ${res.status}  id ${res.id}`);
  }
  console.log('\nMandadas a revisión. `node marketing/whatsapp/crear.js --estado` para ver en qué van.');
}

main().catch((err) => {
  console.error(`\n${err.message}`);
  process.exit(1);
});
