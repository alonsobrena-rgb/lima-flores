// GET /api/ig/media/:id — el archivo de una pieza de la cola, en crudo.
//
// **Público a propósito**: Instagram baja el JPG o el MP4 él mismo desde esta
// URL, y no puede autenticarse. Lo que se expone es una pieza de marketing que
// está a punto de publicarse en una cuenta pública, con un id aleatorio de 16
// hex — no hay nada privado detrás.
//
// El MP4 se sirve con Accept-Ranges: algunos clientes de Meta piden el video por
// tramos y sin eso el contenedor del reel se queda en ERROR.
'use strict';

const cola = require('../db/ig-queue-store');
const db = require('../db');

module.exports = async (req, res, urlObj) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405); return res.end('Method not allowed');
  }
  if (!db.enabled) { res.writeHead(503); return res.end('sin BD'); }

  const id = urlObj.pathname.split('/').pop();
  if (!/^[a-f0-9]{6,32}$/.test(id)) { res.writeHead(400); return res.end('id inválido'); }

  let fila;
  try { fila = await cola.media(id); }
  catch (e) { res.writeHead(500); return res.end('error: ' + e.message); }
  if (!fila || !fila.media) { res.writeHead(404); return res.end('no encontrado'); }

  const buf = fila.media;
  const rango = req.headers.range;
  const comunes = {
    'Content-Type': fila.mime || 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    // Meta puede reintentar la descarga; que no se cachee viejo si se reemplaza.
    'Cache-Control': 'public, max-age=600',
  };

  if (rango) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(rango);
    if (m) {
      const inicio = m[1] ? Number(m[1]) : 0;
      const fin = m[2] ? Math.min(Number(m[2]), buf.length - 1) : buf.length - 1;
      if (inicio <= fin && inicio < buf.length) {
        const trozo = buf.subarray(inicio, fin + 1);
        res.writeHead(206, {
          ...comunes,
          'Content-Range': `bytes ${inicio}-${fin}/${buf.length}`,
          'Content-Length': trozo.length,
        });
        return res.end(req.method === 'HEAD' ? undefined : trozo);
      }
    }
  }

  res.writeHead(200, { ...comunes, 'Content-Length': buf.length });
  return res.end(req.method === 'HEAD' ? undefined : buf);
};
