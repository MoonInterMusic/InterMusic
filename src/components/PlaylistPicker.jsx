import { useEffect, useState } from 'react';
import useList from '../useList';
import { Heart, Close } from './Icons';

export default function PlaylistPicker({ onToast }) {
  const [track, setTrack] = useState(null);
  const [name, setName] = useState('');
  const { items, has, toggle, createPlaylist, toggleInPlaylist } = useList();

  useEffect(() => {
    const onOpen = e => { setTrack(e.detail || null); setName(''); };
    window.addEventListener('intermusic-pick-playlist', onOpen);
    return () => window.removeEventListener('intermusic-pick-playlist', onOpen);
  }, []);

  useEffect(() => {
    if (!track) return;
    const esc = e => e.key === 'Escape' && setTrack(null);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [track]);

  if (!track) return null;

  const liked = has('track', track.id);

  function handleCreate(e) {
    e.preventDefault();
    const pl = createPlaylist(name, track);
    if (!pl) return;
    setName('');
    onToast?.(`Ajouté à « ${pl.name} »`);
  }

  return (
    <div className="modal-back" onMouseDown={e => e.target === e.currentTarget && setTrack(null)}>
      <div className="modal pp-modal" role="dialog" aria-label="Ajouter à une playlist">
        <div className="st-head">
          <h3 className="modal-title">Ajouter à...</h3>
          <button className="btn ghost" onClick={() => setTrack(null)} aria-label="Fermer"><Close size={16} /></button>
        </div>

        <div className="pp-track">
          {track.imgUrl && <img src={track.imgUrl} alt="" />}
          <div className="pp-track-info">
            <div className="pp-track-name">{track.name}</div>
            <div className="pp-track-artist">{track.artist}</div>
          </div>
        </div>

        <div className="pp-list">
          <button
            type="button"
            className={`pp-item${liked ? ' on' : ''}`}
            onClick={() => {
              toggle('track', track);
              onToast?.(liked ? 'Retiré des J\'aime' : 'Ajouté aux J\'aime');
            }}
          >
            <span className="pp-ico"><Heart on={liked} size={16} /></span>
            <span className="pp-name">J'aime (Titres aimés)</span>
            <span className="pp-state">{liked ? 'Ajouté ✓' : 'Ajouter'}</span>
          </button>

          {items.playlist.map(pl => {
            const inPl = pl.tracks.some(t => t.id === track.id);
            return (
              <button
                key={pl.id}
                type="button"
                className={`pp-item${inPl ? ' on' : ''}`}
                onClick={() => {
                  const added = toggleInPlaylist(pl.id, track);
                  onToast?.(added ? `Ajouté à « ${pl.name} »` : `Retiré de « ${pl.name} »`);
                }}
              >
                <span className="pp-cover">
                  {pl.imgUrl ? <img src={pl.imgUrl} alt="" /> : <span>♪</span>}
                </span>
                <span className="pp-meta">
                  <span className="pp-name">{pl.name}</span>
                  <span className="pp-count">{pl.tracks.length} titre{pl.tracks.length > 1 ? 's' : ''}</span>
                </span>
                <span className="pp-state">{inPl ? 'Ajouté ✓' : 'Ajouter'}</span>
              </button>
            );
          })}
        </div>

        <form className="st-inline" onSubmit={handleCreate}>
          <input
            className="modal-input"
            type="text"
            placeholder="Nouvelle playlist..."
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <button className="btn primary" type="submit" disabled={!name.trim()}>Créer</button>
        </form>
      </div>
    </div>
  );
}
