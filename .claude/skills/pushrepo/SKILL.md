---
name: pushrepo
description: >-
  Pousse (git push) les changements locaux vers le repo distant sur la branche
  courante : commite d'abord les modifications non committées avec un message
  clair, puis push. Vérifie que le distant n'a pas pris de l'avance avant de
  pousser. Utilise ce skill dès que l'utilisateur veut « push », « pousser »,
  « envoyer mon code », « sauvegarder sur GitHub », « commit + push », « publier
  mes changements », ou toute demande d'envoyer le travail local vers le remote —
  même s'il ne dit pas explicitement « git push ».
---

# Push vers le repo distant

Envoie le travail local vers le remote sur la **branche courante**, en
committant d'abord ce qui ne l'est pas et en évitant d'écraser le distant.

Le but est que rien ne reste « coincé » en local : on commite les modifications
en cours avec un message qui décrit vraiment le changement, on vérifie que le
distant n'a pas avancé entre-temps, puis on pousse.

## Étapes

Exécute ces commandes dans cet ordre, en t'adaptant au résultat de chaque étape.

1. **Repérer la branche et l'état local.**
   ```bash
   git rev-parse --abbrev-ref HEAD
   git status --short
   git fetch origin
   ```

2. **Committer les modifs locales, s'il y en a.**
   S'il y a des changements non committés (`git status --short` non vide) :
   - Regarde le diff pour comprendre ce qui a changé :
     ```bash
     git diff
     git diff --cached
     ```
   - Stage tout et propose un **message de commit clair** qui décrit le
     changement (en français, style court et concret, ex. `fix: corrige le
     calcul de la date du bilan initial`). Préfère un message parlant à un
     générique du type « mise à jour ».
     ```bash
     git add -A
     git commit -m "<message proposé>"
     ```
   Si le dépôt est déjà propre, saute cette étape.

3. **Vérifier que le distant n'a pas pris de l'avance.**
   ```bash
   git rev-list --left-right --count origin/<branche>...HEAD
   ```
   - Si le distant a des commits que tu n'as pas (côté gauche > 0), **ne force
     pas**. Préviens l'utilisateur qu'il faut d'abord récupérer ces commits
     (le skill `pull`), puis re-pousser. Ne fais jamais de `git push --force`
     sans demande explicite.
   - Sinon, continue.

4. **Pousser.**
   ```bash
   git push origin <branche>
   ```
   Si la branche locale n'a pas d'upstream configuré, utilise
   `git push -u origin <branche>` pour l'associer au remote.

## Compte rendu

À la fin, indique clairement à l'utilisateur :
- ce qui a été committé (message + fichiers concernés) le cas échéant,
- le nombre de commits poussés et la branche cible, ou « déjà à jour, rien à
  pousser »,
- s'il faut d'abord faire un `pull` parce que le distant a avancé.

Reste concis : un résumé en quelques lignes suffit.
