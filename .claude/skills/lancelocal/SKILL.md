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

> **Important — éviter les redemandes d'autorisation.** Les commandes ci-dessous
> sont déjà pré-autorisées dans `.claude/settings.local.json`. Utilise-les
> **mot pour mot** (mêmes commandes, mêmes outils) pour qu'aucune autorisation ne
> soit redemandée. N'invente pas de variantes (autre formulation du test
> `node_modules`, autre boucle d'attente, etc.).

1. **Vérifier si un serveur tourne déjà.**
   Cherche un port de dev en écoute. Ce projet est configuré sur le **port 8080**
   (voir `vite.config.ts`) ; on teste aussi les ports Vite par défaut (5173+) au
   cas où la config changerait. Lance cette commande **PowerShell exacte** :
   ```powershell
   Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in 8080,5173,5174,5175,4173 } | Select-Object LocalPort,OwningProcess | Sort-Object LocalPort -Unique
   ```
   - Si un port répond déjà : **ne relance pas**. Indique à l'utilisateur que le
     serveur tourne déjà et donne-lui l'URL (`http://localhost:<port>`).
   - Sinon, continue.

2. **Installer les dépendances seulement si nécessaire.**
   Vérifie la présence de `node_modules` avec cette commande **Bash exacte** :
   ```bash
   test -d node_modules && echo "node_modules: OK" || echo "node_modules: MANQUANT"
   ```
   - Si « MANQUANT » : lance `npm install` d'abord.
   - Sinon, saute l'installation.

3. **Lancer le serveur de dev en arrière-plan.**
   Utilise l'outil Bash avec `run_in_background: true` (commande `npm run dev`,
   couverte par la règle `Bash(npm run *)`). Le serveur reste actif sans bloquer
   la conversation. Note l'**ID du process** et le **chemin du fichier de sortie**
   renvoyés par l'outil.

4. **Confirmer le démarrage.**
   **Ne fabrique pas** de boucle d'attente `grep`/`until` (elle repart elle-même
   en arrière-plan et redemande une autorisation). À la place, **lis directement**
   le fichier de sortie du process avec l'outil **Read** (le dossier de sortie
   `…/tasks/**` est déjà pré-autorisé en lecture). Si la ligne
   « Local: http://localhost:… » n'apparaît pas encore, relis le fichier après un
   court instant. Récupère l'URL réelle (le port peut différer si 8080 était
   occupé).

## Compte rendu

Dis clairement à l'utilisateur :
- que le serveur est lancé (ou qu'il tournait déjà),
- l'URL locale exacte (`http://localhost:<port>`),
- comment l'arrêter si besoin (fermer le process en arrière-plan).

Reste concis.
