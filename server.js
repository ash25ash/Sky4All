'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const config = require('./config');
const dittoEngine = require('./dittoEngine');
const sqlServerBridge = require('./sqlServerBridge');
const dittoCloud = require('./dittoCloud');

dittoCloud.attach(dittoEngine);

const PUBLIC_DIR = config.PUBLIC_DIR;
const MAX_BODY_BYTES = 1024 * 1024;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8'
};

const sseClients = new Set();

/* -------------------------------------------------------------------------- *
 * HTTP helpers
 * -------------------------------------------------------------------------- */

function sendJson(res, statusCode, payload) {
  if (res.writableEnded) return;
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new dittoEngine.ApiError(413, 'Payload prea mare.', 'PAYLOAD_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) return resolve({});
      try {
        const parsed = JSON.parse(raw);
        resolve(parsed && typeof parsed === 'object' ? parsed : {});
      } catch (err) {
        reject(new dittoEngine.ApiError(400, 'JSON invalid în corpul cererii.', 'INVALID_JSON'));
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  let relative = pathname;
  try {
    relative = decodeURIComponent(pathname);
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('400 Bad Request');
  }
  if (relative === '/' || relative === '') relative = '/index.html';

  const filePath = path.normalize(path.join(PUBLIC_DIR, relative));
  const relativeToPublic = path.relative(PUBLIC_DIR, filePath);
  if (relativeToPublic.startsWith('..') || path.isAbsolute(relativeToPublic)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('403 Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

/* -------------------------------------------------------------------------- *
 * SSE fan-out
 * -------------------------------------------------------------------------- */

function sseWrite(client, eventName, payload) {
  if (!client.writableEnded) {
    client.write(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`);
  }
}

dittoEngine.on('ditto-event', (event) => {
  for (const client of sseClients) {
    try {
      sseWrite(client, 'ditto-sync', event);
    } catch (err) {
      sseClients.delete(client);
    }
  }
});

const heartbeat = setInterval(() => {
  const now = Date.now();
  for (const client of sseClients) {
    try {
      sseWrite(client, 'ping', { now, peers: sseClients.size });
    } catch (err) {
      sseClients.delete(client);
    }
  }
}, 15000);
heartbeat.unref();

/* -------------------------------------------------------------------------- *
 * Routes
 * -------------------------------------------------------------------------- */

async function handleApi(req, res, pathname) {
  const method = req.method;

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  if (pathname === '/api/events' && method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*'
    });
    res.write(': sky4all mesh stream\n\n');
    sseClients.add(res);
    sseWrite(res, 'connected', {
      message: 'Connected to Sky4All Ditto mesh',
      peerCount: sseClients.size,
      stats: dittoEngine.getStats(),
      timestamp: new Date().toISOString()
    });
    req.on('close', () => sseClients.delete(res));
    return;
  }

  if (pathname === '/api/health' && method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      app: config.APP_NAME,
      uptimeSeconds: Math.round(process.uptime()),
      stats: dittoEngine.getStats(),
      flight: dittoEngine.getState().flightInfo,
      ditto: dittoCloud.getStatus(),
      sqlMirror: sqlServerBridge.lastWrite,
      timestamp: new Date().toISOString()
    });
  }

  if (pathname === '/api/ditto/status' && method === 'GET') {
    return sendJson(res, 200, dittoCloud.getStatus());
  }

  if (pathname === '/api/state' && method === 'GET') {
    return sendJson(res, 200, dittoEngine.getPublicState());
  }

  if (method !== 'POST') {
    // Every supported GET route was handled above.
    if (method === 'GET') {
      throw new dittoEngine.ApiError(404, `Endpoint inexistent: ${pathname}`, 'NOT_FOUND');
    }
    throw new dittoEngine.ApiError(405, `Metodă ${method} nepermisă pentru ${pathname}.`, 'METHOD_NOT_ALLOWED');
  }

  const body = await readJsonBody(req);

  if (pathname === '/api/passenger/onboard' || pathname === '/api/passenger/profile') {
    const passenger = dittoEngine.registerOrUpdatePassenger(body);
    return sendJson(res, 200, { success: true, passenger });
  }

  if (pathname === '/api/crew/login') {
    const crew = dittoEngine.authenticateCrew(body.crewId, body.pin);
    return sendJson(res, 200, { success: true, crew });
  }

  if (pathname === '/api/emergency') {
    const request = dittoEngine.triggerMedicalEmergency({
      seatNumber: body.seatNumber || body.seat,
      targetSeat: body.targetSeat,
      reporterSeat: body.reporterSeat || body.reportingSeat,
      details: body.details,
      passengerName: body.passengerName
    });
    return sendJson(res, 201, { success: true, request });
  }

  if (pathname === '/api/request' || pathname === '/api/call') {
    const request = dittoEngine.createServiceRequest({
      seatNumber: body.seatNumber || body.seat,
      passengerId: body.passengerId,
      passengerName: body.passengerName,
      type: body.type || body.reason,
      details: body.details || body.notes
    });
    return sendJson(res, 201, { success: true, request });
  }

  if (pathname === '/api/request/status' || pathname === '/api/call/status') {
    const request = dittoEngine.updateServiceRequestStatus({
      requestId: body.requestId || body.callId,
      status: body.status,
      crewId: body.crewId || body.assignedCrew
    });
    return sendJson(res, 200, { success: true, request });
  }

  if (pathname === '/api/complaint') {
    const complaint = dittoEngine.fileComplaint({
      reporterSeat: body.reporterSeat || body.reportingSeat || body.seatNumber,
      reporterName: body.reporterName,
      targetSeat: body.targetSeat,
      category: body.category,
      description: body.description || body.details
    });
    return sendJson(res, 201, { success: true, complaint });
  }

  if (pathname === '/api/complaint/resolve') {
    const complaint = dittoEngine.resolveComplaint({
      complaintId: body.complaintId,
      status: body.status
    });
    return sendJson(res, 200, { success: true, complaint });
  }

  if (pathname === '/api/rating' || pathname === '/api/review') {
    const rating = dittoEngine.submitRating({
      seatNumber: body.seatNumber || body.seat,
      overall: body.overall,
      disturbances: body.disturbances,
      staffBehavior: body.staffBehavior,
      cleanliness: body.cleanliness,
      legRoom: body.legRoom ?? body.footRoom,
      baggageSpace: body.baggageSpace ?? body.spaceForBags,
      comment: body.comment || body.details,
      passengerName: body.passengerName
    });
    return sendJson(res, 201, {
      success: true,
      rating,
      pointsOnTouchdown: config.POINTS.perReview
    });
  }

  if (pathname === '/api/passenger-rating' || pathname === '/api/steward/rate-passenger') {
    const passengerRating = dittoEngine.ratePassenger({
      seatNumber: body.seatNumber || body.seat,
      crewId: body.crewId,
      score: body.score ?? body.stars,
      note: body.note || body.notes
    });
    return sendJson(res, 200, {
      success: true,
      passengerRating,
      pointsOnTouchdown: config.POINTS.perCrewRating
    });
  }

  if (pathname === '/api/order') {
    const order = dittoEngine.createOrder({
      seatNumber: body.seatNumber || body.seat,
      items: body.items,
      paymentMethod: body.paymentMethod,
      passengerName: body.passengerName
    });
    return sendJson(res, 201, { success: true, order });
  }

  if (pathname === '/api/order/status') {
    const order = dittoEngine.updateOrderStatus({
      orderId: body.orderId,
      status: body.status,
      crewId: body.crewId
    });
    return sendJson(res, 200, { success: true, order });
  }

  if (pathname === '/api/flight/sync-ground') {
    const report = await dittoEngine.syncToGround();
    return sendJson(res, 200, report);
  }

  if (pathname === '/api/reset') {
    const state = dittoEngine.resetStore();
    return sendJson(res, 200, { success: true, state });
  }

  throw new dittoEngine.ApiError(404, `Endpoint inexistent: ${pathname}`, 'NOT_FOUND');
}

/* -------------------------------------------------------------------------- *
 * Server
 * -------------------------------------------------------------------------- */

const server = http.createServer(async (req, res) => {
  const startedAt = Date.now();
  let pathname = '/';
  try {
    const parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    pathname = parsed.pathname;

    if (pathname === '/api/big-peer/ping' && req.method === 'GET') {
      const ping = await sqlServerBridge.pingBigPeer();
      return sendJson(res, 200, ping);
    }

    if (pathname === '/api/sql/preview' && req.method === 'GET') {
      const state = dittoEngine.getState();
      return sendJson(res, 200, {
        sql: dittoEngine.getSqlPreview(),
        counts: sqlServerBridge.collectionCounts(state),
        files: {
          bundledDirectory: sqlServerBridge.bundledDir,
          mirrorDirectory: sqlServerBridge.mirrorEnabled ? sqlServerBridge.mirrorDir : null,
          schema: path.join(sqlServerBridge.bundledDir, config.SQL_SERVER.schemaFile),
          sync: path.join(sqlServerBridge.bundledDir, config.SQL_SERVER.syncFile),
          json: path.join(sqlServerBridge.bundledDir, config.SQL_SERVER.exportFile)
        },
        lastWrite: sqlServerBridge.lastWrite
      });
    }

    if (pathname.startsWith('/api/')) {
      await handleApi(req, res, pathname);
      return;
    }

    serveStatic(req, res, pathname);
  } catch (err) {
    const status = err.statusCode || (err instanceof dittoEngine.ApiError ? err.statusCode : 500);
    if (status >= 500) console.error(`[http] ${req.method} ${pathname} →`, err);
    sendJson(res, status, {
      success: false,
      error: err.message || 'Eroare internă de server',
      code: err.code || 'INTERNAL_ERROR',
      details: err.details || undefined
    });
  } finally {
    if (!pathname.startsWith('/api/events')) {
      const ms = Date.now() - startedAt;
      if (ms > 1500) console.log(`[http] slow ${req.method} ${pathname} (${ms} ms)`);
    }
  }
});

server.on('clientError', (err, socket) => {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

if (require.main === module) {
  server.listen(config.PORT, () => {
    console.log(`\n${config.APP_NAME} – in-flight Ditto platform`);
    console.log(`    Local URL:        http://localhost:${config.PORT}`);
    console.log(`    Passenger app:    http://localhost:${config.PORT}/passenger.html`);
    console.log(`    Steward cockpit:  http://localhost:${config.PORT}/steward.html`);
    console.log(`    Flight:           ${config.FLIGHT.flightNumber} · ${config.FLIGHT.origin.code} → ${config.FLIGHT.destination.code} · ${config.FLIGHT.flightDate}`);
    console.log(`    Ditto Big Peer:   ${config.DITTO_BIG_PEER.url} (${config.DITTO_BIG_PEER.appId})`);
    console.log(`    SQL Server DB:    ${config.SQL_SERVER.databaseName} → ${config.SQL_SERVER.bundledDirectory}`);
    console.log(`    Points:           +${config.POINTS.perReview}/review · +${config.POINTS.perCrewRating}/crew rating (awarded at ground sync)\n`);
    dittoCloud.start().catch((err) => console.error('[ditto-cloud] startup error:', err.message));
  });
}

module.exports = server;
