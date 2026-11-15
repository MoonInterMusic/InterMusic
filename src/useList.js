import { useSyncExternalStore } from 'react';

// "Ma liste": liked tracks, albums and imported playlists, persisted in localStorage.
const KEY = 'intermusic-list';
const subs = new Set();
let list = { track: [], album: [], playlist: [] };
try { list = { ...list, ...JSON.parse(localStorage.getItem(KEY)) }; } catch {}

const save = () => {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
  subs.forEach(f => f());
};

const move = (arr, from, to) => {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

const has = (kind, id) => list[kind].some(x => x.id === id);

function toggle(kind, item) {
  list = { ...list, [kind]: has(kind, item.id) ? list[kind].filter(x => x.id !== item.id) : [item, ...list[kind]] };
  save();
}

function reorderTracks(from, to) {
  if (from === to || from < 0 || to < 0 || from >= list.track.length || to >= list.track.length) return;
  list = { ...list, track: move(list.track, from, to) };
  save();
}

function reorderPlaylist(plId, from, to) {
  list = {
    ...list,
    playlist: list.playlist.map(p => (p.id === plId && from !== to ? { ...p, tracks: move(p.tracks, from, to) } : p)),
  };
  save();
}

function createPlaylist(name, firstTrack) {
  const clean = (name || '').trim();
  if (!clean) return null;
  const pl = {
    id: `pl-${Date.now()}`,
    name: clean,
    source: 'Locale',
    imgUrl: firstTrack?.imgUrl || '',
    tracks: firstTrack ? [firstTrack] : [],
  };
  list = { ...list, playlist: [pl, ...list.playlist] };
  save();
  return pl;
}

function toggleInPlaylist(plId, track) {
  let added = false;
  list = {
    ...list,
    playlist: list.playlist.map(p => {
      if (p.id !== plId) return p;
      const exists = p.tracks.some(t => t.id === track.id);
      added = !exists;
      const tracks = exists ? p.tracks.filter(t => t.id !== track.id) : [...p.tracks, track];
      return { ...p, imgUrl: p.imgUrl || track.imgUrl || '', tracks };
    }),
  };
  save();
  return added;
}

export function openPlaylistPicker(track) {
  if (track) window.dispatchEvent(new CustomEvent('intermusic-pick-playlist', { detail: track }));
}

const subscribe = f => (subs.add(f), () => subs.delete(f));

export default function useList() {
  const items = useSyncExternalStore(subscribe, () => list);
  return { items, has, toggle, reorderTracks, reorderPlaylist, createPlaylist, toggleInPlaylist };
}
