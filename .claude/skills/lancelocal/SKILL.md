---
name: lancelocal
description: >-
  Lance le serveur de développement local du projet PhysioOffice (Vite, via
  `npm run dev`), après avoir vérifié qu'il ne tourne pas déjà. Utilise ce skill
  dès que l'utilisateur veut « lancer le local », « démarrer le serveur »,
  « lancer le dev », « démarrer l'appli en local », « npm run dev », « start le
  front », ou toute demande de mettre en route le serveur de développement —
  même s'il ne dit pas explicitement la commande.
---

# Lancer le serveur local

Démarre le serveur de développement **Vite** de PhysioOffice (`npm run dev`) de
façon idempotente : si un serveur tourne déjà, on ne le relance pas, on indique
juste son URL.

## Étapes

Adapte-toi au résultat de chaque étape plutôt que d'enchaîner aveuglément.

1. **Vérifier si un serveur tourne déjà.**
   Cherche un processus `node.exe` du projet et un port de dev en écoute.
   Ce projet est configuré sur le **port 8080** (voir `vite.config.ts`) ; on
   teste aussi les ports Vite par défaut (5173+) au cas où la config changerait.
   ```powershell
   Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
     Where-Object { $_.LocalPort -in 8080,5173,5174,5175,4173 } |
     Select-Object LocalPort,OwningProcess | Sort-Object LocalPort -Unique
   ```
   - Si un port répond déjà : **ne relance pas**. Indique à l'utilisateur que le
     serveur tourne déjà et donne-lui l'URL (`http://localhost:<port>`).
   - Sinon, continue.

2. **Installer les dépendances seulement si nécessaire.**
   Si le dossier `node_modules` est absent, lance `npm install` d'abord.
   Sinon, saute cette étape.

3. **Lancer le serveur de dev en arrière-plan.**
   Utilise l'outil Bash avec `run_in_background: true` pour que le serveur reste
   actif sans bloquer la conversation.
   ```bash
   npm run dev
   ```

4. **Confirmer le démarrage.**
   Attends que Vite affiche sa ligne « Local: http://localhost:... » dans la
   sortie du process en arrière-plan, puis récupère l'URL réelle (le port peut
   différer de 5173 s'il était occupé).

## Compte rendu

Dis clairement à l'utilisateur :
- que le serveur est lancé (ou qu'il tournait déjà),
- l'URL locale exacte (`http://localhost:<port>`),
- comment l'arrêter si besoin (fermer le process en arrière-plan).

Reste concis.
