import { useRef } from 'react';
import { Play, Chevron, Heart } from './Icons';
import useList from '../useList';

export default function Carousel({ items, onPick, loading, kind = 'album' }) {
  const ref = useRef(null);
  const { has, toggle } = useList();
  const scroll = dir => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: 'smooth' });

  return (
    <div className="carousel-wrap">
      <button className="car-btn prev" onClick={() => scroll(-1)} aria-label="Précédent"><Chevron dir="left" /></button>
      <div className="carousel" ref={ref}>
        {loading ? Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="card">
            <div className="skel card-cover" />
            <div className="skel skel-line" style={{ width: '75%' }} />
            <div className="skel skel-line" style={{ width: '50%' }} />
          </div>
        )) : items.map(item => (
          <div key={item.id} className="card-wrap">
            <button className="card" onClick={() => onPick(item)}>
              <div className="card-cover">
                <img src={item.imgUrl} alt="" loading="lazy" />
                <span className="card-play"><Play size={20} /></span>
              </div>
              <span className="card-name">{item.name}</span>
              <span className="card-artist">{item.artist}</span>
            </button>
            {kind && (
              <button className={`like${has(kind, item.id) ? ' on' : ''}`} onClick={() => toggle(kind, item)} aria-label="Ma liste">
                <Heart on={has(kind, item.id)} size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
      <button className="car-btn next" onClick={() => scroll(1)} aria-label="Suivant"><Chevron /></button>
    </div>
  );
}
