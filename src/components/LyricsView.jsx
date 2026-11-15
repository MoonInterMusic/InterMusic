import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchLyrics } from '../api';
import { Close } from './Icons';
import useSettings from '../useSettings';

function parseLrc(lrc) {
  if (!lrc) return [];
  const lines = [];
  for (const raw of lrc.split('\n')) {
    const matches = [...raw.matchAll(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g)];
    if (!matches.length) continue;
    const text = raw.replace(/\[[^\]]*\]/g, '').trim();
    for (const m of matches) {
      const ms = m[3] ? Number(m[3].padEnd(3, '0')) : 0;
      const time = Number(m[1]) * 60 + Number(m[2]) + ms / 1000;
      lines.push({ time, text: text || '···' });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

export default function LyricsView({ open, track, yt, onClose, onArtist }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [discFront, setDiscFront] = useState(false);
  const [swapped, setSwapped] = useState(false);
  const settings = useSettings();
  const activeRef = useRef(null);
  const scrollRef = useRef(null);
  const discRotRef = useRef(null);
  const angleRef = useRef(0);
  const scrubVelRef = useRef(0);

  useEffect(() => {
    if (!open || !track) return;
    let cancelled = false;
    setLoading(true);
    setData(null);
    fetchLyrics(track)
      .then(res => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, track?.id, track?.name, track?.artist]);

  useEffect(() => {
    if (!open) return;
    const onKey = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const onScrub = e => {
      const d = Number(e.detail) || 0;
      scrubVelRef.current = Math.max(-1400, Math.min(1400, scrubVelRef.current + d * 4500));
    };
    window.addEventListener('intermusic-scrub', onScrub);
    let raf = 0;
    let last = performance.now();
    const tick = now => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const base = yt.playing && !settings.reduceMotion ? 80 : 0;
      const vel = base + scrubVelRef.current;
      scrubVelRef.current *= 0.88;
      if (Math.abs(scrubVelRef.current) < 1) scrubVelRef.current = 0;
      if (vel !== 0 && discRotRef.current) {
        angleRef.current = (angleRef.current + vel * dt) % 360;
        discRotRef.current.style.transform = `rotate(${angleRef.current.toFixed(2)}deg)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('intermusic-scrub', onScrub);
    };
  }, [open, yt.playing, settings.reduceMotion]);

  const synced = useMemo(() => parseLrc(data?.synced), [data?.synced]);
  const plainLines = useMemo(
    () => (data?.plain ? data.plain.split('\n') : []),
    [data?.plain]
  );

  const activeIdx = useMemo(() => {
    if (!synced.length) return -1;
    const t = yt.time + 0.25;
    let idx = -1;
    for (let i = 0; i < synced.length; i++) {
      if (synced[i].time <= t) idx = i;
      else break;
    }
    return idx;
  }, [synced, yt.time]);

  useEffect(() => {
    if (!open || activeIdx < 0 || !activeRef.current) return;
    activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [open, activeIdx]);

  if (!open || !track) return null;

  const totalDur = yt.duration || track.duration || 0;

  return (
    <section className={`lv${yt.playing ? ' is-playing' : ''}`} aria-label="Paroles en plein écran">
      <div className="lv-bg" aria-hidden="true">
        {track.imgUrl && <img key={track.imgUrl} src={track.imgUrl} alt="" />}
      </div>
      <div className="lv-top">
        <button className="lv-close" onClick={onClose}>
          <Close size={16} />
          <span>Fermer</span>
        </button>
        <div className="lv-badge">
          {yt.playing && <span className="lv-dot" aria-hidden="true" />}
          {synced.length > 0 ? 'Paroles synchronisées' : plainLines.length > 0 ? 'Paroles non synchronisées' : 'Paroles'}
        </div>
      </div>

      <div className="lv-grid">
        <div className="lv-left">
          <button
            type="button"
            className={`lv-stage${yt.playing ? ' spin' : ''}${discFront ? ' disc-front' : ''}${swapped ? ' swapped' : ''}`}
            onClick={() => { setSwapped(true); setDiscFront(f => !f); }}
            title={discFront ? 'Mettre la pochette en avant' : 'Mettre le vinyle en avant'}
          >
            <div className="lv-disc" aria-hidden="true">
              <div className="lv-disc-rot" ref={discRotRef}>
                <div className="lv-disc-label">
                  {track.imgUrl && <img src={track.imgUrl} alt="" />}
                  <span className="lv-spindle" />
                </div>
              </div>
            </div>
            <div className="lv-sleeve">
              {track.imgUrl && <img src={track.imgUrl} alt={track.name} />}
            </div>
          </button>

          <div className="lv-meta">
            <h1 className="lv-title">{track.name}</h1>
            <button className="lv-artist" onClick={() => { onClose(); onArtist(); }}>
              {track.artist}
            </button>
            {track.album && <p className="lv-album">{track.album}</p>}
          </div>
        </div>

        <div className="lv-right" ref={scrollRef}>
          {loading ? (
            <div className="lv-skel">
              {Array.from({ length: 10 }, (_, i) => (
                <div key={i} className="skel lv-skel-line" style={{ width: `${52 + ((i * 19) % 38)}%` }} />
              ))}
            </div>
          ) : synced.length > 0 ? (
            <div className="lv-lines">
              {synced.map((line, i) => {
                const state = i === activeIdx ? 'cur' : i < activeIdx ? 'past' : 'next';
                let content = line.text;
                if (i === activeIdx) {
                  const nextTime = synced[i + 1]?.time ?? (totalDur > line.time ? totalDur : line.time + 4);
                  const dur = Math.max(0.6, nextTime - line.time);
                  const prog = Math.max(0, Math.min(1, (yt.time + 0.25 - line.time) / dur));
                  const words = line.text.split(/\s+/).filter(Boolean);
                  const totalChars = words.reduce((s, w) => s + w.length, 0) || 1;
                  let acc = 0;
                  content = words.map((w, wi) => {
                    const start = (acc / totalChars) * 0.92;
                    acc += w.length;
                    const end = Math.max(start + 0.04, (acc / totalChars) * 0.92);
                    const wp = Math.max(0, Math.min(1, (prog - start) / (end - start)));
                    const cls = wp >= 0.98 ? 'lv-word lit' : wp > 0 ? 'lv-word now' : 'lv-word';
                    return (
                      <span key={wi}>
                        <span className={cls} style={{ '--wp': `${(wp * 100).toFixed(1)}%` }}>{w}</span>
                        {wi < words.length - 1 ? ' ' : ''}
                      </span>
                    );
                  });
                }
                return (
                  <button
                    key={`${line.time}-${i}`}
                    ref={i === activeIdx ? activeRef : null}
                    className={`lv-line ${state}`}
                    onClick={() => totalDur > 0 && yt.seek(Math.min(1, line.time / totalDur))}
                  >
                    {content}
                  </button>
                );
              })}
            </div>
          ) : plainLines.length > 0 ? (
            <div className="lv-lines plain">
              {plainLines.map((line, i) => (
                <p key={i} className={line.trim() ? 'lv-plain' : 'lv-gap'}>{line}</p>
              ))}
            </div>
          ) : (
            <div className="lv-empty">
              <p className="lv-empty-title">
                {data?.instrumental ? 'Morceau instrumental' : 'Paroles indisponibles'}
              </p>
              <p className="lv-empty-sub">
                {data?.instrumental
                  ? 'Ce titre ne contient pas de paroles.'
                  : 'Aucune transcription trouvée dans la base LRCLIB pour ce titre.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
