// InterMusic desktop: Deezer metadata + YouTube video search over IPC.
const { app, BrowserWindow, ipcMain, shell, session, screen, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const { registerSetupIpc } = require('./setup.cjs');
const http = require('http');
const fs = require('fs');
const path = require('path');
const discord = require('./discord.cjs');
const EXE_NAME = path.basename(process.env.APPIMAGE || process.execPath).toLowerCase();
const IS_SETUP = process.argv.includes('--setup') || process.env.INTERMUSIC_SETUP === '1' || EXE_NAME.includes('setup');

// Fixed port: the YouTube embed needs an http origin, and localStorage ("Ma liste") is tied to it.
const PORT = 47831;
const DIST = path.join(__dirname, '..', 'dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.json': 'application/json' };

const fetchT = (url, opts = {}, ms = 5000) =>
  fetch(url, { ...opts, signal: AbortSignal.timeout(ms) });

ipcMain.handle('deezer', async (_, p) => (await fetchT(`https://api.deezer.com${p}`, {}, 6000)).json());

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const RENDERER = /"videoRenderer":\{"videoId":"([\w-]{11})"/g;
const ANY_ID = /"videoId":"([\w-]{11})"/g;
const extract = (txt, re) => [...new Set([...txt.matchAll(re)].map(m => m[1]))].slice(0, 20);
const cleanQuery = q => q
  .replace(/\((?:feat\.?|ft\.?|with|remaster(?:ed)?|live|deluxe|version|edit|radio)[^)]*\)/gi, '')
  .replace(/\[[^\]]*\]/g, '')
  .replace(/\s+-\s+(?:remaster|live|radio|single|album|deluxe).*$/i, '')
  .replace(/\s{2,}/g, ' ')
  .trim();

