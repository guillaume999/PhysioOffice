# Plan — Traitements propres au patient (instances indépendantes)

> Doc de cadrage. Objectif : permettre de créer un traitement pour un patient
> (vierge ou à partir d'un modèle) **totalement indépendant du modèle**, avec
> séances/exercices/tests modifiables sans toucher aux modèles d'origine.

## 1. État des lieux (ce que j'ai trouvé en base)

Il existe **deux modèles parallèles** dans PocketBase :

### Modèle "vivant" (utilisé par l'app aujourd'hui)
- `exercices` — bibliothèque d'exercices réelle (title, video_url, thumbnail_url…)
- `seance_types` → `seance_exercices` (`.exercice → exercices`)
- `traitement_types` → `traitement_seances` (`→ seance_types`) + `traitement_tests`
- `patient_care_plans.active_traitement → traitement_types`
- `patient_bilans.traitement → traitement_types`
- `patient_traitement_seance_dates.traitement → traitement_types`

➡️ Aujourd'hui, « créer un traitement pour un patient » crée en fait un
`traitement_types` (un **modèle**) et le rattache au care plan. C'est la cause
du comportement que tu signalais comme incorrect.

### Modèle "instance" (présent en base, jamais branché dans le code)
- `patient_traitements` (`source → traitement_types`, + nom, pathologie, statut, dates, notes)
- `patient_seances` (`source → seance_types`, + nom, objectif, date_prevue, date_realisee, statut, notes)
- `patient_seance_exercices` (`source → exercice_types` ⚠️, + nom, series, repetitions, duree, repos, realise, notes)
- `patient_traitement_tests` *(créée par moi ce jour, calquée sur la précédente)*

### ⚠️ Incohérence à corriger
`exercice_types` (0 enregistrement, référencé nulle part) ≠ `exercices` (la vraie
bibliothèque). Les tables d'instance pointent leur `source` vers `exercice_types`,
donc elles ne se raccordent pas aux vrais exercices.

**Décision proposée :** repointer `source` des tables d'instance vers `exercices` :
- `patient_seance_exercices.source` : `exercice_types` → `exercices`
- `patient_traitement_tests.source` : `exercice_types` → `exercices`
- (on ignore/abandonne `exercice_types`)

## 2. Modèle cible

```
patient_traitements            (instance, source? -> traitement_types)
 ├─ patient_traitement_tests   (instance, source? -> exercices)
 └─ patient_seances            (instance, source? -> seance_types)
     └─ patient_seance_exercices (instance, source? -> exercices)
```

Règles :
- `source` = simple provenance (optionnelle). Une instance ne dépend jamais du modèle.
- Création **vierge** : on crée les lignes sans `source`.
- Création **depuis un modèle** : on **copie** tous les champs du modèle dans
  l'instance et on remplit `source` (traçabilité). Modifier l'instance ne touche
  jamais le modèle.
- Dates de séance : sur `patient_seances.date_prevue` / `date_realisee`
  (plus besoin de la table `patient_traitement_seance_dates` pour les instances).
- Statuts : `patient_traitements.statut` (actif/terminé/suspendu),
  `patient_seances.statut` (planifiée/réalisée/annulée).
- Exos réalisés : `patient_seance_exercices.realise` (bool).
- Bilans : `patient_bilans.traitement` rattaché à `patient_traitements` (au lieu du modèle).
- Le patient (code d'accès) lit **son instance**, pas le modèle.

## 3. Changements de schéma PocketBase
1. `patient_seance_exercices.source` → relation vers `exercices`.
2. `patient_traitement_tests.source` → relation vers `exercices`.
3. `patient_bilans` : ajouter/repointer une relation vers `patient_traitements`
   (à décider : nouveau champ `patient_traitement` vs réutiliser `traitement`).
4. (optionnel) marquer `patient_care_plans.active_traitement` comme déprécié.

## 4. Plan d'implémentation par phases

### Phase 1 — Création (le cœur, débloque le bug)
- `TraitementFormDialog` : prop `patientId`. Si présente → mode instance :
  - crée `patient_traitements` (patient, praticien=user, statut=actif, date_debut=auj., source=null)
  - chaque test choisi → `patient_traitement_tests` (copie)
  - chaque séance choisie → `patient_seances` (copie) + ses exos → `patient_seance_exercices` (copie)
- `PatientTraitementActif` + `PatientDetail` : lister les `patient_traitements` du patient
  (`filter: patient = X && statut = actif`), abandon de `care_plan.active_traitement`.

### Phase 2 — Affichage (lecture)
- `PatientTraitementCard` : `fetchTraitementDetails` lit l'instance
  (`patient_traitements` + `patient_traitement_tests` + `patient_seances` + `patient_seance_exercices`).

### Phase 3 — Édition sur l'instance
- Reprise des handlers de la carte (ajout/édition/suppression de séance, ajout/édition
  d'exercice, réordonnancement, commentaires, dates, statut, réalisé) pour écrire dans
  les tables d'instance.
- Sous-dialogues à adapter : `SeanceFormDialog`, `AddExerciceToSeanceDialog`,
  `ExerciceItemCard`, `DatePickerInline`.
- « Ajouter une séance vierge ou depuis un modèle » / idem exercices et tests.

### Phase 4 — Bilans & accès patient
- `patient_bilans` rattachés à l'instance.
- Lecture côté patient (code d'accès) sur l'instance.

### Phase 5 — Vérification
- Tests API + parcours UI complet + build.

## ÉTAT D'AVANCEMENT (mis à jour)

- ✅ **Phase 1** — Création (vierge / depuis modèle) + liste, sur `patient_traitements`.
  Fichiers : `TraitementFormDialog` (prop `patientId`), `lib/patientTraitement.ts`
  (`instantiateTraitementForPatient`), `PatientTraitementInstanceCard`, `PatientTraitementActif`.
  Vérifié end-to-end via API (création + cascade delete).
- ✅ **Phase 2+3** — Affichage **et édition** de l'instance dans `PatientTraitementInstanceCard` :
  statut du traitement ; par séance : date prévue, statut, ajout (vierge), suppression ;
  par exercice : réalisé, séries/répétitions/durée éditables, nom, ajout (vierge), suppression ;
  tests : ajout/suppression. Mutations vérifiées via API (200/204).
- 🟡 **Phase 4** — *Schéma prêt* : champ `patient_bilans.patient_traitement → patient_traitements`
  ajouté. **Reste à câbler** : page `PatientBilanIntermediaire` (écrire/lire via l'instance),
  affichage des bilans dans la carte, et accès patient (`PatientSessionView` /
  `GenerateAccessCodeDialog`) qui lisent encore les modèles.

### Reste à faire (prochains incréments)
- Ajout de séance/exercice **depuis un modèle** à une instance existante (actuellement : ajout vierge).
- Phase 4 complète (bilans + accès patient sur l'instance).
- `QuickAppointmentsDialog` : interroge encore `traitement_seances` par modèle → adapter aux `patient_seances`.
- Page `PatientDetail` : encore sur l'ancien modèle `traitement_types`.
- `npm run build` à lancer en local (non vérifiable dans le sandbox).

## 5. Points à valider avant de coder
1. OK pour repointer `source` (instances) vers `exercices` et abandonner `exercice_types` ?
2. Bilans : nouveau champ `patient_traitement` sur `patient_bilans`, ou repointer `traitement` ?
3. On démarre par la Phase 1 (création + liste) pour avoir un flux qui marche vite,
   puis on enchaîne ?
