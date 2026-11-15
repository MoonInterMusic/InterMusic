import { useSyncExternalStore } from 'react';

const KEY = 'intermusic-settings';

export const SURFACE_THEMES = {
  obsidian: { name: 'Obsidienne', bg: '#0c0c0e', bg2: '#141417', surface: '#18181c', surface2: '#212127', light: false },
  midnight: { name: 'Minuit',     bg: '#080c16', bg2: '#0f1628', surface: '#141d34', surface2: '#1c2846', light: false },
  emerald:  { name: 'Émeraude',   bg: '#07110d', bg2: '#0d1d17', surface: '#12271f', surface2: '#19352a', light: false },
  plum:     { name: 'Prune',      bg: '#120a16', bg2: '#1b1022', surface: '#23152c', surface2: '#2f1c3b', light: false },
  light:    { name: 'Clair',      bg: '#f2efe9', bg2: '#e7e2d9', surface: '#ffffff', surface2: '#ded8cc', light: true },
};

const DEFAULTS = {
  accent: '#e04f33',
  btnColor: '',
  surface: 'obsidian',
  surfaceColor: '#0c0c0e',
  vivid: false,
  lyricsAnim: 'classic',
  miniPlayer: true,
  scrubSound: true,
  bassShake: true,
  bassPower: 100,
  reduceMotion: false,
  eqEnabled: true,
  eq: [0, 0, 0, 0, 0],
};

function isLightHex(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 155;
}

let state = { ...DEFAULTS };
try { state = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY)) }; } catch {}

const subs = new Set();
function apply(s) {
  const root = document.documentElement;
  const st = root.style;
  st.setProperty('--accent', s.accent);
  st.setProperty('--accent-hover', s.accent);

  const btnBg = s.btnColor || s.accent;
  st.setProperty('--btn-bg', btnBg);
  st.setProperty('--btn-text', isLightHex(btnBg) ? '#0c0c0e' : '#ffffff');

  const preset = SURFACE_THEMES[s.surface];
  const bg = preset ? preset.bg : (s.surfaceColor || '#0c0c0e');
  const light = preset ? preset.light : isLightHex(bg);
  if (preset) {
    st.setProperty('--bg', preset.bg);
    st.setProperty('--bg2', preset.bg2);
    st.setProperty('--surface', preset.surface);
    st.setProperty('--surface2', preset.surface2);
  } else {
    const mix = light ? '#000000' : '#ffffff';
    st.setProperty('--bg', bg);
    st.setProperty('--bg2', `color-mix(in srgb, ${bg} 93%, ${mix})`);
    st.setProperty('--surface', `color-mix(in srgb, ${bg} 88%, ${mix})`);
    st.setProperty('--surface2', `color-mix(in srgb, ${bg} 80%, ${mix})`);
  }
  st.setProperty('--nav-bg', `color-mix(in srgb, ${bg} 92%, transparent)`);
  st.setProperty('--text', light ? '#141417' : '#f4f0e8');
  st.setProperty('--text2', light ? '#55524c' : '#9e9990');
  st.setProperty('--text3', light ? '#88837b' : '#635f58');
  st.setProperty('--border', light ? 'rgba(20, 20, 23, .11)' : 'rgba(244, 240, 232, .09)');
  st.setProperty('--border-strong', light ? 'rgba(20, 20, 23, .22)' : 'rgba(244, 240, 232, .18)');
  st.colorScheme = light ? 'light' : 'dark';

  root.classList.toggle('vivid', !!s.vivid);
  root.classList.toggle('reduce-motion', !!s.reduceMotion);
  if (!s.bassShake || s.reduceMotion) {
    st.setProperty('--bx', '0px');
    st.setProperty('--by', '0px');
  }
  window.dispatchEvent(new CustomEvent('intermusic-eq', { detail: { eq: s.eq, enabled: s.eqEnabled !== false } }));
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
