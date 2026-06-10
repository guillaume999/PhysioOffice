# Support image OU vidéo dans les exercices

## Modifications du schéma PocketBase

À effectuer manuellement dans l'admin PocketBase (https://pocketbase-dev.physiooffice.com/_/) :

### Collection `exercices`
Ajouter les champs :
- `media_type` (text, optional) — valeurs : `"video"` ou `"image"` (null = video pour rétrocompat)
- `image_url` (text/url, optional) — URL publique de l'image stockée dans `exercice_images`

### Collection `videos` (médiathèque)
Ajouter les mêmes champs :
- `media_type` (text, optional)
- `image_url` (text/url, optional)

### Nouvelle collection `exercice_images`
Créer la collection avec les mêmes règles d'accès que `exercice_videos` :
- `user` (relation → users, required)
- `file` (file, required, max 5 MB) — accept : `image/jpeg`, `image/png`, `image/webp`, `image/gif`
- `name` (text, optional)

Règles API (mêmes que `exercice_videos`) :
- List/View : `@request.auth.id != "" && (user = @request.auth.id || @collection.exercices.image_url ?~ id)`
- Create : `@request.auth.id != ""`
- Update/Delete : `user = @request.auth.id`

## Logique applicative

- `media_type === "video"` → utiliser `video_url` + `thumbnail_url` (comportement actuel)
- `media_type === "image"` → utiliser `image_url` (pas de thumbnail séparée, l'image elle-même sert)
- `media_type` absent/null → traité comme `"video"` (rétrocompatibilité)
