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

export default function EqualizerModal({ onClose }) {
  const s = useSettings();
  const eq = Array.isArray(s.eq) && s.eq.length === 5 ? s.eq : [0, 0, 0, 0, 0];

  useEffect(() => {
    const esc = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const setBand = (idx, val) => {
    const next = [...eq];
    next[idx] = val;
    updateSettings({ eq: next });
  };

  return (
    <div className="modal-back" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal eq-modal" role="dialog" aria-label="Égaliseur">
        <div className="st-head">
          <h3 className="modal-title">Égaliseur</h3>
          <button className="btn ghost" onClick={onClose}>Fermer</button>
        </div>

        <div className="eq-presets">
          {PRESETS.map(p => {
            const active = p.vals.every((v, i) => v === eq[i]);
            return (
              <button
                key={p.name}
                type="button"
                className={`eq-preset${active ? ' active' : ''}`}
                onClick={() => updateSettings({ eq: p.vals })}
              >
                {p.name}
              </button>
            );
          })}
        </div>

        <div className="eq-bands">
          {BANDS.map((label, i) => {
            const val = eq[i];
            return (
              <div key={label} className="eq-band">
                <span className="eq-db">{val > 0 ? `+${val}` : val} dB</span>
                <div className="eq-slider-wrap">
                  <input
                    className="eq-slider"
                    type="range"
                    min="-12"
                    max="12"
                    step="1"
                    value={val}
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
