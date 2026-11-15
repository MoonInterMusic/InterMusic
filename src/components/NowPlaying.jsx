import { fmt } from '../api';
import { Chevron, Eq } from './Icons';

// The YouTube iframe lives here for the whole session: it must never unmount or be display:none.
export default function NowPlaying({ videoRef, directAudio, wvId, wvRef, track, open, onToggle, queue, index, onPick }) {
  return (
    <aside id="now" className={`${track ? 'on' : ''}${open ? ' open' : ''}`}>
      <div className="now-head">
        <div className="now-label">
          <Eq />
          <span>{open ? 'En lecture' : track?.name}</span>
        </div>
        <button className="now-toggle" onClick={onToggle} aria-label={open ? 'Réduire' : 'Agrandir'}>
          <Chevron dir={open ? 'down' : 'up'} size={18} />
        </button>
      </div>
      <div className="now-video" ref={videoRef}>
        {directAudio && track?.imgUrl && (
          <img className="now-cover" src={track.imgUrl} alt="" />
        )}
        {wvId && (
          <webview
            key={wvId}
            ref={wvRef}
            src={`https://www.youtube.com/watch?v=${wvId}`}
            allowpopups="false"
          />
        )}
      </div>
      {open && (
        <ol className="now-queue">
          {queue.map((t, i) => (
            <li key={t.id + i} className={i === index ? 'cur' : ''} onClick={() => onPick(i)}>
              <img src={t.imgUrl} alt="" loading="lazy" />
              <div className="q-text">
                <div className="q-name">{t.name}</div>
                <div className="q-artist">{t.artist}</div>
              </div>
              <span className="q-dur">{fmt(t.duration)}</span>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
