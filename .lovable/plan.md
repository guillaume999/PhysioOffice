
# Migration Supabase → PocketBase

**Ampleur** : 46 fichiers utilisent le client Supabase, ~30 tables, 4 edge functions. Migration lourde mais faisable en une passe.

## 1. Setup (fondations)

- `npm remove @supabase/supabase-js` + `npm install pocketbase`
- Créer `src/integrations/pocketbase/client.ts` :
  - Instance `PocketBase(import.meta.env.VITE_PB_URL ?? "http://localhost:8090")`
  - Persistance auth dans `localStorage` (auto via `pb.authStore`)
  - Export `pb` + helper `getFileUrl(record, field)`
- Ajouter `VITE_PB_URL` dans `.env` (note : `.env` est protégé, je créerai `.env.local` ou demanderai à l'utilisateur)
- Garder `src/integrations/supabase/client.ts` et `types.ts` intacts (auto-générés) mais ne plus les importer

## 2. Couche auth (`src/lib/auth.tsx`)

Remplacer entièrement par PocketBase :
- `pb.collection("users").authWithPassword(email, password)` pour signin
- `pb.collection("users").create({ email, password, passwordConfirm, pseudo, ... })` puis `requestVerification` pour signup
- `pb.authStore.onChange()` au lieu de `onAuthStateChange`
- `user` = `pb.authStore.model`, `session` = `{ token: pb.authStore.token }`
- `signOut` = `pb.authStore.clear()`

## 3. Helper de compatibilité (`src/integrations/pocketbase/compat.ts`)

Pour éviter de réécrire 46 fichiers à la main, créer un **wrapper minimal** qui imite l'API supabase :

```ts
export const supabase = {
  from: (collection) => new QueryBuilder(collection),
  auth: { getUser, getSession, ... },
  functions: { invoke: () => stub },
  storage: { from: () => stub },
};
```

Le QueryBuilder traduit :
- `.select("col1, col2")` → `fields: "col1,col2"`
- `.eq("col", val)` → `filter: 'col = "val"'`
- `.in("col", [...])` → `filter: 'col = "a" || col = "b"'`
- `.order("col", {ascending})` → `sort: "+col"` / `"-col"`
- `.insert/update/delete` → `pb.collection(x).create/update/delete`
- `.maybeSingle()` / `.single()` → `getFirstListItem`

Cela garde les 46 fichiers fonctionnels sans réécriture, avec des limites assumées (pas de joins automatiques — à gérer cas par cas).

## 4. Rééécritures spécifiques nécessaires

Les usages **non-couvrables** par le wrapper, à réécrire manuellement :
- **Edge functions** (`ai-chat`, `check-subscription`, `create-checkout`, `customer-portal`) :
  - `IADiagnostic.tsx`, `useSubscription.ts` → mettre en mode désactivé (toast "fonctionnalité indisponible en self-hosted") OU rediriger vers hooks PB que tu devras écrire côté serveur
- **Storage** (upload vidéos exercices, avatars, photos annuaire) → `pb.collection("videos").create(FormData)` + `pb.files.getUrl(...)`
- **Realtime** (s'il y en a) → `pb.collection(x).subscribe("*", cb)`
- **Joins implicites** (`.select("*, relation(*)")`) → utiliser `expand` de PB et adapter le code consommateur
- **RPC functions** Supabase (`generate_unique_code`, `has_shared_access`, etc.) → soit hook PB, soit logique client

## 5. Stratégie d'exécution

Vu l'ampleur (46 fichiers, plusieurs jours de travail sérieux si on fait tout proprement), je propose de procéder **par vagues** dans **plusieurs messages** :

**Vague 1 (ce message)** : Setup PocketBase + auth + wrapper de compatibilité + .env. À la fin, l'app compile et tu peux te connecter.

**Vague 2** : Pages simples (Patients, Notes, Pathologies, Objectifs) — vérifier que le wrapper marche en conditions réelles.

**Vague 3** : Exercices, Séances, Traitements + storage vidéos.

**Vague 4** : Planning, Sharing, Admin, Certificats, Annonces, Annuaire.

**Vague 5** : Désactivation propre des features sans edge function (IA, Stripe, abonnements).

Tu testes après chaque vague et tu me dis ce qui casse. Sinon en une seule passe ce sera plusieurs centaines de modifications dans un seul message et impossible à débugger.

## Confirmation demandée

1. OK pour la stratégie wrapper de compat (pragmatique, garde le code lisible) plutôt que tout réécrire en pur PocketBase (puriste, plusieurs jours) ?
2. OK pour découper en 5 vagues, ou tu veux que je tente tout en une fois quitte à avoir beaucoup de bugs à corriger ensuite ?
3. Les edge functions (IA chat, Stripe checkout) : on les désactive proprement (toast "non disponible") ou tu écris des hooks PocketBase côté serveur en parallèle ?
