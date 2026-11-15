// Electron main-process handlers (electron/main.cjs), exposed by electron/preload.cjs
export const getJSON = path => window.api.deezer(path);
// One request per track, shared between prefetch and play.
const ytMemo = new Map();
const cleanName = s => (s || '')
  .replace(/\((?:feat\.?|ft\.?|with|remaster(?:ed)?|live|deluxe|version|edit|radio)[^)]*\)/gi, '')
  .replace(/\[[^\]]*\]/g, '')
  .replace(/\s{2,}/g, ' ')
  .trim();
export function trackIds(t) {
  const title = cleanName(t.name);
  const q = `${t.artist} ${title} audio`;
  const key = `${q}::${t.duration || 0}`;
  if (!ytMemo.has(key)) {
    ytMemo.set(key, window.api.ytSearch({ q, title, artist: t.artist, duration: t.duration || 0 }).catch(e => { ytMemo.delete(key); throw e; }));
  }
  return ytMemo.get(key);
}
export const prefetch = (...ts) => ts.forEach(t => t && trackIds(t).catch(() => {}));
export const importPlaylist = u => window.api.importPlaylist(u);
export const fetchLyrics = t => t ? window.api.lyrics({ artist: t.artist, title: t.name, album: t.album, duration: t.duration }) : Promise.resolve(null);

export function mapDzAlbum(r, type = 'Album') {
  return {
    id: String(r.id || ''),
    name: r.title || '',
    artist: r.artist?.name || '',
    imgUrl: r.cover_big || r.cover_medium || r.cover_xl || '',
    year: r.release_date ? r.release_date.slice(0, 4) : '',
    type,
    url: r.link || ''
  };
}

export function mapDzTrack(r) {
  return {
    id: String(r.id || ''),
    name: r.title || '',
    artist: r.artist?.name || '',
    artistId: String(r.artist?.id || ''),
    imgUrl: r.album?.cover_big || r.album?.cover_xl || '',
    album: r.album?.title || '',
    duration: r.duration || 0,
    url: r.link || ''
  };
}

export function mapDzArtist(r) {
  return { id: String(r.id), name: r.name, imgUrl: r.picture_big || r.picture_xl || '' };
}

export function fmt(s) {
  s = Math.max(0, Math.floor(s || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const GENRES = [
  { id: 132, name: 'Pop',         color: '#ff2d55' },
  { id: 116, name: 'Hip-Hop',     color: '#a855f7' },
  { id: 165, name: 'R&B / Soul',  color: '#3b82f6' },
  { id: 106, name: 'Électro',     color: '#14b8a6' },
  { id: 152, name: 'Rock',        color: '#f97316' },
  { id: 85,  name: 'Alternative', color: '#22c55e' },
  { id: 113, name: 'Dance',       color: '#ec4899' },
  { id: 84,  name: 'Country',     color: '#ca8a04' },
  { id: 197, name: 'Latin',       color: '#ef4444' },
  { id: 464, name: 'Metal',       color: '#64748b' },
  { id: 129, name: 'Jazz',        color: '#eab308' },
  { id: 7,   name: 'Blues',       color: '#0ea5e9' },
];
