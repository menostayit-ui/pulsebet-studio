/**
 * PulseBet Studio — High-Speed Local HTTP + WebSocket Server (V3)
 * Features:
 *  - Zero external API keys (Flashscore + 365Scores + ESPN fusion)
 *  - Ephemeral Session Notification Architecture (Refreshing the page starts with a clean notification slate)
 *  - AppSec Hardening (CSP, X-Frame-Options, Path Traversal Guard, WebSocket Rate-Limiting)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const MatchStateStore = require('./engine/MatchStateStore');
const StateDiffEngine = require('./engine/StateDiffEngine');
const MatchMomentumEngine = require('./engine/MatchMomentumEngine');
const PlayerImpactEngine = require('./engine/PlayerImpactEngine');
const QuantSignalEngine = require('./engine/QuantSignalEngine');
const MultiSourceOrchestrator = require('./scrapers/MultiSourceOrchestrator');

const PORT = process.env.PORT || 3850;
const HOST = process.env.HOST || '127.0.0.1'; // Strictly loopback only: LAN/Wi-Fi network sharing is disabled
const PUBLIC_DIR = path.join(__dirname, 'public');

const store = new MatchStateStore();
const diffEngine = new StateDiffEngine();
const momentumEngine = new MatchMomentumEngine();
const playerEngine = new PlayerImpactEngine();
const quantEngine = new QuantSignalEngine();

let wss = null;

function broadcast(payload) {
  if (!wss) return;
  const data = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      try {
        client.send(data);
      } catch (_) {}
    }
  }
}

const orchestrator = new MultiSourceOrchestrator({
  store,
  diffEngine,
  momentumEngine,
  playerEngine,
  quantEngine,
  onBroadcast: broadcast
});

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' ws: wss:; frame-ancestors 'none';"
  );
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = parsedUrl.pathname;

  setSecurityHeaders(res);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API Endpoints
  if (pathname === '/api/state') {
    store.pruneNotifications();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      matches: store.getSortedMatches(),
      events: store.eventHistory,
      signals: store.signalHistory,
      signalLedger: store.getSignalLedger(),
      signalStats: store.getSignalStats(),
      starredIds: Array.from(store.starredMatchIds),
      sourceStatus: orchestrator.sourceStatus
    }));
    return;
  }

  if (pathname === '/api/notifications/clear' && req.method === 'POST') {
    store.clearNotifications('ALL');
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (pathname.startsWith('/api/star/') && req.method === 'POST') {
    const matchId = decodeURIComponent(pathname.slice('/api/star/'.length)).slice(0, 80);
    const match = store.matches.get(matchId);
    if (!match) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Maç bulunamadı' }));
      return;
    }
    const isStarred = store.toggleStar(matchId);
    if (isStarred) {
      orchestrator.enrichSingleMatch(match).then(() => {
        broadcast({
          type: 'MATCH_UPDATED',
          match
        });
      });
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ matchId, isStarred, starredIds: Array.from(store.starredMatchIds) }));
    return;
  }

  if (pathname.startsWith('/api/inspect/')) {
    const matchId = decodeURIComponent(pathname.slice('/api/inspect/'.length)).slice(0, 80);
    const match = store.matches.get(matchId);
    if (!match) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Maç bulunamadı' }));
      return;
    }
    await orchestrator.enrichSingleMatch(match);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ match }));
    return;
  }

  // Hardened Static File Resolution
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  } catch (_) {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }
  if (decodedPath.includes('\0')) {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }
  const resolvedPublic = path.resolve(PUBLIC_DIR);
  const filePath = path.resolve(resolvedPublic, '.' + decodedPath);
  if (filePath !== resolvedPublic && !filePath.startsWith(resolvedPublic + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(content);
  });
});

wss = new WebSocketServer({
  server,
  maxPayload: 16 * 1024,
  perMessageDeflate: false
});

let lastForceRefreshAt = 0;

wss.on('connection', (ws) => {
  let msgCount = 0;
  let windowStart = Date.now();

  store.pruneNotifications();

  // Ephemeral Session Start: On page load or refresh (F5), send matches & starredIds,
  // but start the client's notification streams fresh (events: [], signals: []) so old notifications never persist across refreshes!
  ws.send(JSON.stringify({
    type: 'INIT_SNAPSHOT',
    matches: store.getSortedMatches(),
    events: [],
    signals: [],
    signalLedger: store.getSignalLedger(),
    signalStats: store.getSignalStats(),
    starredIds: Array.from(store.starredMatchIds),
    sourceStatus: orchestrator.sourceStatus
  }));

  ws.on('message', async (raw) => {
    const now = Date.now();
    if (now - windowStart > 10000) {
      windowStart = now;
      msgCount = 0;
    }
    if (++msgCount > 25) return;

    try {
      const msg = JSON.parse(raw.toString());
      if (!msg || typeof msg.action !== 'string') return;

      if (msg.action === 'STAR_MATCH' && typeof msg.matchId === 'string') {
        const match = store.matches.get(msg.matchId);
        if (!match) return;
        const isStarred = store.toggleStar(msg.matchId);
        if (isStarred && now - (match.lastDeepEnrichAt || 0) > 1200) {
          match.lastDeepEnrichAt = now;
          await orchestrator.enrichSingleMatch(match);
        }
        broadcast({
          type: 'STAR_UPDATED',
          matchId: msg.matchId,
          isStarred,
          starredIds: Array.from(store.starredMatchIds),
          match
        });
      } else if (msg.action === 'INSPECT_MATCH' && typeof msg.matchId === 'string') {
        const match = store.matches.get(msg.matchId);
        if (match) {
          if (now - (match.lastDeepEnrichAt || 0) > 1200) {
            match.lastDeepEnrichAt = now;
            await orchestrator.enrichSingleMatch(match);
          }
          ws.send(JSON.stringify({
            type: 'MATCH_UPDATED',
            match
          }));
        }
      } else if (msg.action === 'CLEAR_NOTIFICATIONS') {
        store.clearNotifications(msg.target || 'ALL');
      } else if (msg.action === 'FORCE_REFRESH') {
        if (now - lastForceRefreshAt < 8000) return;
        lastForceRefreshAt = now;
        await orchestrator.pollMainSpine();
        await orchestrator.pollDeepTelemetry();
      }
    } catch (_) {}
  });
});

server.listen(PORT, HOST, async () => {
  console.log(`\nPulseBet Studio — Yerel Analiz & Canlı Bahis Terminali`);
  console.log(`🌐 Yerel Erişim: http://${HOST}:${PORT} (Ağ/IP Paylaşımı Devre Dışı)`);
  await orchestrator.start();
});

process.on('SIGINT', () => {
  orchestrator.stop();
  process.exit(0);
});
