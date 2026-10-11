'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY_BYTES = 16 * 1024;
const MAX_PARTICIPANTS = 100;
const MAX_ACTIVE_SESSIONS = 5;
const MAX_STORED_SESSIONS = 20;
const SIMULATION_STEP_MS = 180;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function makeError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeInput(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw makeError('El cuerpo de la solicitud no es válido.', 400);
  }

  const pin = String(payload.pin == null ? '' : payload.pin).trim();
  if (!/^\d{4,10}$/.test(pin)) {
    throw makeError('Escribe un PIN de práctica de entre 4 y 10 cifras.', 400);
  }

  const count = Number(payload.count);
  if (!Number.isInteger(count) || count < 1 || count > MAX_PARTICIPANTS) {
    throw makeError('La cantidad debe estar entre 1 y 100 participantes.', 400);
  }

  const baseValue = typeof payload.baseName === 'string' ? payload.baseName : 'SuperIdol';
  const baseName = baseValue.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!baseName || baseName.length > 24) {
    throw makeError('El nombre base debe tener entre 1 y 24 caracteres.', 400);
  }

  return { pin, count, baseName };
}

function setSecurityHeaders(response) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
}

function sendJson(response, statusCode, value) {
  const body = Buffer.from(JSON.stringify(value));
  setSecurityHeaders(response);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store'
  });
  response.end(body);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;

    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        return;
      }
      if (!tooLarge) chunks.push(chunk);
    });
    request.on('error', reject);
    request.on('end', () => {
      if (tooLarge) {
        reject(makeError('La solicitud supera el tamaño permitido.', 413));
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        reject(makeError('El cuerpo debe ser JSON válido.', 400));
      }
    });
  });
}

function createServer() {
  const sessions = new Map();

  function addEvent(session, message, kind) {
    session.events.push({
      id: crypto.randomUUID(),
      message,
      kind: kind || 'info',
      at: new Date().toISOString()
    });
    if (session.events.length > 60) session.events.shift();
  }

  function publicSession(session) {
    return {
      id: session.id,
      pin: session.pin,
      baseName: session.baseName,
      count: session.count,
      joined: session.participants.length,
      status: session.status,
      startedAt: session.startedAt,
      participants: session.participants,
      events: session.events.slice(-40)
    };
  }

  function pruneSessions() {
    while (sessions.size >= MAX_STORED_SESSIONS) {
      const finished = Array.from(sessions.values())
        .filter((session) => session.status !== 'running')
        .sort((left, right) => left.startedAt.localeCompare(right.startedAt));
      if (finished.length === 0) throw makeError('Hay demasiadas sesiones activas. Detén una e inténtalo de nuevo.', 429);
      sessions.delete(finished[0].id);
    }
  }

  function createSession(payload) {
    const input = normalizeInput(payload);
    const activeCount = Array.from(sessions.values()).filter((session) => session.status === 'running').length;
    if (activeCount >= MAX_ACTIVE_SESSIONS) {
      throw makeError('Ya hay cinco ensayos en curso. Detén uno antes de iniciar otro.', 429);
    }
    pruneSessions();

    const session = {
      id: crypto.randomUUID(),
      pin: input.pin,
      baseName: input.baseName,
      count: input.count,
      startedAt: new Date().toISOString(),
      status: 'running',
      participants: [],
      events: [],
      timer: null
    };
    sessions.set(session.id, session);
    addEvent(session, 'Ensayo local iniciado. No se contactará con Kahoot ni con otros servicios.', 'system');

    session.timer = setInterval(() => {
      if (session.status !== 'running') {
        clearInterval(session.timer);
        session.timer = null;
        return;
      }

      const ordinal = session.participants.length + 1;
      const name = session.baseName + '_' + ordinal;
      const now = new Date().toISOString();
      session.participants.push({
        id: ordinal,
        name,
        status: 'simulated',
        createdAt: now
      });
      addEvent(session, 'Participante simulado generado: ' + name, 'success');

      if (session.participants.length >= session.count) {
        session.status = 'completed';
        clearInterval(session.timer);
        session.timer = null;
        addEvent(session, 'Ensayo completado. Todos los datos permanecen en esta aplicación.', 'system');
      }
    }, SIMULATION_STEP_MS);

    return session;
  }

  function stopSession(session) {
    if (session.status !== 'running') return;
    if (session.timer) clearInterval(session.timer);
    session.timer = null;
    session.status = 'stopped';
    addEvent(session, 'Ensayo detenido por el usuario.', 'system');
  }

  async function serveStatic(request, response, pathname) {
    if (request.method !== 'GET') {
      sendJson(response, 405, { error: 'Método no permitido.' });
      return;
    }

    let decodedPath;
    try {
      decodedPath = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
    } catch (error) {
      sendJson(response, 400, { error: 'La ruta no es válida.' });
      return;
    }

    const relativePath = decodedPath.replace(/^\/+/, '');
    const filePath = path.resolve(PUBLIC_DIR, relativePath);
    if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + path.sep)) {
      sendJson(response, 403, { error: 'Ruta no permitida.' });
      return;
    }

    fs.readFile(filePath, (error, contents) => {
      if (error) {
        sendJson(response, 404, { error: 'No se encontró el recurso.' });
        return;
      }
      setSecurityHeaders(response);
      response.writeHead(200, {
        'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'Content-Length': contents.length,
        'Cache-Control': 'no-cache'
      });
      response.end(contents);
    });
  }

  async function handleRequest(request, response) {
    let url;
    try {
      url = new URL(request.url || '/', 'http://' + (request.headers.host || 'localhost'));
    } catch (error) {
      sendJson(response, 400, { error: 'La solicitud no es válida.' });
      return;
    }

    if (url.pathname === '/api/health' && request.method === 'GET') {
      sendJson(response, 200, { status: 'ok', mode: 'local-simulation', externalConnections: false });
      return;
    }

    if (url.pathname === '/api/simulations' && request.method === 'POST') {
      try {
        const payload = await readJson(request);
        const session = createSession(payload);
        sendJson(response, 201, publicSession(session));
      } catch (error) {
        sendJson(response, error.statusCode || 400, { error: error.message || 'No se pudo iniciar el ensayo.' });
      }
      return;
    }

    const sessionMatch = url.pathname.match(/^\/api\/simulations\/([a-f0-9-]+)(\/stop)?$/i);
    if (sessionMatch) {
      const session = sessions.get(sessionMatch[1]);
      if (!session) {
        sendJson(response, 404, { error: 'No se encontró ese ensayo en este servidor.' });
        return;
      }
      if (sessionMatch[2] && request.method === 'POST') {
        stopSession(session);
        sendJson(response, 200, publicSession(session));
        return;
      }
      if (!sessionMatch[2] && request.method === 'GET') {
        sendJson(response, 200, publicSession(session));
        return;
      }
      sendJson(response, 405, { error: 'Método no permitido.' });
      return;
    }

    if (url.pathname.startsWith('/api/')) {
      sendJson(response, 404, { error: 'No se encontró esa ruta de API.' });
      return;
    }
    await serveStatic(request, response, url.pathname);
  }

  return http.createServer((request, response) => {
    handleRequest(request, response).catch(() => {
      if (!response.headersSent) sendJson(response, 500, { error: 'Error interno del servidor.' });
      else response.destroy();
    });
  });
}

if (require.main === module) {
  const server = createServer();
  const port = Number(process.env.PORT) || 3000;
  server.listen(port, '0.0.0.0', () => {
    console.log('Simulador local listo en el puerto ' + port + '. No hay conexiones a Kahoot.');
  });
}

module.exports = { createServer, normalizeInput };