// Search results survive restarts: a track already played starts instantly.
const CACHE_FILE = path.join(app.getPath('userData'), 'yt-cache.json');
let ytCache = new Map();
try { ytCache = new Map(Object.entries(JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')))); } catch {}
let saveTimer;
const saveCache = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => fs.promises.writeFile(CACHE_FILE, JSON.stringify(Object.fromEntries(ytCache))).catch(() => {}), 2000);
};
const ytInFlight = new Map();

const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const parseLen = txt => {
  if (!txt) return 0;
  const p = txt.split(':').map(Number);
  if (p.some(Number.isNaN)) return 0;
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : 0;
};
const JUNK_WORDS = ['karaoke', 'instrumental', '8d audio', 'slowed', 'reverb', 'nightcore', 'sped up', 'reaction', 'tutorial', 'cover'];

function extractVideos(json) {
  const out = [];
  const walk = node => {
    if (!node || typeof node !== 'object') return;
    if (node.videoRenderer?.videoId) {
      const v = node.videoRenderer;
      out.push({
        id: v.videoId,
        title: (v.title?.runs || []).map(r => r.text).join(''),
        author: v.ownerText?.runs?.[0]?.text || '',
        dur: parseLen(v.lengthText?.simpleText),
      });
      return;
    }
    if (Array.isArray(node)) node.forEach(walk);
    else Object.values(node).forEach(walk);
  };
  walk(json);
  return out;
}

function rankVideos(videos, title, artist, targetDur) {
  const nt = norm(title);
  const na = norm(artist);
  const tWords = nt.split(' ').filter(w => w.length > 1);
  const aWords = na.split(' ').filter(w => w.length > 1);
  const seen = new Set();
  const scored = [];

  for (const v of videos) {
    if (!v.id || seen.has(v.id)) continue;
    seen.add(v.id);
    const vt = norm(v.title);
    const va = norm(v.author);
    const combined = `${vt} ${va}`;

    // Skip obvious junk unless requested in title
    if (JUNK_WORDS.some(j => combined.includes(j) && !nt.includes(j))) continue;
    // Skip tiny clips (< 35s) or huge compilations (> 2.5x) when we know track duration
    if (targetDur > 45 && v.dur > 0 && (v.dur < 35 || v.dur > targetDur * 2.5)) continue;

    // Require title match when we have title words
    const matchedTitle = tWords.filter(w => vt.includes(w)).length;
    if (tWords.length > 0 && matchedTitle / tWords.length < 0.6) continue;

    let score = (matchedTitle / Math.max(1, tWords.length)) * 50;
    if (vt.includes(nt)) score += 25;
    if (aWords.some(w => combined.includes(w))) score += 20;
    if (va.includes('official') || va.includes('officiel') || va.includes('topic') || vt.includes('audio') || vt.includes('lyrics') || vt.includes('paroles')) score += 10;
    if (targetDur > 0 && v.dur > 0) {
      const diff = Math.abs(v.dur - targetDur);
      if (diff <= 5) score += 25;
      else if (diff <= 15) score += 15;
      else if (diff > 45) score -= 25;
    }
    scored.push({ id: v.id, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map(x => x.id).slice(0, 15);
}

// InnerTube JSON search (videos only) returning structured videoRenderer items.
async function innertubeVideos(q) {
  const res = await fetchT('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ context: { client: { clientName: 'WEB', clientVersion: '2.20240101.00.00', hl: 'fr' } }, query: q, params: 'EgIQAQ%3D%3D' }),
  }, 4500);
  if (!res.ok) throw new Error(`YouTube ${res.status}`);
  return extractVideos(await res.json());
}

async function scrape(q) {
  const res = await fetchT(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8', Cookie: 'CONSENT=YES+1; SOCS=CAI' },
  }, 5000);
  if (!res.ok) throw new Error(`YouTube ${res.status}`);
  const html = await res.text();
  const ids = extract(html, RENDERER);
  return ids.length ? ids : extract(html, ANY_ID);
}

async function resolveYt({ q, title, artist, duration }) {
  const simplified = cleanQuery(q).replace(/\baudio\b/gi, '').trim();
  const queries = [innertubeVideos(q)];
  if (simplified) queries.push(innertubeVideos(`${simplified} lyrics`));
  const settled = await Promise.allSettled(queries);
  const allVideos = settled.flatMap(r => (r.status === 'fulfilled' ? r.value : []));
  let ids = title ? rankVideos(allVideos, title, artist, duration) : [...new Set(allVideos.map(v => v.id))].slice(0, 15);
  if (!ids.length && allVideos.length && !title) ids = [...new Set(allVideos.map(v => v.id))].slice(0, 15);
  if (!ids.length) {
    const fallbacks = [scrape(q)];
    if (simplified && simplified.toLowerCase() !== q.toLowerCase()) fallbacks.push(scrape(simplified));
    const fb = await Promise.allSettled(fallbacks);
    ids = [...new Set(fb.flatMap(r => (r.status === 'fulfilled' ? r.value : [])))].slice(0, 15);
  }
  return ids;
}

// Up to 15 matched & ranked YouTube video ids for a query.
ipcMain.handle('yt', async (_, payload) => {
  const opts = typeof payload === 'string' ? { q: payload, title: '', artist: '', duration: 0 } : payload;
  const key = `v3:${opts.q.trim().toLowerCase()}:${opts.duration || 0}`;
  const cached = ytCache.get(key);
  if (cached && cached.length) return cached;
  if (!ytInFlight.has(key)) {
    ytInFlight.set(key, resolveYt(opts).then(ids => {
      if (ids.length) { ytCache.set(key, ids); saveCache(); }
      return ids;
    }).finally(() => ytInFlight.delete(key)));
  }
  return ytInFlight.get(key);
});

// Direct ad-free audio stream resolution (VISIONOS InnerTube profile + visitorData, inspired by tryliner/desktop).
const VISITOR_RE = /Cg[s-v][A-Za-z0-9_-]{20,}(?:%3D|=){0,2}/;
let visitorCache = { value: '', expiresAt: 0 };
async function getVisitorData() {
  if (visitorCache.value && Date.now() < visitorCache.expiresAt) return visitorCache.value;
  const res = await fetchT('https://www.youtube.com/sw.js_data', { headers: { 'User-Agent': UA } }, 4500);
  const txt = await res.text();
  const m = txt.match(VISITOR_RE);
  if (m) visitorCache = { value: m[0], expiresAt: Date.now() + 6 * 3600_000 };
  return visitorCache.value;
}

const VISIONOS_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';
ipcMain.handle('yt-audio', async (_, videoId) => {
  try {
    const visitorData = await getVisitorData();
    const res = await fetchT('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': VISIONOS_UA,
        'X-YouTube-Client-Name': '101',
        'X-YouTube-Client-Version': '1.02',
        Origin: 'https://www.youtube.com',
      },
      body: JSON.stringify({
        videoId,
        contentCheckOk: true,
        racyCheckOk: true,
        context: {
          client: {
            clientName: 'VISIONOS',
            clientVersion: '1.02',
            hl: 'fr',
            gl: 'FR',
            visitorData,
            userAgent: VISIONOS_UA,
            osName: 'visionOS',
            osVersion: '26.5.23O471',
            deviceMake: 'Apple',
            deviceModel: 'RealityDevice17,1',
          },
        },
      }),
    }, 5000);
    if (!res.ok) return null;
    const j = await res.json();
    if (j.playabilityStatus?.status !== 'OK') return null;
    const formats = (j.streamingData?.adaptiveFormats || [])
      .filter(f => f.mimeType?.startsWith('audio/') && f.url)
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
    const best = formats.find(f => f.mimeType.includes('mp4a')) || formats[0];
    if (!best) return null;
    const probe = await fetchT(best.url, { method: 'HEAD' }, 4000);
    if (!probe.ok) return null;
    return { url: best.url, mimeType: best.mimeType, duration: Number(j.videoDetails?.lengthSeconds || 0) };
  } catch {
    return null;
  }
});

