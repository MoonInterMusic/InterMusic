import { useEffect, useState } from 'react';
import { getJSON } from '../api';

// Adapted from React Bits AccordionGallery (https://reactbits.dev/components/accordion-gallery)
export default function GenreGrid({ genres, active, onSelect }) {
  const [hoverIdx, setHoverIdx] = useState(0);
  const [covers, setCovers] = useState({});

  useEffect(() => {
    let cancelled = false;
    getJSON('/genre')
      .then(res => {
        if (cancelled || !Array.isArray(res?.data)) return;
        const map = {};
        for (const g of res.data) {
          if (g.id && (g.picture_big || g.picture_medium)) {
            map[g.id] = g.picture_big || g.picture_medium;
          }
        }
        setCovers(map);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const idx = genres.findIndex(g => g.id === active);
    if (idx >= 0) setHoverIdx(idx);
  }, [active, genres]);

  const onKeyDown = (i, e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      setHoverIdx((i + 1) % genres.length);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      setHoverIdx((i - 1 + genres.length) % genres.length);
    }
  };

  return (
    <div className="accordion-gallery" role="list" aria-label="Galerie accordéon des genres">
      {genres.map((g, i) => {
        const isExpanded = i === hoverIdx;
        const isSelected = g.id === active;
        const tilt = isExpanded ? 0 : i < hoverIdx ? 6 : -6;
        const img = covers[g.id];
        return (
          <button
            key={g.id}
            type="button"
            role="listitem"
            className={`ag-panel${isExpanded ? ' is-active' : ''}${isSelected ? ' is-selected' : ''}`}
            style={{
              '--ag-accent': g.color,
              flexGrow: isExpanded ? 4.2 : 1,
              transform: `rotateY(${tilt}deg)`,
            }}
            onMouseEnter={() => setHoverIdx(i)}
            onFocus={() => setHoverIdx(i)}
            onClick={() => { setHoverIdx(i); onSelect(g); }}
            onKeyDown={e => onKeyDown(i, e)}
          >
            <div className="ag-panel__frame">
              <div
                className="ag-panel__media"
                style={{
                  background: `radial-gradient(circle at 30% 25%, color-mix(in srgb, ${g.color} 78%, #fff), color-mix(in srgb, ${g.color} 32%, #0a0713) 58%, #09080f 100%)`,
                }}
              >
                {img && <img src={img} alt="" loading="lazy" draggable={false} />}
              </div>
              <div className="ag-panel__overlay" />
              <div className="ag-panel__label">
                <span className="ag-panel__bar" />
                <span className="ag-panel__text">{g.name}</span>
              </div>
              <span className="ag-panel__vert" aria-hidden="true">{g.name}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
