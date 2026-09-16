// El envío de una campaña: subir la cabecera una vez y mandar plantilla por
// plantilla. Vive fuera del API porque hay dos cosas que lo disparan —el panel
// y el vigía de la agenda— y ninguna debería tener que requerir a la otra.
'use strict';

const waStore = require('../../db/whatsapp-store');
const wa = require('./client.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Con qué se rellena {{1}} cuando el contacto no tiene nombre guardado. Era
// «cliente» y se leía mal —«Hola cliente,» suena a formulario—, así que va un
// espacio: el mensaje arranca «Hola  ,», sin nombre inventado. Decisión del
// cliente, tomada sabiendo cómo queda.
//
// No puede ir vacío: Meta rechaza un parámetro sin contenido, y el cuerpo ya
// está aprobado con «Hola {{1}},» —la coma y el espacio de antes son parte de
// la plantilla, no del parámetro, así que desde acá no se pueden quitar. Para
// que diga «Hola, el Box…» hay que editar el cuerpo y volver a revisión.
//
// El espacio suelto no está probado contra Meta todavía: si lo rechazara, esos
// envíos fallan con el error a la vista en la fila del mensaje (el resto de la
// campaña sigue, cada mensaje va por su cuenta).
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

  let headerMediaId = null;
  if (template.header_kind === 'image' && template.header_image) {
    try { headerMediaId = await wa.uploadMedia(cx, { buffer: template.header_image, mime: template.header_mime || 'image/jpeg', filename: template.name }); }
    catch (e) {
      for (const m of camp.messages) await waStore.markMessage(m.id, { status: 'failed', error: 'Header: ' + e.message });
      await waStore.bumpCampaign(campaignId, { failed: camp.messages.length });
      await waStore.finishCampaign(campaignId, 'failed');
      return;
    }
  }

  for (const m of camp.messages) {
    try {
      const r = await wa.sendTemplate(cx, {
        to: m.phone, templateName: template.name, language: template.language,
        // .trim(): un nombre que quedó en blanco de antes son espacios de más
        // dentro del parámetro, y Meta corta a las cuatro seguidas.
        headerMediaId, bodyParams: hasVar ? [(m.contact_name || '').trim() || SIN_NOMBRE] : [],
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
