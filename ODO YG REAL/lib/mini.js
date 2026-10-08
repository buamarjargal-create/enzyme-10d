'use strict';
// Нэмэлт сан шаардахгүй бяцхан HTTP + WebSocket давхарга (зөвхөн Node.js-ийн дотоод модулиуд).
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json' };
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function frame(op, payload) {
  const len = payload.length; let h;
  if (len < 126) h = Buffer.from([0x80 | op, len]);
  else if (len < 65536) { h = Buffer.alloc(4); h[0] = 0x80 | op; h[1] = 126; h.writeUInt16BE(len, 2); }
  else { h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([h, payload]);
}

function createApp(opts) {
  const routes = [], hooks = [];
  const app = {
    use(fn) { hooks.push(fn); },
    get(p, ...h) { routes.push({ m: 'GET', p, h }); },
    post(p, ...h) { routes.push({ m: 'POST', p, h }); },
    router(prefix, ...before) { return { get: (p, ...h) => routes.push({ m: 'GET', p: prefix + p, h: [...before, ...h] }), post: (p, ...h) => routes.push({ m: 'POST', p: prefix + p, h: [...before, ...h] }) }; }
  };
  function decorate(req, res) {
    const u = new URL(req.url, 'http://x');
    req.path = u.pathname; req.query = Object.fromEntries(u.searchParams);
    req.get = n => req.headers[String(n).toLowerCase()];
    req.ip = String(req.headers['cf-connecting-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '');
    req.protocol = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0];
    res.status = c => { res.statusCode = c; return res; };
    res.set = (k, v) => { if (typeof k === 'object') Object.keys(k).forEach(x => res.setHeader(x, k[x])); else res.setHeader(k, v); return res; };
    res.type = t => { res.setHeader('Content-Type', t.includes('/') ? t : (MIME['.' + t] || 'text/plain')); return res; };
    res.json = o => { if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(o)); };
    res.send = b => { if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.end(b); };
  }
  function readBody(req) {
    return new Promise((resolve, reject) => {
      const parts = []; let n = 0; let dead = false;
      req.on('data', c => { n += c.length; if (n > 3e6) { dead = true; reject(Object.assign(new Error('too large'), { code: 413 })); req.destroy(); } else parts.push(c); });
      req.on('end', () => { if (dead) return; const s = Buffer.concat(parts).toString('utf8'); if (!s) return resolve({}); try { resolve(JSON.parse(s)); } catch (e) { reject(Object.assign(new Error('bad json'), { code: 400 })); } });
      req.on('error', reject);
    });
  }
  function run(chain, req, res, i, done) { if (i >= chain.length) return done(); let called = false; const next = () => { if (called) return; called = true; run(chain, req, res, i + 1, done); }; try { chain[i](req, res, next); } catch (e) { opts.onError(e, req, res); } }
  app.listener = async (req, res) => {
    try {
      decorate(req, res);
      let body = {};
      if (req.method === 'POST') { try { body = await readBody(req); } catch (e) { res.status(e.code || 400); return res.json({ ok: false, err: e.code === 413 ? 'Хэт том хүсэлт.' : 'Буруу хүсэлт.' }); } }
      req.body = body;
      const r = routes.find(x => x.m === req.method && x.p === req.path) || (req.method === 'HEAD' ? routes.find(x => x.m === 'GET' && x.p === req.path) : null);
      const chain = [...hooks, ...(r ? r.h : [])];
      if (r) return run(chain, req, res, 0, () => {});
      run(hooks, req, res, 0, () => serveStatic(req, res));
    } catch (e) { opts.onError(e, req, res); }
  };
  function serveStatic(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return notFound(req, res);
    let p = decodeURIComponent(req.path); if (p.includes('\0')) return notFound(req, res);
    const full = path.normalize(path.join(opts.publicDir, p));
    if (!full.startsWith(opts.publicDir + path.sep)) return notFound(req, res);
    fs.stat(full, (err, st) => {
      if (err || !st.isFile()) return notFound(req, res);
      res.setHeader('Content-Type', MIME[path.extname(full).toLowerCase()] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=60'); res.setHeader('Content-Length', st.size);
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(full).pipe(res);
    });
  }
  function notFound(req, res) { res.status(404); if (req.path.startsWith('/api')) return res.json({ ok: false, err: 'Олдсонгүй.' }); res.type('text/plain').send('Олдсонгүй'); }

  /* ---- WebSocket ---- */
  const clients = new Set();
  app.attachWS = (server, onConn) => {
    server.on('upgrade', (req, socket) => {
      const u = new URL(req.url, 'http://x');
      const key = req.headers['sec-websocket-key'];
      if (u.pathname !== '/ws' || !key || String(req.headers.upgrade).toLowerCase() !== 'websocket') { socket.destroy(); return; }
      req.query = Object.fromEntries(u.searchParams);
      const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
      socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
      socket.setNoDelay(true); socket.setKeepAlive(true, 20000);
      const c = { id: crypto.randomBytes(6).toString('hex'), req, alive: true, closed: false, data: {}, onclose: null };
      const finish = () => { if (c.closed) return; c.closed = true; clients.delete(c); try { socket.destroy(); } catch (e) {} if (c.onclose) c.onclose(); };
      c.send = (ev, d) => { if (c.closed) return; if (socket.writableLength > 2e6) return finish(); try { socket.write(frame(0x1, Buffer.from(JSON.stringify({ e: ev, d }), 'utf8'))); } catch (e) { finish(); } };
      c.ping = () => { if (!c.closed) try { socket.write(frame(0x9, Buffer.alloc(0))); } catch (e) { finish(); } };
      c.close = () => { if (c.closed) return; try { socket.write(frame(0x8, Buffer.alloc(0))); } catch (e) {} finish(); };
      let buf = Buffer.alloc(0), frag = [];
      socket.on('data', chunk => {
        c.alive = true; buf = Buffer.concat([buf, chunk]);
        while (buf.length >= 2) {
          const b0 = buf[0], b1 = buf[1], fin = !!(b0 & 0x80), op = b0 & 0x0f, masked = !!(b1 & 0x80); let len = b1 & 0x7f, off = 2;
          if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; } else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
          if (!masked || len > 1e5) return c.close();
          if (buf.length < off + 4 + len) return;
          const mask = buf.subarray(off, off + 4); const pl = Buffer.from(buf.subarray(off + 4, off + 4 + len)); for (let i = 0; i < pl.length; i++) pl[i] ^= mask[i & 3];
          buf = buf.subarray(off + 4 + len);
          if (op === 0x8) return c.close(); if (op === 0x9) { try { socket.write(frame(0xA, pl)); } catch (e) {} continue; } if (op === 0xA) continue;
          if (op === 0x1 || op === 0x2 || op === 0x0) { frag.push(pl); if (fin) { const m = Buffer.concat(frag).toString('utf8'); frag = []; if (c.onmessage) { try { c.onmessage(m); } catch (e) {} } } }
        }
      });
      socket.on('close', finish); socket.on('error', finish);
      clients.add(c); onConn(c);
    });
    setInterval(() => { clients.forEach(c => { if (!c.alive) return c.close(); c.alive = false; c.ping(); }); }, 15000).unref();
  };
  app.clients = clients;
  return app;
}
module.exports = { createApp };
