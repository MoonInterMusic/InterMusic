import { useState, useEffect } from 'react';
import { getJSON, mapDzTrack, mapDzAlbum, mapDzArtist } from '../api';
import { Play } from './Icons';
import TrackList from './TrackList';
import Carousel from './Carousel';
import Artists from './Artists';

const fans = n => new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(n || 0);

export default function ArtistProfile({ artist, onClose, onPlay, onAlbum, onArtist, currentId, playing }) {
  const [info, setInfo] = useState(null);
  const [top, setTop] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [related, setRelated] = useState([]);

  useEffect(() => {
    setInfo(null); setTop([]); setAlbums([]); setRelated([]);
    window.scrollTo({ top: 0, behavior: 'instant' });
    const id = artist.id;
    getJSON(`/artist/${id}`).then(setInfo).catch(() => {});
    getJSON(`/artist/${id}/top?limit=10`).then(d => setTop((d?.data || []).map(mapDzTrack))).catch(() => {});
    getJSON(`/artist/${id}/albums?limit=30`).then(d => setAlbums((d?.data || [])
      .map(r => ({ ...mapDzAlbum(r), artist: r.release_date?.slice(0, 4) || '' })))).catch(() => {});
    getJSON(`/artist/${id}/related?limit=12`).then(d => setRelated((d?.data || []).map(mapDzArtist))).catch(() => {});
  }, [artist.id]);

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);

  const img = info?.picture_xl || artist.imgUrl;

  return (
    <div className="ap">
      <header className="ap-hero">
        {img && <div className="ap-bg" style={{ backgroundImage: `url('${img}')` }} />}
        <div className="ap-head">
          <button className="ap-back" onClick={onClose}>← Retour</button>
          <div className="ap-id">
            <div className="ap-img">{img && <img src={img} alt="" />}</div>
            <div className="ap-info">
              <span className="section-kicker">Artiste</span>
              <h1 className="ap-name">{info?.name || artist.name}</h1>
              {info && <p className="ap-meta">{fans(info.nb_fan)} fans · {info.nb_album} albums</p>}
              <button className="hero-btn" onClick={() => onPlay(top, 0)} disabled={!top.length}>
                <Play size={18} /> Écouter
              </button>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section className="section">
          <h2 className="section-title">Titres populaires</h2>
          <TrackList tracks={top} currentId={currentId} playing={playing}
            onPick={i => onPlay(top, i)} loading={!top.length} />
        </section>
        {albums.length > 0 && (
          <section className="section">
            <h2 className="section-title">Albums</h2>
            <Carousel items={albums} onPick={onAlbum} />
          </section>
        )}
        {related.length > 0 && (
          <section className="section">
            <h2 className="section-title">Artistes similaires</h2>
            <Artists items={related} onPick={onArtist} />
          </section>
        )}
      </main>
    </div>
  );
}
