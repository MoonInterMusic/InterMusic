import { useEffect, useRef, useState, useCallback } from 'react';
import { getSettings } from './useSettings';

let apiPromise;
function loadApi() {
  if (!apiPromise) apiPromise = new Promise(resolve => {
    if (window.YT?.Player) return resolve(window.YT);
    window.onYouTubeIframeAPIReady = () => resolve(window.YT);
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  });
  return apiPromise;
}

const WV_CSS = `
  ytd-masthead, #secondary, #below, #comments, #masthead-container, ytd-mini-guide-renderer, tp-yt-app-drawer,
  .ytp-ad-module, .ytp-ad-overlay-container, ytd-ad-slot-renderer { display: none !important; }
  html, body { overflow: hidden !important; background: #000 !important; margin: 0 !important; }
  #player, #movie_player { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 9999 !important; max-width: none !important; }
`;

// Direct ad-free <audio> stream via InnerTube VISIONOS (tryliner/desktop approach),
// with YouTube IFrame + <webview> fallback if needed.
export default function useYouTube(containerRef, { onEnded, onFail }) {
  const player = useRef(null);
  const ready = useRef(null);
  const audioRef = useRef(null);
  const cands = useRef({ ids: [], i: 0 });
  const loadSeq = useRef(0);
  const stallTimer = useRef(null);
  const wvRef = useRef(null);
  const wvReady = useRef(false);
  const wvEnded = useRef(false);
  const volRef = useRef(80);
  const handlers = useRef({});
  handlers.current = { onEnded, onFail };

  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [wvId, setWvId] = useState(null);
  const [directAudio, setDirectAudio] = useState(false);

  const stopAll = useCallback(() => {
    clearTimeout(stallTimer.current);
    const a = audioRef.current;
    if (a) { a.pause(); a.removeAttribute('src'); a.load(); }
    player.current?.stopVideo?.();
    setWvId(null);
    setDirectAudio(false);
    wvReady.current = false;
  }, []);

  const tryNext = useCallback((p, errCode) => {
    clearTimeout(stallTimer.current);
    const c = cands.current;
    if ((errCode === 101 || errCode === 150) && c.ids[c.i]) {
      p.stopVideo?.();
      wvReady.current = false;
      wvEnded.current = false;
      setBuffering(true);
      setWvId(c.ids[c.i]);
      return;
    }
    if (++c.i < c.ids.length) {
      p.loadVideoById(c.ids[c.i]);
      stallTimer.current = setTimeout(() => tryNext(p), 5000);
    } else {
      handlers.current.onFail?.();
    }
  }, []);

  // Native HTML5 <audio> element for direct ad-free streams.
  useEffect(() => {
    const a = new Audio();
    if (window.api) a.crossOrigin = 'anonymous';
    a.preload = 'auto';
    audioRef.current = a;
    let analyser = null;
    let actx = null;
    let filters = [];
    let bins = null;
    let rafId = 0;
    let avgBass = 0;
    let shake = 0;
    let phase = 0;
    let wasZero = true;

    const resetShake = () => {
      if (wasZero) return;
      wasZero = true;
      shake = 0;
      document.documentElement.style.setProperty('--bx', '0px');
      document.documentElement.style.setProperty('--by', '0px');
    };

    const applyEq = detail => {
      if (!actx || !filters.length) return;
      const enabled = detail?.enabled !== false;
      const vals = Array.isArray(detail?.eq) ? detail.eq : Array.isArray(detail) ? detail : [0, 0, 0, 0, 0];
      filters.forEach((f, i) => f.gain.setTargetAtTime(enabled ? (Number(vals[i]) || 0) : 0, actx.currentTime, 0.02));
    };

    const onEq = e => applyEq(e.detail);
    window.addEventListener('intermusic-eq', onEq);

    const ensureAnalyser = () => {
      if (analyser || !window.api) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        actx = new AC();
        const src = actx.createMediaElementSource(a);
        const freqs = [60, 230, 910, 3600, 14000];
        const st = getSettings();
        const eq = st.eq || [0, 0, 0, 0, 0];
        const on = st.eqEnabled !== false;
        filters = freqs.map((freq, i) => {
          const f = actx.createBiquadFilter();
          f.type = i === 0 ? 'lowshelf' : i === freqs.length - 1 ? 'highshelf' : 'peaking';
          f.frequency.value = freq;
          f.Q.value = 1;
          f.gain.value = on ? (Number(eq[i]) || 0) : 0;
          return f;
        });
        analyser = actx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.minDecibels = -62;
        analyser.maxDecibels = -12;
        analyser.smoothingTimeConstant = 0.55;
        let node = src;
        for (const f of filters) { node.connect(f); node = f; }
        node.connect(analyser);
        analyser.connect(actx.destination);
        bins = new Uint8Array(analyser.frequencyBinCount);
      } catch {}
    };

    const tickShake = () => {
      if (a.paused || !analyser || !bins) { rafId = 0; resetShake(); return; }
      const { bassShake, bassPower = 100, reduceMotion } = getSettings();
      if (!bassShake || reduceMotion) {
        resetShake();
      } else {
        if (actx?.state === 'suspended') actx.resume().catch(() => {});
        analyser.getByteFrequencyData(bins);
        const sub = (bins[0] + bins[1] + bins[2]) / (3 * 255);
        avgBass = avgBass * 0.94 + sub * 0.06;
        const heavy = Math.max(0, sub - 0.72);
        const punch = sub > 0.65 ? Math.max(0, sub - avgBass * 1.06) : 0;
        const mult = Math.max(0.2, Math.min(2.5, bassPower / 100));
        const target = Math.min(1.8 * mult, (heavy * 5 + punch * 8) * mult);
        shake = target > shake ? target : shake * 0.8;
        if (shake > 0.15) {
          wasZero = false;
          phase = (phase + 2.39996) % (Math.PI * 2);
          document.documentElement.style.setProperty('--bx', `${(Math.cos(phase) * shake).toFixed(2)}px`);
          document.documentElement.style.setProperty('--by', `${(Math.sin(phase) * shake).toFixed(2)}px`);
        } else {
          resetShake();
        }
      }
      rafId = requestAnimationFrame(tickShake);
    };

    const onPlay = () => {
      setPlaying(true); setBuffering(false);
      ensureAnalyser();
      if (actx?.state === 'suspended') actx.resume().catch(() => {});
      if (!rafId) rafId = requestAnimationFrame(tickShake);
    };
    const onPause = () => { setPlaying(false); if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } resetShake(); };
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => {
      setPlaying(true); setBuffering(false);
      if (!rafId && analyser) rafId = requestAnimationFrame(tickShake);
    };
    const onTime = () => setTime(a.currentTime || 0);
    const onMeta = () => { if (Number.isFinite(a.duration) && a.duration > 0) setDuration(a.duration); };
    const onEnd = () => handlers.current.onEnded?.();
    const onErr = () => {
      if (!a.getAttribute('src')) return;
      setDirectAudio(false);
      ready.current?.then(p => tryNext(p)).catch(() => handlers.current.onFail?.());
    };
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('waiting', onWaiting);
    a.addEventListener('playing', onPlaying);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('ended', onEnd);
    a.addEventListener('error', onErr);
    return () => {
      window.removeEventListener('intermusic-eq', onEq);
      if (rafId) cancelAnimationFrame(rafId);
      resetShake();
      try { actx?.close(); } catch {}
      a.pause();
      a.removeAttribute('src');
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('waiting', onWaiting);
      a.removeEventListener('playing', onPlaying);
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('error', onErr);
    };
  }, [tryNext]);

  useEffect(() => {
    // React never owns this node: YT replaces it with its iframe.
    const host = document.createElement('div');
    containerRef.current.appendChild(host);
    ready.current = loadApi().then(YT => new Promise(resolve => {
      const p = new YT.Player(host, {
        width: '100%',
        height: '100%',
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1, origin: window.location.origin },
        events: {
          onReady: () => { player.current = p; resolve(p); },
          onStateChange: e => {
            if (wvId || directAudio) return;
            setPlaying(e.data === 1);
            setBuffering(e.data === 3);
            if (e.data === 1 || e.data === 2) clearTimeout(stallTimer.current);
            if (e.data === 1) setDuration(p.getDuration());
            if (e.data === 0) handlers.current.onEnded?.();
          },
          onError: e => {
            if (!directAudio) tryNext(p, e.data);
          },
        },
      });
    }));
    return () => clearTimeout(stallTimer.current);
  }, [containerRef, tryNext]);

  // Attach listeners & state poller when VEVO/official clip webview is active.
  useEffect(() => {
    if (!wvId) return;
    const wv = wvRef.current;
    if (!wv) return;

    const onDomReady = () => {
      wvReady.current = true;
      wv.insertCSS(WV_CSS).catch(() => {});
      wv.executeJavaScript(`
        (() => {
          const v = document.querySelector('video');
          if (v) { v.volume = ${volRef.current / 100}; v.play().catch(() => {}); }
        })()
      `).catch(() => {});
    };

    wv.addEventListener('dom-ready', onDomReady);
    const poll = setInterval(() => {
      if (!wvReady.current) return;
      wv.executeJavaScript(`
        (() => {
          const skip = document.querySelector('.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-ad-overlay-close-button');
          if (skip) skip.click();
          const v = document.querySelector('video');
          if (!v) return null;
          const ad = document.querySelector('#movie_player.ad-showing, .ad-showing');
          if (ad) {
            v.muted = true;
            if (Number.isFinite(v.duration) && v.duration > 0) v.currentTime = v.duration;
            return null;
          }
          if (v.muted) v.muted = false;
          return { t: v.currentTime || 0, d: v.duration || 0, p: !v.paused && !v.ended, e: v.ended, r: v.readyState };
        })()
      `).then(s => {
        if (!s) return;
        setTime(s.t);
        if (s.d && Number.isFinite(s.d)) setDuration(s.d);
        setPlaying(s.p);
        setBuffering(!s.p && s.r < 3 && !s.e);
        if (s.e && !wvEnded.current) {
          wvEnded.current = true;
          handlers.current.onEnded?.();
        }
      }).catch(() => {});
    }, 400);

    return () => {
      wv.removeEventListener('dom-ready', onDomReady);
      clearInterval(poll);
    };
  }, [wvId]);

  useEffect(() => {
    if (!playing || wvId || directAudio) return;
    const t = setInterval(() => setTime(player.current?.getCurrentTime() || 0), 400);
    return () => clearInterval(t);
  }, [playing, wvId, directAudio]);

  const load = useCallback(async ids => {
    const seq = ++loadSeq.current;
    stopAll();
    cands.current = { ids, i: 0 };
    setTime(0);
    setDuration(0);
    setBuffering(true);

    // 1. Try direct ad-free audio stream (VISIONOS InnerTube) on top candidates.
    for (let i = 0; i < Math.min(4, ids.length); i++) {
      if (seq !== loadSeq.current) return;
      const stream = await window.api.ytAudio?.(ids[i]).catch(() => null);
      if (seq !== loadSeq.current) return;
      if (stream?.url && audioRef.current) {
        cands.current.i = i;
        setDirectAudio(true);
        if (stream.duration) setDuration(stream.duration);
        audioRef.current.src = stream.url;
        audioRef.current.volume = volRef.current / 100;
        try {
          await audioRef.current.play();
          return;
        } catch {
          setDirectAudio(false);
          audioRef.current.removeAttribute('src');
        }
      }
    }

    // 2. Fallback to YouTube IFrame + <webview> if direct audio failed.
    if (seq !== loadSeq.current) return;
    const p = await ready.current;
    if (seq !== loadSeq.current) return;
    cands.current = { ids, i: 0 };
    p.loadVideoById(ids[0]);
    stallTimer.current = setTimeout(() => tryNext(p), 5000);
  }, [stopAll, tryNext]);

  const toggle = useCallback(() => {
    if (directAudio && audioRef.current) {
      audioRef.current.paused ? audioRef.current.play().catch(() => {}) : audioRef.current.pause();
      return;
    }
    if (wvId && wvRef.current && wvReady.current) {
      wvRef.current.executeJavaScript(`(() => { const v = document.querySelector('video'); if (v) v.paused ? v.play() : v.pause(); })()`).catch(() => {});
      return;
    }
    const p = player.current;
    if (p) playing ? p.pauseVideo() : p.playVideo();
  }, [playing, wvId, directAudio]);

  const seek = useCallback(ratio => {
    if (!duration) return;
    const target = ratio * duration;
    if (directAudio && audioRef.current) {
      audioRef.current.currentTime = target;
      setTime(target);
      return;
    }
    if (wvId && wvRef.current && wvReady.current) {
      wvRef.current.executeJavaScript(`(() => { const v = document.querySelector('video'); if (v) v.currentTime = ${target}; })()`).catch(() => {});
      setTime(target);
      return;
    }
    const p = player.current;
    if (!p) return;
    p.seekTo(target, true);
    setTime(target);
  }, [duration, wvId, directAudio]);

  const setVolume = useCallback(v => {
    volRef.current = v;
    if (audioRef.current) audioRef.current.volume = v / 100;
    if (wvId && wvRef.current && wvReady.current) {
      wvRef.current.executeJavaScript(`(() => { const v = document.querySelector('video'); if (v) v.volume = ${v / 100}; })()`).catch(() => {});
    }
    player.current?.setVolume(v);
  }, [wvId]);

  return { load, toggle, seek, setVolume, playing, buffering, time, duration, wvId, wvRef, directAudio };
}
