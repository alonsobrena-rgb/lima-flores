// /api/admin/ig/* — el publicador de Instagram desde el panel.
// La auth ya la validó api/admin.js antes de delegar acá.
//
//   GET    /api/admin/ig/cuentas                → las cuentas donde se publica
//   POST   /api/admin/ig/cuentas                → { igUserId, usuario, etiqueta, tokenEnv }
//   PATCH  /api/admin/ig/cuentas/:id            → { usuario, etiqueta, tokenEnv, activa }
//   DELETE /api/admin/ig/cuentas/:id
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
  const porDefecto = await cola.cuentaPorDefecto();
  return send(res, 200, {
    configurado: publish.configurado(porDefecto),
    falta: publish.faltantes(porDefecto),
    ajustes: { activo: ajustes.activo, porDia: ajustes.por_dia, horas: ajustes.horas },
    cupo: await publish.cupoRestante(porDefecto),
    resumen: {
      enCola: cuenta('queued'), publicando: cuenta('publishing'), publicadas: cuenta('published'),
      fallidas: cuenta('failed'), pausadas: cuenta('paused'),
      proxima: proxima ? proxima.scheduled_at : null,
      publicadas24h: await cola.publicadasHoy(),
    },
    // Lo que queda en el repo sin encolar **para la cuenta por defecto**, que es
    // la que propone el botón. Con otra cuenta el número cambia.
    sinCargar: galeria.disponibles({ saltar: await cola.origenesUsados(porDefecto ? porDefecto.id : null) }).length,
    cuentas: (await cola.listarCuentas()).map((c) => ({
      ...c,
      // Nunca el token: solo si la variable que nombra existe en el servidor.
      tokenPuesto: !!publish.tokenDe(c),
    })),
  });
}

async function cargarGaleria(req, res) {
  let body = {};
  try { body = await readJsonBody(req); } catch { /* sin cuerpo = cuenta por defecto */ }
  const ajustes = await cola.ajustes();

  // A una cuenta, o a todas las activas de una: cada una lleva su propia copia
  // de la pieza y su propia agenda, porque publican en paralelo.
  let destinos;
  if (body.todas) destinos = (await cola.listarCuentas()).filter((c) => c.activa);
  else if (body.cuentaId) destinos = [await cola.cuenta(body.cuentaId)].filter(Boolean);
  else destinos = [await cola.cuentaPorDefecto()].filter(Boolean);
  if (!destinos.length) return send(res, 400, { error: 'No hay ninguna cuenta activa. Agrega una primero.' });

  const resultado = [];
  for (const c of destinos) {
    const piezas = galeria.disponibles({ saltar: await cola.origenesUsados(c.id) });
    if (!piezas.length) { resultado.push({ cuenta: c.usuario || c.ig_user_id, encoladas: 0 }); continue; }

    // Se sigue desde la última hora ocupada de esa cuenta: cargar dos veces no
    // amontona piezas en el mismo hueco.
    const ultima = await cola.ultimaAgendada(c.id);
    const desde = ultima && ultima > new Date() ? ultima : new Date();
    const horas = agenda.proximasHoras(piezas.length, { desde, porDia: ajustes.por_dia, horas: ajustes.horas });

    for (let i = 0; i < piezas.length; i += 1) {
      await cola.encolar({ ...piezas[i], scheduledAt: horas[i], cuentaId: c.id });
    }
    resultado.push({
      cuenta: c.usuario || c.ig_user_id,
      encoladas: piezas.length,
      desde: horas[0] || null,
      hasta: horas[horas.length - 1] || null,
    });
  }
  const total = resultado.reduce((n, r) => n + r.encoladas, 0);
  return send(res, 201, {
    encoladas: total,
    porCuenta: resultado,
    desde: resultado.find((r) => r.desde)?.desde || null,
    hasta: resultado.reduce((h, r) => (r.hasta && (!h || r.hasta > h) ? r.hasta : h), null),
    mensaje: total ? null : 'La galería ya está toda en la cola de esas cuentas.',
  });
}

// ── Cuentas ──
const ENV_VALIDA = /^IG_[A-Z0-9_]*$/;

async function crearCuenta(req, res) {
  let body;
  try { body = await readJsonBody(req); } catch (e) { return send(res, 400, { error: e.message }); }
  const igUserId = String(body.igUserId || '').trim();
  if (!/^\d{5,}$/.test(igUserId)) {
    return send(res, 400, { error: 'El id de la cuenta es el número que da Meta (solo dígitos), no el @.' });
  }
  const tokenEnv = String(body.tokenEnv || 'IG_ACCESS_TOKEN').trim().toUpperCase();
  if (!ENV_VALIDA.test(tokenEnv)) {
    return send(res, 400, { error: 'El nombre de la variable tiene que empezar por IG_ (p. ej. IG_ACCESS_TOKEN_2).' });
  }
  try {
    const c = await cola.crearCuenta({ igUserId, usuario: body.usuario, etiqueta: body.etiqueta, tokenEnv });
    return send(res, 201, { cuenta: { ...c, tokenPuesto: !!publish.tokenDe(c) } });
  } catch (e) {
    const dup = /duplicate|unique/i.test(e.message);
    return send(res, dup ? 409 : 500, { error: dup ? 'Esa cuenta ya está agregada.' : e.message });
  }
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

  if (p === '/api/admin/ig/cuentas' && req.method === 'GET') {
    const cuentas = (await cola.listarCuentas()).map((c) => ({ ...c, tokenPuesto: !!publish.tokenDe(c) }));
    return send(res, 200, { cuentas });
  }
  if (p === '/api/admin/ig/cuentas' && req.method === 'POST') return crearCuenta(req, res);

  const mc = p.match(/^\/api\/admin\/ig\/cuentas\/([a-f0-9]{6,32})$/);
  if (mc) {
    const id = mc[1];
    if (req.method === 'PATCH') {
      let body;
      try { body = await readJsonBody(req); } catch (e) { return send(res, 400, { error: e.message }); }
      if (body.tokenEnv !== undefined) {
        const t = String(body.tokenEnv).trim().toUpperCase();
        if (!ENV_VALIDA.test(t)) return send(res, 400, { error: 'La variable tiene que empezar por IG_.' });
        body.tokenEnv = t;
      }
      const c = await cola.actualizarCuenta(id, body);
      if (!c) return send(res, 404, { error: 'no encontrada' });
      return send(res, 200, { cuenta: { ...c, tokenPuesto: !!publish.tokenDe(c) } });
    }
    if (req.method === 'DELETE') {
      try { return send(res, 200, { ok: await cola.borrarCuenta(id) }); }
      catch (e) { return send(res, 409, { error: e.message }); }
    }
  }
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
