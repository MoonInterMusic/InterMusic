const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  deezer: p => ipcRenderer.invoke('deezer', p),
  ytSearch: q => ipcRenderer.invoke('yt', q),
  ytAudio: id => ipcRenderer.invoke('yt-audio', id),
  importPlaylist: u => ipcRenderer.invoke('playlist', u),
  lyrics: payload => ipcRenderer.invoke('lyrics', payload),
  discordRpc: payload => ipcRenderer.invoke('discord-rpc', payload),
  setSettings: s => ipcRenderer.invoke('set-settings', s),
  clearYtCache: () => ipcRenderer.invoke('clear-yt-cache'),
  sendMiniState: state => ipcRenderer.send('mini-state', state),
  sendMiniAction: action => ipcRenderer.send('mini-action', action),
  winAction: action => ipcRenderer.send('win-action', action),
  onWinMax: cb => {
    const fn = (_, m) => cb(m);
    ipcRenderer.on('win-max', fn);
    return () => ipcRenderer.removeListener('win-max', fn);
  },
  onMiniState: cb => {
    const fn = (_, s) => cb(s);
    ipcRenderer.on('mini-state', fn);
    return () => ipcRenderer.removeListener('mini-state', fn);
  },
  onMiniAction: cb => {
    const fn = (_, a) => cb(a);
    ipcRenderer.on('mini-action', fn);
    return () => ipcRenderer.removeListener('mini-action', fn);
  },
  setupInfo: () => ipcRenderer.invoke('setup-info'),
  setupPickDir: () => ipcRenderer.invoke('setup-pick-dir'),
  setupInstall: opts => ipcRenderer.invoke('setup-install', opts),
  setupLaunch: () => ipcRenderer.invoke('setup-launch'),
  onSetupProgress: cb => {
    const fn = (_, p) => cb(p);
    ipcRenderer.on('setup-progress', fn);
    return () => ipcRenderer.removeListener('setup-progress', fn);
  },
});
