import { useSyncExternalStore } from 'react';

const KEY = 'intermusic-settings';
const DEFAULTS = {
  accent: '#e04f33',
  miniPlayer: true,
  scrubSound: true,
  bassShake: true,
  bassPower: 100,
  reduceMotion: false,
  eq: [0, 0, 0, 0, 0],
};

let state = { ...DEFAULTS };
try { state = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY)) }; } catch {}

const subs = new Set();
function apply(s) {
  document.documentElement.style.setProperty('--accent', s.accent);
  document.documentElement.style.setProperty('--accent-hover', s.accent);
  document.documentElement.classList.toggle('reduce-motion', !!s.reduceMotion);
  if (!s.bassShake || s.reduceMotion) {
    document.documentElement.style.setProperty('--bx', '0px');
    document.documentElement.style.setProperty('--by', '0px');
  }
  window.dispatchEvent(new CustomEvent('intermusic-eq', { detail: s.eq }));
  window.api?.setSettings?.({ miniPlayer: s.miniPlayer }).catch?.(() => {});
}
apply(state);

export function updateSettings(patch) {
  state = { ...state, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  apply(state);
  subs.forEach(f => f());
}

export function getSettings() {
  return state;
}

const subscribe = f => (subs.add(f), () => subs.delete(f));

export default function useSettings() {
  return useSyncExternalStore(subscribe, () => state);
}
