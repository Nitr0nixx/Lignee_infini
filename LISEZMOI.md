# Lignée Infinie : appli web installable

Ce dossier contient le jeu prêt à être mis en ligne et installé sur un téléphone comme une appli : icône sur l'écran d'accueil, plein écran, fonctionne hors connexion.

## Contenu

- `index.html` : le jeu
- `manifest.webmanifest` : le nom, l'icône et les couleurs de l'appli
- `sw.js` : le script qui garde le jeu en mémoire pour le mode hors connexion
- `icons/` : les icônes (192, 512, version adaptative Android, version iPhone)

## 1. Mettre le jeu en ligne gratuitement (GitHub Pages)

Le mode appli ne fonctionne qu'en ligne, sur une adresse en `https://`. Ouvrir `index.html` directement depuis tes fichiers lance le jeu, mais sans installation possible.

1. Crée un compte gratuit sur github.com.
2. Clique sur **New repository**, nomme-le par exemple `lignee-infinie`, coche **Public**, puis **Create repository**.
3. Clique sur **uploading an existing file** et glisse **tout le contenu** de ce dossier, y compris le dossier `icons`. Valide avec **Commit changes**.
4. Va dans **Settings**, puis **Pages**. Dans **Source**, choisis **Deploy from a branch**, puis la branche **main** et le dossier **/ (root)**, et clique sur **Save**.
5. Attends une à deux minutes. Ton jeu est alors disponible à l'adresse `https://TON-PSEUDO.github.io/lignee-infinie/`.

Autre possibilité : Netlify (app.netlify.com/drop). Tu glisses le dossier et tu obtiens une adresse en quelques secondes. Il faut créer un compte pour que le site reste en ligne.

## 2. Installer l'appli sur ton téléphone

- **Android (Chrome)** : ouvre l'adresse du jeu, puis menu ⋮ et **Installer l'application** (ou **Ajouter à l'écran d'accueil**). Le menu ☰ du jeu propose aussi un bouton **Installer** quand c'est possible.
- **iPhone (Safari)** : ouvre l'adresse du jeu, touche le bouton **Partager**, puis **Sur l'écran d'accueil**.

Ouvre le jeu une première fois avec une connexion Internet : il se met en mémoire, polices comprises. Ensuite, il fonctionne hors connexion.

## 3. Récupérer ta partie actuelle

L'appli a sa propre sauvegarde, séparée de la version sur claude.ai.

1. Dans la version claude.ai du jeu, ouvre le menu ☰ et touche **Copier le code**.
2. Dans l'appli, ouvre le menu ☰, colle le code dans **Charger une sauvegarde**, puis touche deux fois **Charger ce code**.

## 4. Mettre à jour l'appli plus tard

1. Remplace `index.html` (et les autres fichiers modifiés) dans ton dépôt GitHub.
2. Dans `sw.js`, change la ligne `const VERSION = 'lignee-v1';` en `'lignee-v2'` (puis v3, etc.).
3. Les joueurs reçoivent la nouvelle version à la prochaine ouverture avec connexion.

## Différences avec la version claude.ai

- Le **classement entre amis** et le **Titan commun** utilisent les données partagées de claude.ai. Ils sont masqués dans l'appli. Le Titan du samedi reste jouable en solo.
- Tout le reste est identique.

## Tester sur ton ordinateur

Dans ce dossier, lance `python3 -m http.server 8000`, puis ouvre `http://localhost:8000` dans ton navigateur.
