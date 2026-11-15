// Lightweight Web Audio turntable scrub sound when dragging the progress bar.
let ctx = null;
let lastPlay = 0;

export function playScrub(deltaRatio) {
  const now = performance.now();
  if (now - lastPlay < 45 || Math.abs(deltaRatio) < 0.002) return;
  lastPlay = now;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume();

    const speed = Math.min(1, Math.abs(deltaRatio) * 35);
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const base = deltaRatio >= 0 ? 220 : 160;
    osc.frequency.setValueAtTime(base + speed * 280, t);
    osc.frequency.exponentialRampToValueAtTime(base + speed * 90, t + 0.045);

    gain.gain.setValueAtTime(0.055 * (0.4 + speed * 0.6), t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.052);
  } catch {}
}
