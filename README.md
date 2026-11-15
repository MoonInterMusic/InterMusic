# InterMusic

Application desktop de streaming musical construite avec **Electron**, **React** et **Vite** (métadonnées Deezer, lecture YouTube, Discord Rich Presence).

## Fonctionnalités

- **Catalogue & exploration** : top albums, artistes, morceaux, genres et recherche.
- **Lecteur complet** : file d'attente, réorganisation par glisser-déposer, mode mini-lecteur flottant à la réduction.
- **Égaliseur 5 bandes** : `60 Hz`, `230 Hz`, `910 Hz`, `3.6 kHz`, `14 kHz` avec préréglages (*Plat*, *Bass Boost*, *Phonk*, *Pop*, *Rock*, *Vocal*).
- **Paroles synchronisées** : affichage des paroles en direct pendant la lecture.
- **Ma liste & import** : gestion de titres, albums et playlists locales, import de playlists.
- **Discord Rich Presence** : affichage du morceau en cours sur Discord.
- **Mises à jour automatiques** : vérification et téléchargement automatiques via GitHub Releases (`electron-updater`).

## Développement

```bash
npm install
npm run dev      # Lance le serveur Vite
npm run app      # Build Vite + lance Electron
```

## Packaging (Linux & Windows)

```bash
npm run dist
```

Génère dans `release/` :
- Linux : `InterMusic-<version>.AppImage`
- Windows : `InterMusic Setup <version>.exe` (NSIS) et `InterMusic <version>.exe` (portable)

## Publier une mise à jour

1. Incrémenter `"version"` dans `package.json`.
2. Commiter et pousser un tag `v*` :
   ```bash
   git add package.json
   git commit -m "chore: release v1.0.1"
   git tag v1.0.1
   git push origin main --tags
   ```
Le workflow GitHub Actions (`.github/workflows/release.yml`) compile automatiquement les binaires Linux/Windows et publie la release utilisée par la mise à jour automatique.