ipcMain.handle('discord-rpc', (_, payload) => {
  const t = payload?.track;
  if (!t || !payload?.playing) return discord.clear();
  return discord.setActivity({
    title: t.name,
    artist: t.artist,
    artistId: t.artistId,
    cover: t.imgUrl,
    duration: payload.duration || t.duration || 0,
    position: payload.time || 0,
    playing: true,
  });
});

// Fetch synced/plain lyrics from LRCLIB (no API key required).
const lyricsCache = new Map();
ipcMain.handle('lyrics', async (_, { artist, title, album, duration }) => {
  const cleanTitle = cleanQuery(title || '');
  const cleanArtist = cleanQuery(artist || '');
  const key = `${cleanArtist.toLowerCase()}::${cleanTitle.toLowerCase()}`;
  if (lyricsCache.has(key)) return lyricsCache.get(key);

  const params = new URLSearchParams({ artist_name: cleanArtist, track_name: cleanTitle });
  if (album) params.set('album_name', cleanQuery(album));
  if (duration) params.set('duration', String(Math.round(duration)));

  let hit = null;
  try {
    const res = await fetchT(`https://lrclib.net/api/get?${params}`, { headers: { 'User-Agent': 'InterMusic/1.0' } }, 5000);
    if (res.ok) hit = await res.json();
  } catch {}

  if (!hit || (!hit.syncedLyrics && !hit.plainLyrics)) {
    try {
      const sq = new URLSearchParams({ q: `${cleanArtist} ${cleanTitle}` });
      const res = await fetchT(`https://lrclib.net/api/search?${sq}`, { headers: { 'User-Agent': 'InterMusic/1.0' } }, 5000);
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length) {
          hit = list.find(x => x.syncedLyrics) || list.find(x => x.plainLyrics) || null;
        }
      }
    } catch {}
  }

  const out = hit ? { synced: hit.syncedLyrics || '', plain: hit.plainLyrics || '', instrumental: !!hit.instrumental } : null;
  if (out) lyricsCache.set(key, out);
  return out;
});

