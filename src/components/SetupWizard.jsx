import { useEffect, useState } from 'react';

export default function SetupWizard() {
  const [dir, setDir] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [desktopShortcut, setDesktopShortcut] = useState(true);
  const [startShortcut, setStartShortcut] = useState(true);
  const [phase, setPhase] = useState('ready'); // ready | installing | done | error
  const [pct, setPct] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    document.documentElement.classList.add('setup-mode');
    window.api?.setupInfo?.().then(info => {
      if (info?.defaultDir) setDir(info.defaultDir);
      if (info?.version) setVersion(info.version);
    });
    return window.api?.onSetupProgress?.(p => {
      if (typeof p?.pct === 'number') setPct(p.pct);
      if (p?.status) setStatus(p.status);
    });
  }, []);

  const pickDir = async () => {
    const picked = await window.api?.setupPickDir?.();
    if (picked) setDir(picked);
  };

  const startInstall = async () => {
    setPhase('installing');
    setError('');
    setPct(0);
    const res = await window.api?.setupInstall?.({ dir, desktopShortcut, startShortcut });
    if (res?.ok) setPhase('done');
    else {
      setError(res?.error || 'Erreur inconnue.');
      setPhase('error');
    }
  };

  return (
    <div className="setup-shell">
      <div className="setup-bar">
        <div className="setup-brand">
          <span className="setup-dot" />
          <span>InterMusic Setup</span>
          <span className="setup-ver">v{version}</span>
        </div>
        <button className="setup-close" onClick={() => window.api?.winAction?.('close')} aria-label="Fermer">✕</button>
      </div>

      <div className="setup-body">
        <div className="setup-hero">
          <h1>Installer <em>InterMusic</em></h1>
          <p>Lecteur de musique desktop — catalogue Deezer, lecture YouTube et paroles synchronisées.</p>
        </div>

        <div className="setup-card">
          <label className="setup-label">Dossier d’installation</label>
          <div className="setup-path-row">
            <input
              className="setup-input"
              value={dir}
              onChange={e => setDir(e.target.value)}
              disabled={phase === 'installing' || phase === 'done'}
            />
            <button
              type="button"
              className="btn ghost"
              onClick={pickDir}
              disabled={phase === 'installing' || phase === 'done'}
            >
              Parcourir
            </button>
          </div>

          <div className="setup-checks">
            <label className="setup-check">
              <input
                type="checkbox"
                checked={desktopShortcut}
                onChange={e => setDesktopShortcut(e.target.checked)}
                disabled={phase === 'installing' || phase === 'done'}
              />
              <span>Raccourci sur le Bureau</span>
            </label>
            <label className="setup-check">
              <input
                type="checkbox"
                checked={startShortcut}
                onChange={e => setStartShortcut(e.target.checked)}
                disabled={phase === 'installing' || phase === 'done'}
              />
              <span>Raccourci dans le menu d’applications</span>
            </label>
          </div>
        </div>

        {(phase === 'installing' || phase === 'done') && (
          <div className="setup-progress">
            <div className="setup-progress-head">
              <span>{status}</span>
              <span>{pct}%</span>
            </div>
            <div className="setup-track">
              <div className="setup-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        {phase === 'error' && <p className="setup-error">{error}</p>}

        <div className="setup-actions">
          {phase === 'done' ? (
            <button type="button" className="btn primary" onClick={() => window.api?.setupLaunch?.()}>
              Lancer InterMusic
            </button>
          ) : (
            <button
              type="button"
              className="btn primary"
              onClick={startInstall}
              disabled={!dir || phase === 'installing'}
            >
              {phase === 'installing' ? 'Installation…' : 'Installer'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
