import { useState, useEffect } from 'react';
import { Play } from './Icons';

export default function Hero({ items, onPick, spinning }) {
  const [cur, setCur] = useState(0);

  useEffect(() => {
    if (!items.length) return;
    setCur(0);
    const t = setInterval(() => setCur(c => (c + 1) % items.length), 7000);
    return () => clearInterval(t);
  }, [items]);

  if (!items.length) return <section id="hero" className="hero-empty"><div className="skel hero-skel" /></section>;

  return (
    <section id="hero">
      {items.map((item, i) => (
        <div key={item.id} className={`hero-slide${i === cur ? ' active' : ''}`} aria-hidden={i !== cur}>
          <div className="hero-bg" style={{ backgroundImage: `url('${item.imgUrl}')` }} />
          <div className="hero-content">
            <div className={`hero-art${spinning ? ' spin' : ''}`}>
              <div className="vinyl" />
              <img src={item.imgUrl} alt={item.name} loading={i === 0 ? 'eager' : 'lazy'} />
            </div>
            <div className="hero-info">
              <span className="hero-eyebrow">N°{i + 1} · {item.type || 'Album'}{item.year ? ` · ${item.year}` : ''}</span>
              <h1 className="hero-title">{item.name}</h1>
              <div className="hero-artist">{item.artist}</div>
              <button className="hero-btn" onClick={() => onPick(item)} tabIndex={i === cur ? 0 : -1}>
                <Play size={18} /> Écouter l'album
              </button>
            </div>
          </div>
        </div>
      ))}
      <div className="hero-dots">
        {items.map((_, i) => (
          <button key={i} className={`hero-dot${i === cur ? ' active' : ''}`} onClick={() => setCur(i)}
            aria-label={`Slide ${i + 1}`} />
        ))}
      </div>
    </section>
  );
}
