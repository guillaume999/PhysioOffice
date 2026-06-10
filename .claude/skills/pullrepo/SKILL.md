---
name: pullrepo
description: >-
  Récupère (git pull) les derniers changements du repo distant sur la branche
  courante, en mettant automatiquement de côté (stash) les modifications locales
  non committées puis en les réappliquant après le pull. Utilise ce skill dès que
  l'utilisateur veut « pull », « récupérer les changements », « mettre à jour
  depuis le repo / GitHub », « sync depuis le remote », « update mon code », ou
  toute demande de rapatrier le code distant — même s'il ne dit pas explicitement
  « git pull ».
---

# Pull depuis le repo distant

Met à jour la copie locale avec les derniers commits du remote sur la **branche
courante**, sans jamais faire perdre les modifications locales en cours.

Le piège classique d'un `git pull` est qu'il échoue (ou écrase du travail) quand
il y a des modifications non committées. Pour éviter ça, ce skill les met de côté
avec `git stash` avant le pull, puis les réapplique avec `git stash pop`. Ainsi
l'utilisateur récupère toujours le distant tout en gardant son travail en cours.

## Étapes

Exécute ces commandes dans cet ordre. Adapte-toi au résultat de chaque étape
plutôt que de tout enchaîner aveuglément.

1. **Repérer la branche et l'état local.**
   ```bash
   git rev-parse --abbrev-ref HEAD
   git status --short
   ```
   Retiens s'il y a des modifications locales (sortie non vide de `git status --short`).

2. **Mettre de côté les modifs locales, seulement s'il y en a.**
   ```bash
   git stash push -u -m "pull-skill auto-stash"
   ```
   Le flag `-u` inclut aussi les fichiers non suivis. Si le dépôt est propre,
   saute cette étape (ne crée pas de stash vide).

3. **Récupérer le distant.**
   ```bash
   git fetch origin
   git pull --ff-only
   ```
   `--ff-only` garde un historique propre : si le pull ne peut pas se faire en
   simple avance rapide (les deux côtés ont divergé), il s'arrête au lieu de
   créer un merge surprise. Dans ce cas, explique la situation à l'utilisateur et
   propose-lui soit `git pull --no-ff` (créer un commit de merge), soit
   `git pull --rebase` (rejouer ses commits par-dessus), sans choisir à sa place.

4. **Réappliquer les modifs mises de côté, si l'étape 2 a créé un stash.**
   ```bash
   git stash pop
   ```
   - Si le `pop` réussit sans conflit : parfait, le travail local est de retour.
   - S'il y a un conflit (le pull a touché les mêmes lignes), **n'écrase rien** :
     le stash reste intact dans `git stash list`. Indique précisément à
     l'utilisateur quels fichiers sont en conflit et qu'il doit les résoudre, le
     stash étant conservé tant qu'il n'a pas fait `git stash drop`.

## Compte rendu

À la fin, dis clairement à l'utilisateur ce qui s'est passé, par exemple :
- la branche mise à jour et le nombre de commits récupérés (`git log --oneline`
  de l'ancien HEAD à HEAD, ou « déjà à jour »),
- si des modifs locales ont été mises de côté puis réappliquées,
- tout conflit restant à résoudre.

Reste concis : un résumé en quelques lignes suffit.
