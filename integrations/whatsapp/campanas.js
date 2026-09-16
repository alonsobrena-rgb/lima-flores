// El envío de una campaña: subir la cabecera una vez y mandar plantilla por
// plantilla. Vive fuera del API porque hay dos cosas que lo disparan —el panel
// y el vigía de la agenda— y ninguna debería tener que requerir a la otra.
'use strict';

const waStore = require('../../db/whatsapp-store');
const wa = require('./client.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Con qué se rellena {{1}} cuando el contacto no tiene nombre y la plantilla
// tampoco tiene gemela aprobada. Es el último recurso: lo bueno es mandarle la
// gemela sin variable (abajo), porque acá el mensaje sale «Hola  ,» — la coma y
// el espacio son del cuerpo aprobado y desde el envío no se pueden quitar.
//
// Vacío no es opción: Meta rechaza un parámetro sin contenido. Un espacio suelto
// puede que también lo rechace (hay proveedores que documentan un mínimo de dos
// caracteres); si pasa, ese mensaje falla con el error a la vista en su fila y
// el resto de la campaña sigue saliendo.
const SIN_NOMBRE = ' ';

async function ejecutarCampana(campaignId, templateId, cx) {
  const template = await waStore.getTemplateFull(templateId);
  const camp = await waStore.getCampaign(campaignId);
  if (!template || !camp) return;
  const hasVar = /\{\{1\}\}/.test(template.body_text || '');

  // Red de seguridad. El sync baja la foto de muestra de Meta, así que esto no
  // debería pasar; pasa si esa descarga falló (URL caducada, red) y la fila
  // quedó con header de imagen y sin binario. Sin esto se enviaba sin cabecera
  // y Meta contestaba un error de componentes que no apunta al problema real.
  if (template.header_kind === 'image' && !template.header_image) {
    const falta = 'Esta plantilla tiene cabecera de imagen y su foto no está guardada acá.'
      + ' Dale a «Sincronizar estados» para que se baje de Meta, o vuelve a crearla desde el panel.';
    for (const m of camp.messages) await waStore.markMessage(m.id, { status: 'failed', error: falta });
    await waStore.bumpCampaign(campaignId, { failed: camp.messages.length });
    await waStore.finishCampaign(campaignId, 'failed');
    return;
  }

  // La gemela sin variable, para los contactos sin nombre. Solo si está
  // aprobada: Meta no deja enviar una plantilla que sigue en revisión, y si se
  // intenta el mensaje falla — mejor caer al relleno, que al menos sale.
  let gemela = null;
  if (hasVar && !wa.esSinNombre(template.name)) {
    const g = await waStore.getTemplateFullPorNombre(wa.nombreSinNombre(template.name), template.language);
    // Y solo si su foto está guardada acá: mandarla sin la cabecera que Meta le
    // aprobó es un error de componentes, y uno que no dice cuál es el problema.
    const sinFoto = g && g.header_kind === 'image' && !g.header_image;
    if (g && !sinFoto && String(g.status).toUpperCase() === 'APPROVED') gemela = g;
  }

  // La foto se sube una vez por plantilla y se reutiliza en todos los envíos.
  // El media id es del número, no de la plantilla, así que la gemela podría
  // compartirlo; se sube aparte igual porque puede tener otra foto.
  const fotos = new Map();
  const subirFoto = async (t) => {
    if (t.header_kind !== 'image' || !t.header_image) return null;
    if (!fotos.has(t.id)) {
      fotos.set(t.id, wa.uploadMedia(cx, {
        buffer: t.header_image, mime: t.header_mime || 'image/jpeg', filename: t.name,
      }));
    }
    return fotos.get(t.id);
  };

  // La de la plantilla principal se sube antes de empezar: si falla, falla toda
  // la campaña y conviene decirlo de una vez y no mensaje por mensaje.
  try { await subirFoto(template); }
  catch (e) {
    for (const m of camp.messages) await waStore.markMessage(m.id, { status: 'failed', error: 'Header: ' + e.message });
    await waStore.bumpCampaign(campaignId, { failed: camp.messages.length });
    await waStore.finishCampaign(campaignId, 'failed');
    return;
  }

  for (const m of camp.messages) {
    // Con nombre va la plantilla que saluda por su nombre; sin nombre, la
    // gemela. Si no hay gemela aprobada, la de siempre con el relleno.
    const nombre = (m.contact_name || '').trim();
    const usa = !nombre && gemela ? gemela : template;
    const conVar = /\{\{1\}\}/.test(usa.body_text || '');
    try {
      const r = await wa.sendTemplate(cx, {
        to: m.phone, templateName: usa.name, language: usa.language,
        headerMediaId: await subirFoto(usa),
        // .trim() arriba: un nombre que quedó en blanco de antes son espacios de
        // más dentro del parámetro, y Meta corta a los cuatro seguidos.
        bodyParams: conVar ? [nombre || SIN_NOMBRE] : [],
      });
      await waStore.markMessage(m.id, { status: 'sent', waId: r.id });
      await waStore.bumpCampaign(campaignId, { sent: 1 });
    } catch (e) {
      await waStore.markMessage(m.id, { status: 'failed', error: e.message });
      await waStore.bumpCampaign(campaignId, { failed: 1 });
    }
    if (camp.messages.length > 1) await sleep(300); // ritmo suave para no toparse con rate limits
  }
  await waStore.finishCampaign(campaignId, 'done');
}

module.exports = { ejecutarCampana };
