import { useState, useEffect, useRef } from 'react';
import { importPlaylist } from '../api';
import useList from '../useList';

// Paste a Spotify or Deezer playlist/album link; the result is saved in "Ma liste".
export default function ImportModal({ onClose, onDone }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { has, toggle } = useList();
  const input = useRef(null);

  useEffect(() => {
    input.current?.focus();
    const esc = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  async function submit(e) {
    e.preventDefault();
    if (!url.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const pl = await importPlaylist(url.trim());
      if (!pl.tracks.length) throw new Error('vide');
      if (has('playlist', pl.id)) toggle('playlist', pl); // refresh an existing import
      toggle('playlist', pl);
      onDone(pl);
    } catch (err) {
      setError(/vide/.test(err.message) ? 'Cette playlist est vide.' : 'Impossible d’importer ce lien. Vérifie qu’il est public.');
      setBusy(false);
    }
  }

  return (
    <div className="modal-back" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit}>
        <h3 className="modal-title">Importer une playlist</h3>
        <p className="modal-sub">Colle le lien d’une playlist ou d’un album Spotify ou Deezer.</p>
        <input ref={input} className="modal-input" value={url} onChange={e => setUrl(e.target.value)}
          placeholder="https://open.spotify.com/playlist/…" spellCheck={false} />
        {error && <p className="modal-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn primary" disabled={busy || !url.trim()}>
            {busy ? <span className="spinner" role="status" aria-label="Chargement" /> : 'Importer'}
          </button>
        </div>
      </form>
    </div>
  );
}
