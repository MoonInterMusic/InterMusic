import { useState, useEffect, useRef, useCallback } from 'react';
import { getJSON, trackIds, prefetch, mapDzAlbum, mapDzTrack, mapDzArtist, GENRES } from './api';
import useYouTube from './useYouTube';
import useList from './useList';
import Nav from './components/Nav';
import Hero from './components/Hero';
import Carousel from './components/Carousel';
import Artists from './components/Artists';
import TrackList from './components/TrackList';
import GenreGrid from './components/GenreGrid';
import Player from './components/Player';
import NowPlaying from './components/NowPlaying';
import LyricsView from './components/LyricsView';
import ArtistProfile from './components/ArtistProfile';
import ImportModal from './components/ImportModal';
import SettingsModal from './components/SettingsModal';
import PlaylistPicker from './components/PlaylistPicker';
import EqualizerModal from './components/EqualizerModal';
import { Play } from './components/Icons';

function Section({ id, title, kicker, children }) {
  return (
    <section className="section" id={id}>
      <header className="section-head">
        {kicker && <span className="section-kicker">{kicker}</span>}
        <h2 className="section-title">{title}</h2>
      </header>
      {children}
    </section>
  );
}

export default function App() {
  const [albums, setAlbums] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [artists, setArtists] = useState([]);
  const [genre, setGenre] = useState(null);
  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(-1);
  const [panel, setPanel] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [profile, setProfile] = useState(null);
  const [view, setView] = useState('home');
  const [importing, setImporting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [eqOpen, setEqOpen] = useState(false);
  const [openPlId, setOpenPlId] = useState(null);
  const { items: liked, has, toggle, reorderTracks, reorderPlaylist, removeFromPlaylist } = useList();
  const openPl = openPlId ? liked.playlist.find(p => p.id === openPlId) || null : null;
  const toastTimer = useRef(null);
  const videoRef = useRef(null);
  const reqId = useRef(0);
  const nav = useRef({});

  const showToast = useCallback(msg => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  }, []);

  const yt = useYouTube(videoRef, {
    onEnded: () => nav.current.next(),
    onFail: () => { showToast('Introuvable sur YouTube, morceau suivant'); nav.current.next(); },
  });

  const playAt = useCallback(async (list, i) => {
    const t = list[i];
    if (!t) return;
    const id = ++reqId.current;
    setQueue(list);
    setIndex(i);
    prefetch(list[i + 1], list[i + 2]);
    try {
      const ids = await trackIds(t);
      if (id !== reqId.current) return;
      if (ids.length) return yt.load(ids);
    } catch {}
    if (id !== reqId.current) return;
    showToast(`Introuvable : ${t.name}`);
    playAt(list, i + 1);
  }, [yt.load, showToast]);

  nav.current = {
    next: () => index + 1 < queue.length && playAt(queue, index + 1),
    prev: () => (yt.time > 3 || index <= 0 ? yt.seek(0) : playAt(queue, index - 1)),
  };

  async function playTracks(path, override) {
    try {
      const data = await getJSON(path);
      const list = (data?.data || []).map(r => ({ ...mapDzTrack(r), ...override }));
      if (list.length) return playAt(list, 0);
    } catch {}
    showToast('Impossible de charger les morceaux');
  }

  const playAlbum = a => playTracks(`/album/${a.id}/tracks?limit=50`, { imgUrl: a.imgUrl, album: a.name });
  const openArtist = a => setProfile({ id: a.id, name: a.name, imgUrl: a.imgUrl });
  const closeArtist = useCallback(() => setProfile(null), []);

  async function loadGenre(g) {
    setGenre({ ...g, items: [] });
    requestAnimationFrame(() => document.getElementById('genre')?.scrollIntoView({ behavior: 'smooth' }));
    try {
      const data = await getJSON(`/chart/${g.id}/albums?limit=25`);
      setGenre({ ...g, items: (data?.data || []).map(r => mapDzAlbum(r, g.name)) });
    } catch {
      showToast('Erreur de chargement');
    }
  }

  useEffect(() => {
    Promise.allSettled([
      getJSON('/chart/0/albums?limit=25'),
      getJSON('/chart/0/tracks?limit=30'),
      getJSON('/chart/0/artists?limit=20'),
    ]).then(([a, t, ar]) => {
      if (a.status === 'fulfilled') setAlbums((a.value?.data || []).map(r => mapDzAlbum(r, 'Top album')));
      if (t.status === 'fulfilled') setTracks((t.value?.data || []).map(mapDzTrack));
      if (ar.status === 'fulfilled') setArtists((ar.value?.data || []).map(mapDzArtist));
    });
  }, []);

  const current = queue[index] || null;
  const currentLiked = current ? has('track', current.id) : false;

  useEffect(() => {
    const t = setTimeout(() => {
      window.api?.discordRpc?.({
        track: current,
        playing: yt.playing,
        time: yt.time,
        duration: yt.duration || current?.duration || 0,
      }).catch(() => {});
    }, yt.playing ? 350 : 600);
    return () => clearTimeout(t);
  }, [current?.id, yt.playing, yt.duration]);

  useEffect(() => {
    window.api?.sendMiniState?.({ track: current, playing: yt.playing, liked: currentLiked });
  }, [current?.id, yt.playing, currentLiked]);

  const [winMax, setWinMax] = useState(false);
  const hasTb = !!window.api?.winAction;

  useEffect(() => {
    document.documentElement.classList.toggle('has-tb', hasTb);
    return window.api?.onWinMax?.(setWinMax);
  }, [hasTb]);

  useEffect(() => {
    return window.api?.onMiniAction?.(action => {
      if (action === 'toggle') yt.toggle();
      else if (action === 'prev') nav.current.prev();
      else if (action === 'next') nav.current.next();
      else if (action === 'like' && current) toggle('track', current);
    });
  }, [yt.toggle, current, toggle]);

  return (
    <>
      {hasTb && (
        <header className="tb" onDoubleClick={() => window.api.winAction('max')}>
          <div className="tb-brand">
            <span className="tb-dot" />
            <span>InterMusic</span>
          </div>
          <div className="tb-now">
            {current ? `${current.name} — ${current.artist}` : ''}
          </div>
          <div className="tb-ctrls">
            <button type="button" className="tb-btn" onClick={() => window.api.winAction('min')} aria-label="Réduire" title="Réduire">
              <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
            </button>
            <button type="button" className="tb-btn" onClick={() => window.api.winAction('max')} aria-label={winMax ? 'Restaurer' : 'Agrandir'} title={winMax ? 'Restaurer' : 'Agrandir'}>
              {winMax
                ? <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="3.5" y="1.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.3" /><path d="M1.5 4.5v5a1 1 0 0 0 1 1h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
                : <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="2" y="2" width="8" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.3" /></svg>}
            </button>
            <button type="button" className="tb-btn tb-close" onClick={() => window.api.winAction('close')} aria-label="Fermer" title="Fermer">
              <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
            </button>
          </div>
        </header>
      )}
      <div className="ambient" style={current ? { backgroundImage: `url('${current.imgUrl}')` } : undefined} />
      <Nav onPick={a => { setProfile(null); setView('home'); playAlbum(a); }}
        onPlayTrack={(list, i) => { setProfile(null); playAt(list, i); }}
        onArtist={ar => { setView('home'); openArtist(ar); }}
        onHome={() => { setProfile(null); setView('home'); }}
        onList={() => { setProfile(null); setOpenPlId(null); setView('liste'); }}
        onImport={() => setImporting(true)}
        onSettings={() => setSettingsOpen(true)} />
      {profile ? (
        <ArtistProfile artist={profile} onClose={closeArtist} onPlay={playAt} onAlbum={playAlbum}
          onArtist={openArtist} currentId={current?.id} playing={yt.playing} />
      ) : view === 'liste' && openPl ? (
      <main key={openPl.id} className="view">
        <header className="pl-head">
          <img className="pl-cover" src={openPl.imgUrl} alt="" />
          <div className="pl-meta">
            <span className="section-kicker">Playlist {openPl.source}</span>
            <h1 className="pl-title">{openPl.name}</h1>
            <span className="pl-count">{openPl.tracks.length} titres</span>
            <div className="pl-actions">
              <button className="btn primary" onClick={() => playAt(openPl.tracks, 0)}><Play size={16} /> Écouter</button>
              <button className="btn ghost" onClick={() => setOpenPlId(null)}>Retour</button>
              <button className="btn ghost danger" onClick={() => { toggle('playlist', openPl); setOpenPlId(null); showToast('Playlist supprimée'); }}>Supprimer</button>
            </div>
          </div>
        </header>
        <TrackList tracks={openPl.tracks} currentId={current?.id} playing={yt.playing}
          onPick={i => playAt(openPl.tracks, i)}
          onReorder={(from, to) => reorderPlaylist(openPl.id, from, to)}
          onRemove={i => { removeFromPlaylist(openPl.id, i); showToast('Titre retiré de la playlist'); }} />
      </main>
      ) : view === 'liste' ? (
      <main className="view">
        <Section id="liste" kicker="Sauvegardé sur cet appareil" title="Ma liste">
          <button className="btn primary import-btn" onClick={() => setImporting(true)}>+ Importer une playlist</button>
          {liked.playlist.length > 0 && <>
            <h3 className="sub-title">Playlists</h3>
            <Carousel kind={null} onPick={pl => setOpenPlId(pl.id)}
              items={liked.playlist.map(p => ({ ...p, artist: `${p.source} · ${p.tracks.length} titres` }))} />
          </>}
          {liked.album.length > 0 && <><h3 className="sub-title">Albums</h3><Carousel items={liked.album} onPick={playAlbum} /></>}
          {liked.track.length > 0 && <><h3 className="sub-title">Titres</h3>
            <TrackList tracks={liked.track} currentId={current?.id} playing={yt.playing}
              onPick={i => playAt(liked.track, i)}
              onReorder={reorderTracks} /></>}
          {!liked.album.length && !liked.track.length && !liked.playlist.length &&
            <p className="empty">Clique sur ♥ pour ajouter des titres ou des albums, ou importe une playlist.</p>}
        </Section>
      </main>
      ) : (<>
      <Hero items={albums.slice(0, 7)} onPick={playAlbum} spinning={yt.playing} />
      <main className="view">
        <Section id="albums" kicker="Cette semaine" title="Top albums">
          <Carousel items={albums} onPick={playAlbum} loading={!albums.length} />
        </Section>
        <Section id="artistes" kicker="En ce moment" title="Artistes du moment">
          <Artists items={artists} onPick={openArtist} loading={!artists.length} />
        </Section>
        <Section id="morceaux" kicker="Classement" title="Top morceaux">
          <TrackList tracks={tracks} currentId={current?.id} playing={yt.playing}
            onPick={i => playAt(tracks, i)} loading={!tracks.length} />
        </Section>
        <Section id="genres" kicker="Explorer" title="Genres">
          <GenreGrid genres={GENRES} active={genre?.id} onSelect={loadGenre} />
        </Section>
        {genre && (
          <Section id="genre" kicker="Genre" title={genre.name}>
            <Carousel items={genre.items} onPick={playAlbum} loading={!genre.items.length} />
          </Section>
        )}
      </main>
      </>)}
      <footer className="footer" />

      <LyricsView open={lyricsOpen} track={current} yt={yt} onClose={() => setLyricsOpen(false)}
        onArtist={() => current?.artistId && openArtist({ id: current.artistId, name: current.artist })} />
      <NowPlaying videoRef={videoRef} directAudio={yt.directAudio} wvId={yt.wvId} wvRef={yt.wvRef} track={current} open={panel} onToggle={() => setPanel(p => !p)}
        queue={queue} index={index} onPick={i => playAt(queue, i)} />
      <Player track={current} yt={yt} onPrev={() => nav.current.prev()} onNext={() => nav.current.next()}
        hasNext={index + 1 < queue.length} panel={panel} onPanel={() => setPanel(p => !p)}
        lyrics={lyricsOpen} onLyrics={() => setLyricsOpen(l => !l)}
        eqOpen={eqOpen} onEq={() => setEqOpen(e => !e)}
        onArtist={() => current?.artistId && openArtist({ id: current.artistId, name: current.artist })} />
      {importing && <ImportModal onClose={() => setImporting(false)} onDone={pl => {
        setImporting(false); setProfile(null); setView('liste'); setOpenPlId(pl.id);
        showToast(`${pl.tracks.length} titres importés`);
      }} />}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} onCleared={() => showToast('Cache YouTube vidé')} />}
      {eqOpen && <EqualizerModal onClose={() => setEqOpen(false)} />}
      <PlaylistPicker onToast={showToast} />
      <div id="toast" className={toast ? 'show' : ''}>{toast}</div>
    </>
  );
}
