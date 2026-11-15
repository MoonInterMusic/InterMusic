import { useEffect } from 'react';
import useSettings, { updateSettings } from '../useSettings';

const BANDS = ['60 Hz', '230 Hz', '910 Hz', '3.6 kHz', '14 kHz'];
const PRESETS = [
  { name: 'Plat', vals: [0, 0, 0, 0, 0] },
  { name: 'Bass Boost', vals: [6, 4, 0, -1, 0] },
  { name: 'Phonk', vals: [8, 3, -2, 2, 4] },
  { name: 'Pop', vals: [-1, 2, 4, 2, -1] },
  { name: 'Rock', vals: [4, 2, -1, 3, 5] },
  { name: 'Vocal', vals: [-3, -1, 4, 4, 1] },
];

function curvePath(eq) {
  const xs = [20, 115, 210, 305, 400];
  const pts = eq.map((v, i) => [xs[i], 36 - (v / 12) * 26]);
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const cx = (x1 + x2) / 2;
    d += ` C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
  }
  return { line: d, area: `${d} L ${xs[4]} 68 L ${xs[0]} 68 Z`, pts };
}

export default function EqualizerModal({ onClose }) {
  const s = useSettings();
  const eq = Array.isArray(s.eq) && s.eq.length === 5 ? s.eq : [0, 0, 0, 0, 0];
  const on = s.eqEnabled !== false;
  const { line, area, pts } = curvePath(on ? eq : [0, 0, 0, 0, 0]);

  useEffect(() => {
    const esc = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const setBand = (idx, val) => {
    const next = [...eq];
    next[idx] = val;
    updateSettings({ eq: next, eqEnabled: true });
  };

  return (
    <div className="modal-back" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal eq-modal" role="dialog" aria-label="Égaliseur">
        <div className="st-head">
          <div className="eq-title-row">
            <h3 className="modal-title">Égaliseur</h3>
            <button
              type="button"
              className={`eq-power${on ? ' on' : ''}`}
              onClick={() => updateSettings({ eqEnabled: !on })}
            >
              {on ? 'Actif' : 'Désactivé'}
            </button>
          </div>
          <div className="eq-head-actions">
            <button type="button" className="btn ghost" onClick={() => updateSettings({ eq: [0, 0, 0, 0, 0], eqEnabled: true })}>
              Réinitialiser
            </button>
            <button className="btn ghost" onClick={onClose}>Fermer</button>
          </div>
        </div>

        <div className={`eq-curve${on ? '' : ' off'}`}>
          <svg viewBox="0 0 420 72" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity=".35" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <line x1="0" y1="36" x2="420" y2="36" stroke="var(--border-strong)" strokeDasharray="3 4" />
            <path d={area} fill="url(#eqFill)" />
            <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" />
            {pts.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="3.6" fill="var(--text)" stroke="var(--accent)" strokeWidth="2" />
            ))}
          </svg>
        </div>

        <div className="eq-presets">
          {PRESETS.map(p => {
            const active = on && p.vals.every((v, i) => v === eq[i]);
            return (
              <button
                key={p.name}
                type="button"
                className={`eq-preset${active ? ' active' : ''}`}
                onClick={() => updateSettings({ eq: p.vals, eqEnabled: true })}
              >
                {p.name}
              </button>
            );
          })}
        </div>

        <div className={`eq-bands${on ? '' : ' off'}`}>
          {BANDS.map((label, i) => {
            const val = eq[i];
            return (
              <div key={label} className="eq-band">
                <span className="eq-db">{val > 0 ? `+${val}` : val} dB</span>
                <div className="eq-slider-wrap">
                  <span className="eq-zero" aria-hidden="true" />
                  <input
                    className="eq-slider"
                    type="range"
                    min="-12"
                    max="12"
                    step="1"
                    value={val}
                    disabled={!on}
                    aria-label={label}
                    style={{ '--v': `${((val + 12) / 24) * 100}%` }}
                    onChange={e => setBand(i, Number(e.target.value))}
                  />
                </div>
                <span className="eq-freq">{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
