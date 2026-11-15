import { useEffect } from 'react';
import useSettings, { updateSettings } from '../useSettings';

const ACCENTS = [
  { name: 'Vermillon', color: '#e04f33' },
  { name: 'Ambre', color: '#d97706' },
  { name: 'Sauge', color: '#16a34a' },
  { name: 'Cobalt', color: '#2563eb' },
  { name: 'Pourpre', color: '#c026d3' },
];

export default function SettingsModal({ onClose, onCleared }) {
  const s = useSettings();

  useEffect(() => {
    const esc = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  return (
    <div className="modal-back" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal settings-modal" role="dialog" aria-label="Paramètres">
        <div className="st-head">
          <h3 className="modal-title">Paramètres</h3>
          <button className="btn ghost" onClick={onClose}>Fermer</button>
        </div>

        <div className="st-row">
          <div>
            <div className="st-label">Couleur d'accent</div>
            <div className="st-sub">Personnalise l'interface</div>
          </div>
          <div className="st-swatches">
            {ACCENTS.map(a => (
              <button
                key={a.color}
                className={`st-swatch${s.accent === a.color ? ' active' : ''}`}
                style={{ background: a.color }}
                title={a.name}
                aria-label={a.name}
                onClick={() => updateSettings({ accent: a.color })}
              />
            ))}
          </div>
        </div>

        <label className="st-row st-check">
          <div>
            <div className="st-label">Mini-lecteur quand minimisé</div>
            <div className="st-sub">Affiche une barre compacte au premier plan</div>
          </div>
          <input
            type="checkbox"
            checked={s.miniPlayer}
            onChange={e => updateSettings({ miniPlayer: e.target.checked })}
          />
        </label>

        <label className="st-row st-check">
          <div>
            <div className="st-label">Son de platine au scrub</div>
            <div className="st-sub">Effet vinyle en faisant glisser la barre</div>
          </div>
          <input
            type="checkbox"
            checked={s.scrubSound}
            onChange={e => updateSettings({ scrubSound: e.target.checked })}
          />
        </label>

        <label className="st-row st-check">
          <div>
            <div className="st-label">Tremblement sur les basses</div>
            <div className="st-sub">Légère vibration de l'app synchronisée aux basses</div>
          </div>
          <input
            type="checkbox"
            checked={s.bassShake}
            onChange={e => updateSettings({ bassShake: e.target.checked })}
          />
        </label>

        <div className="st-row">
          <div>
            <div className="st-label">Puissance du tremblement</div>
            <div className="st-sub">{s.bassPower ?? 100}%</div>
          </div>
          <input
            className="st-range"
            type="range"
            min="20"
            max="250"
            step="10"
            value={s.bassPower ?? 100}
            disabled={!s.bassShake || s.reduceMotion}
            style={{ '--v': `${(((s.bassPower ?? 100) - 20) / 230) * 100}%` }}
            onChange={e => updateSettings({ bassPower: Number(e.target.value) })}
          />
        </div>

        <label className="st-row st-check">
          <div>
            <div className="st-label">Réduire les animations</div>
            <div className="st-sub">Limite les mouvements et effets visuels</div>
          </div>
          <input
            type="checkbox"
            checked={s.reduceMotion}
            onChange={e => updateSettings({ reduceMotion: e.target.checked })}
          />
        </label>

        <div className="st-row">
          <div>
            <div className="st-label">Cache YouTube</div>
            <div className="st-sub">Réinitialiser si un titre est mal associé</div>
          </div>
          <button
            className="btn ghost"
            onClick={async () => {
              await window.api?.clearYtCache?.();
              onCleared?.();
            }}
          >
            Vider le cache
          </button>
        </div>
      </div>
    </div>
  );
}
