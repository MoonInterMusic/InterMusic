const { app, ipcMain, dialog } = require('electron');
const { execFile, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = 'MoonInterMusic/InterMusic';

function defaultInstallDir() {
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(local, 'InterMusic');
  }
  return path.join(os.homedir(), '.local', 'share', 'InterMusic');
}

function makeWinShortcut(lnkPath, targetPath) {
  const esc = s => s.replace(/'/g, "''");
  const ps = `$s=(New-Object -COM WScript.Shell).CreateShortcut('${esc(lnkPath)}');$s.TargetPath='${esc(targetPath)}';$s.WorkingDirectory='${esc(path.dirname(targetPath))}';$s.Save()`;
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], err => (err ? reject(err) : resolve()));
  });
}

function makeLinuxDesktop(desktopPath, execPath) {
  const content = `[Desktop Entry]\nType=Application\nName=InterMusic\nExec="${execPath}"\nCategories=AudioVideo;Audio;\nTerminal=false\n`;
  fs.mkdirSync(path.dirname(desktopPath), { recursive: true });
  fs.writeFileSync(desktopPath, content, { mode: 0o755 });
}

function registerSetupIpc(getWin) {
  let installedExe = null;

  ipcMain.handle('setup-info', () => ({
    defaultDir: defaultInstallDir(),
    version: app.getVersion(),
    platform: process.platform,
  }));

  ipcMain.handle('setup-pick-dir', async () => {
    const win = getWin();
    const res = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] });
    return res.canceled ? null : res.filePaths[0];
  });

  ipcMain.handle('setup-install', async (_, { dir, desktopShortcut, startShortcut }) => {
    const send = (pct, status) => {
      const w = getWin();
      if (w && !w.isDestroyed()) w.webContents.send('setup-progress', { pct, status });
    };
    try {
      send(5, 'Recherche de la dernière version…');
      const relRes = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
        headers: { 'User-Agent': 'InterMusic-Setup' },
        signal: AbortSignal.timeout(10000),
      });
      if (!relRes.ok) throw new Error('Aucune release publiée sur GitHub.');
      const rel = await relRes.json();
      const assets = rel.assets || [];
      const asset = process.platform === 'win32'
        ? assets.find(a => a.name.endsWith('.exe') && !a.name.includes('Setup')) || assets.find(a => a.name.endsWith('.exe'))
        : assets.find(a => a.name.endsWith('.AppImage') && !a.name.includes('Setup')) || assets.find(a => a.name.endsWith('.AppImage'));
      if (!asset) throw new Error('Binaire introuvable pour cette plateforme.');

      send(12, `Téléchargement de ${asset.name}…`);
      const dl = await fetch(asset.browser_download_url, {
        headers: { 'User-Agent': 'InterMusic-Setup' },
      });
      if (!dl.ok || !dl.body) throw new Error('Échec du téléchargement.');

      fs.mkdirSync(dir, { recursive: true });
      const targetName = process.platform === 'win32' ? 'InterMusic.exe' : 'InterMusic.AppImage';
      const targetPath = path.join(dir, targetName);
      const total = Number(dl.headers.get('content-length')) || asset.size || 0;
      let loaded = 0;

      const file = fs.createWriteStream(targetPath);
      const reader = dl.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        file.write(value);
        loaded += value.byteLength;
        if (total > 0) send(12 + Math.round((loaded / total) * 76), `Téléchargement… ${Math.round((loaded / total) * 100)}%`);
      }
      await new Promise((resolve, reject) => {
        file.on('finish', resolve);
        file.on('error', reject);
        file.end();
      });
      if (process.platform !== 'win32') fs.chmodSync(targetPath, 0o755);

      send(92, 'Création des raccourcis…');
      if (process.platform === 'win32') {
        if (desktopShortcut) {
          await makeWinShortcut(path.join(os.homedir(), 'Desktop', 'InterMusic.lnk'), targetPath).catch(() => {});
        }
        if (startShortcut) {
          const startDir = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Microsoft', 'Windows', 'Start Menu', 'Programs');
          fs.mkdirSync(startDir, { recursive: true });
          await makeWinShortcut(path.join(startDir, 'InterMusic.lnk'), targetPath).catch(() => {});
        }
      } else {
        if (startShortcut) makeLinuxDesktop(path.join(os.homedir(), '.local', 'share', 'applications', 'intermusic.desktop'), targetPath);
        if (desktopShortcut) makeLinuxDesktop(path.join(os.homedir(), 'Desktop', 'InterMusic.desktop'), targetPath);
      }

      installedExe = targetPath;
      send(100, 'Installation terminée');
      return { ok: true, exePath: targetPath };
    } catch (err) {
      return { ok: false, error: err?.message || 'Erreur lors de l’installation.' };
    }
  });

  ipcMain.handle('setup-launch', () => {
    if (!installedExe) return;
    spawn(installedExe, [], { detached: true, stdio: 'ignore' }).unref();
    app.quit();
  });
}

module.exports = { registerSetupIpc };
