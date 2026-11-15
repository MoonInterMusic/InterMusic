import { useState, useRef } from 'react';
import { fmt } from '../api';
import { Play, Pause, Prev, Next, Queue, Volume, Heart, LyricsIcon, Plus, EqSliders } from './Icons';
import useList, { openPlaylistPicker } from '../useList';
import useSettings from '../useSettings';
import { playScrub } from '../scrubSound';

export default function Player({ track, yt, onPrev, onNext, hasNext, panel, onPanel, lyrics, onLyrics, eqOpen, onEq, onArtist }) {
  const [vol, setVol] = useState(80);
  const [dragRatio, setDragRatio] = useState(null);
  const { has, toggle } = useList();
  const settings = useSettings();
  const barRef = useRef(null);
  const lastSeek = useRef(0);
  const prevRatio = useRef(0);

  const liked = track && has('track', track.id);
  const totalDur = yt.duration || track?.duration || 0;
  const ytRatio = totalDur ? Math.min(1, yt.time / totalDur) : 0;
  const ratio = dragRatio !== null ? dragRatio : ytRatio;

  const ratioFromClientX = x => {
    const r = barRef.current?.getBoundingClientRect();
    if (!r || !r.width) return 0;
    return Math.max(0, Math.min(1, (x - r.left) / r.width));
  };

  function onPointerDown(e) {
    if (!track || !totalDur) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = ratioFromClientX(e.clientX);
    prevRatio.current = r;
    setDragRatio(r);
    yt.seek(r);
  }

  function onPointerMove(e) {
    if (dragRatio === null) return;
    const r = ratioFromClientX(e.clientX);
    const delta = r - prevRatio.current;
    prevRatio.current = r;
    setDragRatio(r);
    if (settings.scrubSound) playScrub(delta);
    window.dispatchEvent(new CustomEvent('intermusic-scrub', { detail: delta }));
    const now = performance.now();
    if (now - lastSeek.current > 80) {
      lastSeek.current = now;
      yt.seek(r);
    }
  }

  function onPointerUp(e) {
    if (dragRatio === null) return;
    const r = ratioFromClientX(e.clientX);
    yt.seek(r);
    setDragRatio(null);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
  }

  return (
    <div id="player" className={track ? 'on' : ''}>
      <div className="pl-track">
        <button className="pl-art" onClick={onLyrics} disabled={!track} aria-label="Afficher les paroles" title="Paroles">
          {track && <img src={track.imgUrl} alt="" />}
        </button>
        <div className="pl-text">
          {track
            ? <button className="pl-name pl-title-btn" onClick={onLyrics} title="Ouvrir les paroles">{track.name}</button>
            : <div className="pl-name">Choisis un morceau</div>}
          {track
            ? <button className="pl-artist pl-link" onClick={onArtist} title={`Voir le profil de ${track.artist}`}>{track.artist}</button>
            : <div className="pl-artist">Morceaux complets, gratuits, sans compte</div>}
        </div>
        {track && (
          <>
            <button className={`like${liked ? ' on' : ''}`} onClick={() => toggle('track', track)} aria-label="Ma liste" title="J'aime">
              <Heart on={liked} />
            </button>
            <button className="like" onClick={() => openPlaylistPicker(track)} aria-label="Ajouter à une playlist" title="Ajouter à une playlist">
              <Plus size={16} />
            </button>
          </>
        )}
      </div>

      <div className="pl-center">
        <div className="pl-ctrls">
          <button className="pl-btn" onClick={onPrev} disabled={!track} aria-label="Précédent"><Prev /></button>
          <button className={`pl-play${yt.buffering ? ' loading' : ''}`} onClick={yt.toggle} disabled={!track}
            aria-label={yt.playing ? 'Pause' : 'Lecture'}>
            {yt.playing ? <Pause size={22} /> : <Play size={22} />}
          </button>
          <button className="pl-btn" onClick={onNext} disabled={!hasNext} aria-label="Suivant"><Next /></button>
        </div>
        <div className="pl-progress">
          <span>{fmt(dragRatio !== null ? dragRatio * totalDur : yt.time)}</span>
          <div
            ref={barRef}
            className={`pl-bar${dragRatio !== null ? ' scrubbing' : ''}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div className="pl-fill" style={{ width: `${ratio * 100}%` }} />
          </div>
          <span>{fmt(totalDur)}</span>
        </div>
      </div>

      <div className="pl-right">
        <label className="pl-vol">
          <Volume size={18} />
          <input type="range" min="0" max="100" value={vol} aria-label="Volume"
            style={{ '--v': `${vol}%` }}
            onChange={e => { setVol(+e.target.value); yt.setVolume(+e.target.value); }} />
        </label>
        <button className={`pl-btn${eqOpen || (settings.eqEnabled !== false && (settings.eq || []).some(v => v !== 0)) ? ' active' : ''}`} onClick={onEq} aria-label="Égaliseur" title="Égaliseur">
          <EqSliders size={18} />
        </button>
        <button className={`pl-btn${lyrics ? ' active' : ''}`} onClick={onLyrics} disabled={!track} aria-label="Paroles" title="Paroles">
          <LyricsIcon size={18} />
        </button>
        <button className={`pl-btn${panel ? ' active' : ''}`} onClick={onPanel} aria-label="File d'attente" title="File d'attente"><Queue /></button>
      </div>
    </div>
  );
}