// Import a Spotify or Deezer playlist/album from its share link (no account needed).
const LINK = /(spotify|deezer)\.com\/(?:[\w-]+\/)*(playlist|album)\/(\w+)/;
ipcMain.handle('playlist', async (_, url) => {
  let m = url.match(LINK);
  if (!m) m = (await fetch(url.trim(), { headers: { 'User-Agent': UA } })).url.match(LINK); // short links
  if (!m) throw new Error('Lien non reconnu');
  const [, site, kind, id] = m;
  if (site === 'deezer') {
    const dz = p => fetch(`https://api.deezer.com/${kind}/${id}${p}`).then(r => r.json());
    const [info, list] = await Promise.all([dz(''), dz('/tracks?limit=1000')]);
    if (info.error) throw new Error('Playlist introuvable');
    const cover = info.picture_xl || info.cover_xl;
    return {
      id: `dz-${id}`, name: info.title, imgUrl: cover, source: 'Deezer',
      tracks: (list.data || []).map(t => ({
        id: t.id, name: t.title, artist: t.artist?.name, artistId: t.artist?.id,
        imgUrl: t.album?.cover_big || cover, album: t.album?.title, duration: t.duration,
      })),
    };
  }
  const html = await (await fetch(`https://open.spotify.com/embed/${kind}/${id}`, { headers: { 'User-Agent': UA } })).text();
  const data = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  const e = data && JSON.parse(data[1]).props?.pageProps?.state?.data?.entity;
  if (!e?.trackList) throw new Error('Playlist introuvable');
  const cover = e.coverArt?.sources?.at(-1)?.url;
  return {
    id: `sp-${id}`, name: e.name || e.title, imgUrl: cover, source: 'Spotify',
    tracks: e.trackList.map(t => ({ id: t.uid, name: t.title, artist: t.subtitle, imgUrl: cover, duration: Math.round(t.duration / 1000) })),
  };
});

function serve() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let file = path.join(DIST, decodeURIComponent(req.url.split('?')[0]));
      if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(fs.readFileSync(file));
    });
    server.once('error', err => {
      if (err.code === 'EADDRINUSE') server.listen(0, '127.0.0.1', () => resolve(server.address().port));
      else reject(err);
    });
    server.listen(PORT, '127.0.0.1', () => resolve(PORT));
  });
}

let mainWin = null;
let miniWin = null;
let miniEnabled = true;
let latestMiniState = { track: null, playing: false, liked: false };
let activeBaseUrl = 'http://localhost:5173';

ipcMain.on('win-action', (_, action) => {
  if (!mainWin || mainWin.isDestroyed()) return;
  if (action === 'min') mainWin.minimize();
  else if (action === 'max') mainWin.isMaximized() ? mainWin.unmaximize() : mainWin.maximize();
  else if (action === 'close') mainWin.close();
});

ipcMain.handle('set-settings', (_, s) => {
  if (typeof s?.miniPlayer === 'boolean') miniEnabled = s.miniPlayer;
  if (typeof s?.discordClientId === 'string') discord.setClientId(s.discordClientId);
  if (!miniEnabled && miniWin && !miniWin.isDestroyed()) miniWin.hide();
});

ipcMain.handle('clear-yt-cache', () => {
  ytCache.clear();
  try { fs.unlinkSync(CACHE_FILE); } catch {}
});

ipcMain.on('mini-state', (_, state) => {
  latestMiniState = state || latestMiniState;
  if (miniWin && !miniWin.isDestroyed()) miniWin.webContents.send('mini-state', latestMiniState);
});

ipcMain.on('mini-action', (_, action) => {
  if (action === 'restore') {
    if (mainWin && !mainWin.isDestroyed()) {
      if (mainWin.isMinimized()) mainWin.restore();
      mainWin.show();
      mainWin.focus();
    }
    if (miniWin && !miniWin.isDestroyed()) miniWin.hide();
    return;
  }
  if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('mini-action', action);
});

function ensureMini() {
  if (miniWin && !miniWin.isDestroyed()) return miniWin;
  const wa = screen.getPrimaryDisplay().workArea;
  miniWin = new BrowserWindow({
    width: 356,
    height: 74,
    x: wa.x + wa.width - 372,
    y: wa.y + wa.height - 90,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs') },
  });
  miniWin.loadURL(`${activeBaseUrl}?mini=1`);
  miniWin.webContents.once('did-finish-load', () => {
    if (!miniWin.isDestroyed()) miniWin.webContents.send('mini-state', latestMiniState);
  });
  return miniWin;
}

