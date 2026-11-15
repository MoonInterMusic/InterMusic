import { useEffect, useState } from 'react';
import { Play, Pause, Prev, Next, Heart } from './Icons';

export default function MiniPlayer() {
  const [state, setState] = useState({ track: null, playing: false, liked: false });

  useEffect(() => {
    document.documentElement.classList.add('mini-mode');
    return window.api?.onMiniState?.(s => setState(s || { track: null, playing: false, liked: false }));
  }, []);

  const act = a => window.api?.sendMiniAction?.(a);
  const { track, playing, liked } = state;

  return (
    <div className="mini-pill">
      <button className="mini-info" onClick={() => act('restore')} title="Agrandir InterMusic">
        <div className="mini-art">
          {track?.imgUrl && <img src={track.imgUrl} alt="" />}
        </div>
        <div className="mini-text">
          <div className="mini-name">{track?.name || 'InterMusic'}</div>
          <div className="mini-artist">{track?.artist || 'En pause'}</div>
        </div>
      </button>

      <div className="mini-ctrls">
        <button className={`mini-like${liked ? ' on' : ''}`} onClick={() => act('like')} aria-label="Ma liste">
          <Heart on={liked} size={15} />
        </button>
        <button className="mini-btn" onClick={() => act('prev')} aria-label="Précédent">
          <Prev size={15} />
        </button>
        <button className="mini-play" onClick={() => act('toggle')} aria-label={playing ? 'Pause' : 'Lecture'}>
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button className="mini-btn" onClick={() => act('next')} aria-label="Suivant">
          <Next size={15} />
        </button>
      </div>
    </div>
  );
}
