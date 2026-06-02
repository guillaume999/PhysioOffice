#!/bin/bash
# git-sync.sh — vérifie si le repo local diffère du remote et push sur main

set -e

REPO_DIR="C:/Users/guill/Documents/GitHub/PhysioOffice"
cd "$REPO_DIR"

echo "📁 Répertoire : $REPO_DIR"

# Fetch silencieux pour avoir l'état du remote
git fetch origin

# Vérifier s'il y a des modifications non committées
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "⚠️  Modifications locales non committées détectées."
  git status --short
  read -rp "Message de commit : " COMMIT_MSG
  if [ -z "$COMMIT_MSG" ]; then
    COMMIT_MSG="chore: mise à jour automatique"
  fi
  git add -A
  git commit -m "$COMMIT_MSG"
fi

# Vérifier si local est en avance sur le remote
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "✅ Déjà à jour avec origin/main. Rien à pousser."
  exit 0
fi

# Vérifier s'il y a des commits à pousser
AHEAD=$(git rev-list origin/main..HEAD --count)
if [ "$AHEAD" -gt 0 ]; then
  echo "🚀 $AHEAD commit(s) à pousser vers origin/main..."
  git push origin main
  echo "✅ Push effectué."
else
  echo "ℹ️  Le remote a des commits que vous n'avez pas. Pensez à faire un git pull."
fi
