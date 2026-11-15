import { useState, useRef, useEffect } from 'react';
import { fmt, prefetch } from '../api';
import { Play, Eq, Heart, Plus, Trash } from './Icons';
import useList, { openPlaylistPicker } from '../useList';

export default function TrackList({ tracks, currentId, playing, onPick, onReorder, onRemove, loading }) {
  const { has, toggle } = useList();
  const [drag, setDrag] = useState(null); // { idx, over, x, y, ox, oy, w, tilt }
  const listRef = useRef(null);
  const holdRef = useRef(null);

  useEffect(() => {
    if (!onReorder) return;
    const onMove = e => {
      const h = holdRef.current;
      if (!h) return;
      const dx = e.clientX - h.startX;
      const dy = e.clientY - h.startY;
      if (!h.active && Math.hypot(dx, dy) < 6) return;
      h.active = true;
      const vx = e.clientX - h.lastX;
      h.lastX = e.clientX;
      const tilt = Math.max(-10, Math.min(10, vx * 0.65));

      let over = h.over;
      const lis = listRef.current?.querySelectorAll('li[data-idx]');
      if (lis) {
        for (const li of lis) {
          const r = li.getBoundingClientRect();
          if (e.clientY >= r.top && e.clientY <= r.bottom && e.clientX >= r.left && e.clientX <= r.right) {
            over = Number(li.dataset.idx);
            break;
          }
        }
      }
      h.over = over;
      setDrag({ idx: h.idx, over, x: e.clientX - h.ox, y: e.clientY - h.oy, w: h.w, tilt });
    };

    const onUp = () => {
      const h = holdRef.current;
      holdRef.current = null;
      if (h?.active && h.over !== h.idx) onReorder(h.idx, h.over);
      if (h?.active) {
        // Suppress the trailing click after a drag
        const stopClick = ev => ev.stopPropagation();
        window.addEventListener('click', stopClick, { capture: true, once: true });
        setTimeout(() => window.removeEventListener('click', stopClick, { capture: true }), 50);
      }
      setDrag(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [onReorder]);

  if (loading) return (
    <div className="tracks">
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className="track">
          <span className="skel skel-num" />
          <div className="skel track-cover" />
          <div className="track-info">
            <div className="skel skel-line" style={{ width: '65%' }} />
            <div className="skel skel-line" style={{ width: '40%' }} />
          </div>
        </div>
      ))}
    </div>
  );

  const draggedTrack = drag ? tracks[drag.idx] : null;

  return (
    <>
      <ol ref={listRef} className={`tracks${onReorder ? ' reorderable' : ''}${onRemove ? ' removable' : ''}${drag ? ' is-dragging' : ''}`}>
        {tracks.map((t, i) => {
          const cur = t.id === currentId;
          const isSource = drag?.idx === i;
          const isOver = drag && drag.over === i && drag.idx !== i;
          return (
            <li
              key={t.id + '-' + i}
              data-idx={i}
              className={`${isSource ? 'drag-slot' : ''}${isOver ? ' drop-over' : ''}`}
              onPointerDown={onReorder ? e => {
                if (e.button !== 0 || e.target.closest('.like, .track-add, .track-trash')) return;
                const r = e.currentTarget.getBoundingClientRect();
                holdRef.current = {
                  idx: i, over: i, active: false,
                  startX: e.clientX, startY: e.clientY, lastX: e.clientX,
                  ox: e.clientX - r.left, oy: e.clientY - r.top, w: r.width,
                };
              } : undefined}
            >
              <button className={`track${cur ? ' cur' : ''}${cur && playing ? ' playing' : ''}`} onClick={() => onPick(i)}
                onMouseEnter={() => prefetch(t)}>
                <span className="track-num">
                  {cur ? <Eq /> : <><span className="n">{i + 1}</span><span className="p"><Play size={16} /></span></>}
                </span>
                <div className="track-cover"><img src={t.imgUrl} alt="" loading="lazy" /></div>
                <div className="track-info">
                  <span className="track-name">{t.name}</span>
                  <span className="track-artist">{t.artist}</span>
                </div>
                <span className="track-dur">{fmt(t.duration)}</span>
              </button>
              {onRemove && (
                <button className="track-trash" onClick={() => onRemove(i)} aria-label="Retirer de la playlist" title="Retirer de la playlist">
                  <Trash size={15} />
                </button>
              )}
              <button className="track-add" onClick={() => openPlaylistPicker(t)} aria-label="Ajouter à une playlist" title="Ajouter à une playlist / J'aime">
                <Plus size={15} />
              </button>
              <button className={`like${has('track', t.id) ? ' on' : ''}`} onClick={() => toggle('track', t)} aria-label="Ma liste">
                <Heart on={has('track', t.id)} size={16} />
              </button>
            </li>
          );
        })}
      </ol>
      {drag && draggedTrack && (
        <div
          className="drag-ghost"
          style={{
            width: drag.w,
            transform: `translate3d(${drag.x}px, ${drag.y}px, 0) rotate(${drag.tilt}deg)`,
          }}
        >
          <div className="track">
            <span className="track-num">{drag.idx + 1}</span>
            <div className="track-cover"><img src={draggedTrack.imgUrl} alt="" /></div>
            <div className="track-info">
              <span className="track-name">{draggedTrack.name}</span>
              <span className="track-artist">{draggedTrack.artist}</span>
            </div>
            <span className="track-dur">{fmt(draggedTrack.duration)}</span>
          </div>
        </div>
      )}
    </>
  );
}