async function createWindow() {
  if (IS_SETUP) {
    const win = new BrowserWindow({
      width: 540, height: 430, resizable: false, frame: false,
      title: 'InterMusic Setup', backgroundColor: '#0c0c0e',
      icon: path.join(__dirname, '..', 'build', 'icon.png'),
      webPreferences: { preload: path.join(__dirname, 'preload.cjs') },
    });
    mainWin = win;
    registerSetupIpc(() => mainWin);
    activeBaseUrl = app.isPackaged ? `http://127.0.0.1:${await serve()}` : 'http://localhost:5173';
    win.loadURL(`${activeBaseUrl}?setup=1`);
    return;
  }
  const win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 900, minHeight: 600,
    frame: false,
    title: 'InterMusic', backgroundColor: '#0c0c0e', autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), webviewTag: true },
  });
  mainWin = win;
  win.on('maximize', () => win.webContents.send('win-max', true));
  win.on('unmaximize', () => win.webContents.send('win-max', false));
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  if (app.isPackaged) {
    const port = await serve();
    activeBaseUrl = `http://127.0.0.1:${port}`;
  } else {
    activeBaseUrl = 'http://localhost:5173';
  }
  win.loadURL(activeBaseUrl);
  win.on('minimize', () => {
    if (miniEnabled && latestMiniState?.track) {
      const m = ensureMini();
      m.webContents.send('mini-state', latestMiniState);
      m.showInactive();
    }
  });
  const hideMini = () => { if (miniWin && !miniWin.isDestroyed()) miniWin.hide(); };
  win.on('restore', hideMini);
  win.on('show', hideMini);
  win.on('closed', () => {
    if (miniWin && !miniWin.isDestroyed()) miniWin.destroy();
    discord.clear();
  });
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => BrowserWindow.getAllWindows()[0]?.focus());
  app.whenReady().then(async () => {
    const ublockDir = path.join(__dirname, 'ublock').replace('app.asar', 'app.asar.unpacked');
    try {
      const loader = session.defaultSession.extensions?.loadExtension?.bind(session.defaultSession.extensions)
        || session.defaultSession.loadExtension?.bind(session.defaultSession);
      if (loader && fs.existsSync(ublockDir)) await loader(ublockDir, { allowFileAccess: true });
    } catch {}
    const AD_RE = /doubleclick\.net|googlesyndication\.com|googleadservices\.com|adservice\.google\.|youtube\.com\/(?:pagead\/|api\/stats\/ads|get_midroll_info|ptracking)/i;
    session.defaultSession.webRequest.onBeforeRequest((details, cb) => {
      cb({ cancel: AD_RE.test(details.url) });
    });
    session.defaultSession.webRequest.onHeadersReceived({ urls: ['*://*.googlevideo.com/*'] }, (details, cb) => {
      const headers = { ...details.responseHeaders, 'Access-Control-Allow-Origin': ['*'] };
      cb({ responseHeaders: headers });
    });
    createWindow();
    if (app.isPackaged) {
      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = true;
      autoUpdater.on('error', () => {});
      autoUpdater.on('update-downloaded', info => {
        dialog.showMessageBox(mainWin, {
          type: 'info',
          title: 'Mise à jour disponible',
          message: `InterMusic ${info.version} est prêt.`,
          detail: 'La mise à jour sera installée automatiquement à la fermeture, ou maintenant en redémarrant.',
          buttons: ['Redémarrer maintenant', 'Plus tard'],
          defaultId: 0,
        }).then(({ response }) => {
          if (response === 0) autoUpdater.quitAndInstall();
        }).catch(() => {});
      });
      autoUpdater.checkForUpdates().catch(() => {});
    }
  });
  app.on('window-all-closed', () => {
    discord.clear();
    app.quit();
    setTimeout(() => app.exit(0), 250).unref();
  });
}
