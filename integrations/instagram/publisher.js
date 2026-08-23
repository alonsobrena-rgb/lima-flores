// El vigía del publicador: mira la cola cada minuto y publica lo que venció.
//
// Se arranca desde server.js. No hace nada —ni una llamada a Meta— mientras el
// interruptor del panel esté apagado o falten las variables de entorno; eso es a
// propósito: publicar es hacia afuera y no se enciende solo con un deploy.
//
// Una pieza por vuelta. Con cinco al día no hay prisa, y así un reel que tarda
// dos minutos en procesarse no bloquea nada más.
'use strict';

const cola = require('../../db/ig-queue-store');
const publish = require('./publish');
const db = require('../../db');

const CADA_MS = 60 * 1000;
let timer = null;
let trabajando = false;

async function vuelta() {
  if (trabajando) return;
  if (!db.enabled) return;

  trabajando = true;
  try {
    const ajustes = await cola.ajustes();
    if (!ajustes.activo) return;

    // Tope propio además del de Meta: si algo agenda de más, que no se dispare
    // una ráfaga de cincuenta publicaciones en una hora.
    if (await cola.publicadasHoy() >= (ajustes.por_dia || 5) * 2) {
      console.log('[ig] tope diario propio alcanzado, no publico más por ahora');
      return;
    }

    const pieza = await cola.tomarVencida();
    if (!pieza) return;

    // La cuenta de la pieza; si no tiene, la primera activa, y si tampoco hay
    // tabla, la cuenta suelta de las variables de entorno (como antes).
    const cuenta = (await cola.cuenta(pieza.cuenta_id))
      || (await cola.cuentaPorDefecto())
      || publish.cuentaDelEntorno();

    console.log(`[ig] publicando ${pieza.origen || pieza.id} (${pieza.kind}) en ${cuenta ? cuenta.usuario || cuenta.ig_user_id : '—'}, intento ${pieza.attempts}`);
    try {
      const r = await publish.publicar(pieza, cuenta);
      await cola.marcarPublicada(pieza.id, r);
      console.log(`[ig] publicada ${pieza.origen || pieza.id} → ${r.permalink || r.igMediaId}`);
    } catch (e) {
      const reintenta = await cola.marcarFallida(pieza.id, e.message, { intentos: pieza.attempts });
      console.error(`[ig] falló ${pieza.origen || pieza.id}: ${e.message}${reintenta ? ' — reintento en 30 min' : ' — se queda en fallidas'}`);
    }
  } catch (e) {
    console.error('[ig] error en la vuelta:', e.message);
  } finally {
    trabajando = false;
  }
}

function start() {
  if (timer) return;
  if (!db.enabled) { console.log('[ig] sin BD — publicador desactivado'); return; }
  // Con la cuenta del panel, no con las variables sueltas: si no, el arranque
  // dice «falta una cuenta de Instagram» aunque esté agregada y activa. Va
  // suelto porque `start()` no espera a nadie — es una línea de registro.
  cola.cuentaPorDefecto()
    .then((c) => {
      const falta = publish.faltantes(c);
      if (falta.length) console.log(`[ig] publicador en espera: falta ${falta.join(', ')}`);
    })
    .catch(() => { /* sin base todavía: el vigía lo vuelve a mirar en cada vuelta */ });
  timer = setInterval(() => { vuelta().catch(() => {}); }, CADA_MS);
  timer.unref?.();
  console.log('[ig] publicador iniciado (revisa la cola cada minuto)');
}

function stop() { if (timer) { clearInterval(timer); timer = null; } }

module.exports = { start, stop, vuelta };
