// /api/admin/ig/* — el publicador de Instagram desde el panel.
// La auth ya la validó api/admin.js antes de delegar acá.
//
//   GET    /api/admin/ig/estado                 → configuración, interruptor, cupo, resumen
//   GET    /api/admin/ig/cola                   → la cola completa (sin binarios)
//   POST   /api/admin/ig/cargar-galeria         → encola los creativos del repo que falten
//   POST   /api/admin/ig/ajustes                → { activo, porDia, horas }
//   PATCH  /api/admin/ig/cola/:id               → { caption, scheduledAt, status }
//   POST   /api/admin/ig/cola/:id/publicar-ya   → la adelanta a ahora mismo
//   DELETE /api/admin/ig/cola/:id               → la saca de la cola
'use strict';

const cola = require('../db/ig-queue-store');
const publish = require('../integrations/instagram/publish');
const agenda = require('../integrations/instagram/agenda');
const galeria = require('../integrations/instagram/galeria');

function send(res, code, payload) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(typeof payload === 'string' ? payload : JSON.stringify(payload));
}

function readJsonBody(req, limit = 256 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('body too large')); req.destroy(); return; } chunks.push(c); });
    req.on('end', () => { const raw = Buffer.concat(chunks).toString('utf8'); if (!raw) return resolve({}); try { resolve(JSON.parse(raw)); } catch { reject(new Error('invalid JSON')); } });
    req.on('error', reject);
  });
}

async function estado(req, res) {
  const ajustes = await cola.ajustes();
  const filas = await cola.listar({ limite: 500 });
  const cuenta = (s) => filas.filter((f) => f.status === s).length;
  const proxima = filas.find((f) => f.status === 'queued');
  return send(res, 200, {
    configurado: publish.configurado(),
    falta: publish.faltantes(),
    ajustes: { activo: ajustes.activo, porDia: ajustes.por_dia, horas: ajustes.horas },
    cupo: await publish.cupoRestante(),
    resumen: {
      enCola: cuenta('queued'), publicando: cuenta('publishing'), publicadas: cuenta('published'),
      fallidas: cuenta('failed'), pausadas: cuenta('paused'),
      proxima: proxima ? proxima.scheduled_at : null,
      publicadas24h: await cola.publicadasHoy(),
    },
    // Lo que queda en el repo sin encolar, para que el botón diga cuántas trae.
    sinCargar: galeria.disponibles({ saltar: await cola.origenesUsados() }).length,
  });
}

async function cargarGaleria(req, res) {
  const ajustes = await cola.ajustes();
  const piezas = galeria.disponibles({ saltar: await cola.origenesUsados() });
  if (!piezas.length) return send(res, 200, { encoladas: 0, mensaje: 'La galería ya está toda en la cola.' });

  // Se sigue desde la última hora ocupada: cargar dos veces no amontona piezas
  // en el mismo hueco.
  const ultima = await cola.ultimaAgendada();
  const desde = ultima && ultima > new Date() ? ultima : new Date();
  const horas = agenda.proximasHoras(piezas.length, {
    desde, porDia: ajustes.por_dia, horas: ajustes.horas,
  });

  const ids = [];
  for (let i = 0; i < piezas.length; i += 1) {
    const p = piezas[i];
    ids.push(await cola.encolar({ ...p, scheduledAt: horas[i] }));
  }
  return send(res, 201, {
    encoladas: ids.length,
    desde: horas[0] || null,
    hasta: horas[horas.length - 1] || null,
  });
}

async function guardarAjustes(req, res) {
  let body;
  try { body = await readJsonBody(req); } catch (e) { return send(res, 400, { error: e.message }); }
  const a = await cola.guardarAjustes({
    activo: body.activo,
    porDia: body.porDia,
    horas: body.horas,
  });
  // Encender sin tener las llaves puestas no publica nada: mejor decirlo acá que
  // dejar al usuario mirando una cola que no avanza.
  return send(res, 200, {
    ajustes: { activo: a.activo, porDia: a.por_dia, horas: a.horas },
    aviso: a.activo && !publish.configurado()
      ? `Encendido, pero no va a publicar: falta ${publish.faltantes().join(', ')} en el servidor.`
      : null,
  });
}

module.exports = async (req, res, urlObj) => {
  const p = urlObj.pathname;

  if (p === '/api/admin/ig/estado' && req.method === 'GET') return estado(req, res);
  if (p === '/api/admin/ig/cola' && req.method === 'GET') return send(res, 200, { cola: await cola.listar({}) });
  if (p === '/api/admin/ig/cargar-galeria' && req.method === 'POST') return cargarGaleria(req, res);
  if (p === '/api/admin/ig/ajustes' && req.method === 'POST') return guardarAjustes(req, res);

  const m = p.match(/^\/api\/admin\/ig\/cola\/([a-f0-9]{6,32})(?:\/(publicar-ya))?$/);
  if (m) {
    const id = m[1];
    const accion = m[2];
    if (accion === 'publicar-ya' && req.method === 'POST') {
      const fila = await cola.actualizar(id, { scheduledAt: new Date(), status: 'queued' });
      if (!fila) return send(res, 404, { error: 'no encontrada' });
      // El vigía la toma en su próxima vuelta (dentro de un minuto).
      return send(res, 200, { ok: true, item: fila });
    }
    if (req.method === 'PATCH') {
      let body;
      try { body = await readJsonBody(req); } catch (e) { return send(res, 400, { error: e.message }); }
      const cambios = {};
      if (typeof body.caption === 'string') cambios.caption = body.caption.slice(0, 2200);
      if (body.scheduledAt) {
        const d = new Date(body.scheduledAt);
        if (Number.isNaN(d.getTime())) return send(res, 400, { error: 'fecha inválida' });
        cambios.scheduledAt = d;
      }
      if (body.status && ['queued', 'paused'].includes(body.status)) cambios.status = body.status;
      const fila = await cola.actualizar(id, cambios);
      if (!fila) return send(res, 404, { error: 'no encontrada' });
      return send(res, 200, { item: fila });
    }
    if (req.method === 'DELETE') {
      const ok = await cola.borrar(id);
      return send(res, ok ? 200 : 404, ok ? { ok: true } : { error: 'no encontrada' });
    }
  }

  return send(res, 404, { error: 'ruta de publicador no encontrada' });
};
