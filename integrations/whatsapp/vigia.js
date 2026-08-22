// El vigía de la agenda: mira las reglas cada minuto y manda las que vencieron.
//
// Mismo criterio que el publicador de Instagram, y por la misma razón: mandar
// un WhatsApp de marketing es hacia afuera. El interruptor de `wa_agenda_ajustes`
// arranca APAGADO y no se enciende con un deploy — lo enciende una persona desde
// el panel. Mientras esté apagado esto no hace ni una llamada a Meta.
//
// Una regla por vuelta. Si dos coinciden en el mismo minuto, la segunda sale al
// minuto siguiente: son campañas a toda la lista, y solaparlas solo sirve para
// chocar contra los límites de Meta.
'use strict';

const db = require('../../db');
const waStore = require('../../db/whatsapp-store');
const wa = require('./client.js');
const campanas = require('./campanas.js');
const agenda = require('./agenda.js');

const CADA_MS = 60 * 1000;
let timer = null;
let trabajando = false;

async function vuelta(ahora = new Date()) {
  if (trabajando) return null;
  if (!db.enabled) return null;

  trabajando = true;
  try {
    const ajustes = await waStore.ajustesAgenda();
    if (!ajustes.activo) return null;

    const cx = await waStore.conexion();
    if (!wa.isConfigured(cx)) return null;

    const reglas = await waStore.programadasParaDisparar();
    for (const regla of reglas) {
      const marca = agenda.toca(regla, ahora);
      if (!marca) continue;

      // Se sella ANTES de mandar. Si el envío revienta a la mitad, la ocurrencia
      // ya está marcada y no se repite en la vuelta siguiente: mejor una campaña
      // incompleta que la misma campaña saliendo sesenta veces.
      await waStore.sellarProgramada(regla.id, marca);

      const contactos = await waStore.getContacts('all');
      if (!contactos.length) {
        console.log(`[wa] agenda ${regla.id}: sin contactos activos, no mando nada`);
        continue;
      }

      const nombre = regla.etiqueta || `${regla.template_name} · día ${regla.dia}`;
      const campanaId = await waStore.createCampaign({
        name: nombre, templateId: regla.template_id, total: contactos.length,
      });
      await waStore.queueMessages(campanaId, contactos);
      await waStore.anotarCampanaProgramada(regla.id, campanaId);

      console.log(`[wa] agenda: disparo «${nombre}» (${marca}) a ${contactos.length} contacto(s)`);
      campanas.ejecutarCampana(campanaId, regla.template_id, cx)
        .catch((e) => console.error(`[wa] agenda ${regla.id}: falló la campaña — ${e.message}`));

      return { reglaId: regla.id, campanaId, marca };   // una por vuelta
    }
    return null;
  } catch (e) {
    console.error('[wa] agenda, error en la vuelta:', e.message);
    return null;
  } finally {
    trabajando = false;
  }
}

function start() {
  if (timer) return;
  if (!db.enabled) { console.log('[wa] sin BD — agenda desactivada'); return; }
  timer = setInterval(() => { vuelta().catch(() => {}); }, CADA_MS);
  timer.unref?.();
  console.log('[wa] agenda iniciada (revisa las reglas cada minuto)');
}

function stop() { if (timer) { clearInterval(timer); timer = null; } }

module.exports = { start, stop, vuelta };
