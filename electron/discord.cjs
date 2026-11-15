const net = require('net');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

let CLIENT_ID = '1571285960405032990';
let sock = null;
let ready = false;
let connecting = false;
let pending = null;
let retryTimer = null;
let rxBuf = Buffer.alloc(0);
let noTypeFallback = false;
let seq = 0;
const artistCache = new Map();

const pad2 = (s, fallback = 'InterMusic') => {
  const str = String(s || fallback).trim().slice(0, 128);
  return str.length < 2 ? str.padEnd(2, ' ') : str;
};

function frame(op, data) {
  const body = Buffer.from(JSON.stringify(data), 'utf8');
  const buf = Buffer.alloc(8 + body.length);
  buf.writeInt32LE(op, 0);
  buf.writeInt32LE(body.length, 4);
  body.copy(buf, 8);
  return buf;
}

function pipePaths() {
  if (process.platform === 'win32') {
    return Array.from({ length: 10 }, (_, i) => `\\\\?\\pipe\\discord-ipc-${i}`);
  }
  const rt = process.env.XDG_RUNTIME_DIR || os.tmpdir();
  const dirs = [rt, path.join(rt, 'app/com.discordapp.Discord'), path.join(rt, 'snap.discord')];
  const out = [];
  for (const d of dirs) {
    for (let i = 0; i < 4; i++) out.push(path.join(d, `discord-ipc-${i}`));
  }
  return out;
}

function scheduleRetry() {
  if (retryTimer || !pending) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (pending && !ready && !connecting) connect(0);
  }, 15000);
}

function sendActivity(act) {
  if (!sock || !ready) return;
  const payload = noTypeFallback && act?.type ? { ...act } : act;
  if (noTypeFallback && payload) delete payload.type;
  try {
    sock.write(frame(1, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity: payload }, nonce: crypto.randomUUID() }));
  } catch {}
}

function handleFrame(op, msg) {
  if (op === 2) {
    try { sock?.destroy(); } catch {}
    return;
  }
  if (op !== 1 || !msg) return;
  if (msg.evt === 'READY') {
    ready = true;
    connecting = false;
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    if (pending) sendActivity(pending);
    return;
  }
  if (msg.evt === 'ERROR' && pending?.type && !noTypeFallback) {
    noTypeFallback = true;
    sendActivity(pending);
  }
}

function connect(i = 0, paths = pipePaths()) {
  if (ready || !CLIENT_ID) return;
  if (i >= paths.length) {
    connecting = false;
    scheduleRetry();
    return;
  }
  connecting = true;
  rxBuf = Buffer.alloc(0);
  const s = net.createConnection(paths[i]);
  s.once('connect', () => {
    sock = s;
    try { s.write(frame(0, { v: 1, client_id: CLIENT_ID })); } catch {}
  });
  s.on('data', (chunk) => {
    rxBuf = Buffer.concat([rxBuf, chunk]);
    while (rxBuf.length >= 8) {
      const op = rxBuf.readInt32LE(0);
      const len = rxBuf.readInt32LE(4);
      if (len < 0 || len > 1024 * 1024) { rxBuf = Buffer.alloc(0); break; }
      if (rxBuf.length < 8 + len) break;
      const raw = rxBuf.subarray(8, 8 + len).toString('utf8');
      rxBuf = rxBuf.subarray(8 + len);
      try { handleFrame(op, JSON.parse(raw)); } catch {}
    }
  });
  s.once('error', () => {
    s.destroy();
    if (sock !== s) connect(i + 1, paths);
  });
  s.once('close', () => {
    if (sock === s) {
      sock = null;
      ready = false;
      connecting = false;
      scheduleRetry();
    }
  });
}

async function getArtistImg(artist, artistId) {
  const key = artistId || artist;
  if (!key) return null;
  if (artistCache.has(key)) return artistCache.get(key);
  let img = null;
  try {
    const signal = AbortSignal.timeout(3000);
    if (artistId) {
      const r = await fetch(`https://api.deezer.com/artist/${encodeURIComponent(artistId)}`, { signal });
      const d = await r.json();
      img = d?.picture_medium || d?.picture || null;
    } else {
      const r = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(artist)}&limit=1`, { signal });
      const d = await r.json();
      img = d?.data?.[0]?.picture_medium || d?.data?.[0]?.picture || null;
    }
  } catch {}
  artistCache.set(key, img);
  return img;
}

async function setActivity({ title, artist, artistId, cover, duration, position, playing }) {
  if (!CLIENT_ID) return;
  const mySeq = ++seq;
  if (!playing) {
    pending = null;
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    if (ready) sendActivity(null);
    return;
  }
  const now = Math.floor(Date.now() / 1000);
  const start = Math.max(0, now - Math.floor(position || 0));
  const artistImg = await getArtistImg(artist, artistId);
  if (mySeq !== seq) return;
  const act = {
    type: 2,
    details: pad2(title, 'InterMusic'),
    state: pad2(artist, 'Artiste inconnu'),
    assets: {
      large_image: cover || 'intermusic',
      large_text: pad2(title, 'InterMusic'),
      ...(artistImg ? { small_image: artistImg, small_text: pad2(artist, 'Artiste') } : {}),
    },
    ...(duration > 0 ? { timestamps: { start, end: start + Math.floor(duration) } } : { timestamps: { start } }),
  };
  pending = act;
  if (!ready) {
    if (!connecting) connect(0);
    return;
  }
  sendActivity(act);
}

function clear() {
  ++seq;
  pending = null;
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
  if (ready) sendActivity(null);
}

function setClientId(id) {
  const next = (id || '').trim() || '1571285960405032990';
  if (next === CLIENT_ID) return;
  CLIENT_ID = next;
  ready = false;
  connecting = false;
  noTypeFallback = false;
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
  try { sock?.destroy(); } catch {}
  sock = null;
  if (pending) connect(0);
}

module.exports = { setActivity, clear, setClientId };
