import { useState, useRef } from 'react';
import { getJSON, mapDzAlbum, mapDzTrack, mapDzArtist, fmt, prefetch } from '../api';

const ic = d => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);
const LINKS = [
  ['top', 'Accueil', ic(<><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></>)],
  ['albums', 'Albums', ic(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2.5" /></>)],
  ['artistes', 'Artistes', ic(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>)],
  ['morceaux', 'Morceaux', ic(<><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>)],
  ['genres', 'Genres', ic(<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>)],
  ['liste', 'Ma liste', ic(<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />)],
];

export default function Nav({ onPick, onPlayTrack, onArtist, onHome, onList, onImport, onSettings }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ tracks: [], albums: [], artists: [] });
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState('top');
  const timer = useRef(null);
  const seq = useRef(0);

  async function search(q) {
    const trimmed = q.trim();
    if (trimmed.length < 2) { setOpen(false); setSearching(false); return; }
    const id = ++seq.current;
    setSearching(true);
    setOpen(true);
    const enc = encodeURIComponent(trimmed);
    const [tr, al, ar] = await Promise.allSettled([
      getJSON(`/search/track?q=${enc}&limit=6`),
      getJSON(`/search/album?q=${enc}&limit=4`),
      getJSON(`/search/artist?q=${enc}&limit=3`),
    ]);
    if (id !== seq.current) return;
    const tracks = tr.status === 'fulfilled' ? (tr.value?.data || []).map(mapDzTrack) : [];
    const albums = al.status === 'fulfilled' ? (al.value?.data || []).map(r => mapDzAlbum(r, 'Album')) : [];
    const artists = ar.status === 'fulfilled' ? (ar.value?.data || []).map(mapDzArtist) : [];
    setResults({ tracks, albums, artists });
    setSearching(false);
    if (tracks[0]) prefetch(tracks[0]);
  }

  function handleChange(e) {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(timer.current);
    if (q.trim().length < 2) { setOpen(false); setSearching(false); return; }
    timer.current = setTimeout(() => search(q), 200);
  }

  function closeSearch() {
    setQuery('');
    setOpen(false);
  }

  // Leaves the artist profile if open, then scrolls once the home sections are rendered.
  function go(id) {
    setActive(id);
    if (id === 'liste') { onList(); window.scrollTo({ top: 0 }); return; }
    onHome();
    requestAnimationFrame(() => id === 'top'
      ? window.scrollTo({ top: 0, behavior: 'smooth' })
      : document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }));
  }

  const hasAny = results.tracks.length > 0 || results.albums.length > 0 || results.artists.length > 0;

  return (
    <>
      <nav>
        <button className="nav-logo" onClick={() => go('top')}>
          <span className="nav-dot" />
          <span>InterMusic</span>
        </button>
        <div className={`nav-search${searching ? ' busy' : ''}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="search"
            value={query}
            onChange={handleChange}
            onFocus={() => query.trim().length >= 2 && setOpen(true)}
            onKeyDown={e => e.key === 'Escape' && setOpen(false)}
            onBlur={() => setTimeout(() => setOpen(false), 180)}
            placeholder="Titre, album, artiste…"
            autoComplete="off"
          />
          {searching && <span className="search-spin" aria-hidden="true" />}
        </div>
        <div className="nav-label">Catalogue</div>
        <div className="nav-links">
          {LINKS.map(([id, label, icon]) => (
            <button key={id} className={`nav-link${active === id ? ' active' : ''}`} onClick={() => go(id)}>
              {icon}<span>{label}</span>
            </button>
          ))}
        </div>
        <button className="nav-import" onClick={onImport}>
          {ic(<><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>)}<span>Importer une playlist</span>
        </button>
        <button className="nav-import nav-settings" onClick={onSettings}>
          {ic(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.77 1 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>)}<span>Paramètres</span>
        </button>
      </nav>
      {open && (
        <div id="search-results">
          {searching && !hasAny && <div className="sr-empty">Recherche en cours…</div>}
          {!searching && !hasAny && <div className="sr-empty">Aucun résultat pour « {query.trim()} »</div>}
          {results.tracks.length > 0 && (
            <div className="sr-group">
              <div className="sr-head">Titres</div>
              {results.tracks.map((t, i) => (
                <div key={t.id} className="sr-item" onMouseEnter={() => prefetch(t)}
                  onMouseDown={() => { onPlayTrack(results.tracks, i); closeSearch(); }}>
                  <div className="sr-img"><img src={t.imgUrl} alt="" loading="lazy" /></div>
                  <div className="sr-meta">
                    <div className="sr-name">{t.name}</div>
                    <div className="sr-artist">{t.artist}</div>
                  </div>
                  <span className="sr-dur">{fmt(t.duration)}</span>
                </div>
              ))}
            </div>
          )}
          {results.albums.length > 0 && (
            <div className="sr-group">
              <div className="sr-head">Albums</div>
              {results.albums.map(a => (
                <div key={a.id} className="sr-item" onMouseDown={() => { onPick(a); closeSearch(); }}>
                  <div className="sr-img"><img src={a.imgUrl} alt="" loading="lazy" /></div>
                  <div className="sr-meta">
                    <div className="sr-name">{a.name}</div>
                    <div className="sr-artist">{a.artist}</div>
                  </div>
                  <span className="sr-tag">Album</span>
                </div>
              ))}
            </div>
          )}
          {results.artists.length > 0 && (
            <div className="sr-group">
              <div className="sr-head">Artistes</div>
              {results.artists.map(ar => (
                <div key={ar.id} className="sr-item" onMouseDown={() => { onArtist(ar); closeSearch(); }}>
                  <div className="sr-img round"><img src={ar.imgUrl} alt="" loading="lazy" /></div>
                  <div className="sr-meta">
                    <div className="sr-name">{ar.name}</div>
                    <div className="sr-artist">Artiste</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
