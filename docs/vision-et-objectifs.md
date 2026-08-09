# Vision & objectifs — PhysioOffice

> Doc de cadrage stratégique. Rédigé le 2026-08-09.
> Objectif : fixer ce que le produit cherche à devenir, pourquoi l'état actuel ne
> suffit pas à se différencier, et dans quel ordre construire.

---

## 1. Positionnement actuel

PhysioOffice est aujourd'hui un SaaS de gestion de cabinet de kinésithérapie :

- **Dossier patient** — patients, notes, bilans initiaux/intermédiaires, certificats, objectifs
- **Contenu** — bibliothèque d'exercices (vidéo/image), séances types, traitements types, pathologies
- **Organisation** — planning, journal d'activité, corbeille, partage de ressources entre praticiens
- **Portail patient** — consultation d'une séance via un code d'accès temporaire
- **IA** — chat « IA Diagnostic » (analyse de symptômes)
- **Communauté** — annuaire des kinés, annonces d'emploi/remplacement, formations, actualités
- **Monétisation** — abonnement Stripe, paliers Gratuit / Pro / Cabinet

## 2. Diagnostic : le produit n'est pas différenciant

Chaque brique existe déjà chez des acteurs mieux financés.

| Brique | Concurrence établie |
|---|---|
| Prescription d'exercices + portail patient | Physitrack/PhysiApp, Physiotec, Rehab My Patient, Exorlive |
| Gestion de cabinet FR (dossiers, planning, facturation) | Kobus, Vega, Doctolib/Maiia |
| Chat IA sur symptômes | commodité depuis 2023, tout le monde en a un |
| Annuaire / annonces / formations | sans valeur en dessous d'une masse critique |

### Trois faiblesses structurelles observées dans le code

1. **Le bilan ne produit aucune donnée exploitable.**
   `src/pages/PatientBilanInitial.tsx` comporte ~50 champs, tous en texte libre
   (`placeholder="Ex: 6/10, douleur au mouvement…"`). On collecte de la prose.
   Impossible d'en tirer une courbe, une comparaison ou un indicateur.

2. **La boucle patient est à sens unique.**
   `src/pages/PatientSessionView.tsx` + `GenerateAccessCodeDialog.tsx` : le patient
   *consulte* sa séance via un code qui expire. Rien ne remonte — ni observance,
   ni douleur, ni « fait / pas fait ».

3. **L'IA est mal placée et juridiquement exposée.**
   `src/pages/IADiagnostic.tsx` est un chat générique streamé, sans dossier patient
   dans le contexte ni base de connaissances. Le positionnement « aide au diagnostic »
   peut faire basculer la fonctionnalité en dispositif médical (classe IIa) et la
   soumettre à l'AI Act. Beaucoup de risque pour peu de valeur perçue.

**Conséquence sur le modèle économique :** le pricing facture au *nombre d'exercices*
(3 / 15 / illimité). C'est une métrique de stockage, pas de valeur. Rien ne pousse
un utilisateur à monter en gamme avec le temps.

---

## 3. Vision cible

> Passer d'un **logiciel où le kiné saisit** à un **système qui mesure si le
> traitement fonctionne**.

C'est le seul axe qui crée simultanément :
- un **actif défendable** (des données de résultat que personne d'autre n'accumule),
- un **prix qui peut croître** (la valeur suit l'usage clinique, pas le stockage),
- un **effet de réseau réel** (chaque praticien enrichit la preuve pour les autres).

---

## 4. Objectifs stratégiques

### O1 — Rendre les données cliniques structurées et comparables
Remplacer le texte libre par des échelles validées, afin que chaque bilan produise
des mesures et non des paragraphes.

### O2 — Fermer la boucle avec le patient
Le portail patient doit **remonter** de l'information, pas seulement en afficher.
L'observance aux exercices à domicile plafonne à 30-50 % dans la littérature :
un logiciel qui la fait bouger a un argument commercial chiffrable.

### O3 — Repositionner l'IA sur la charge administrative
La douleur réelle du praticien n'est pas le diagnostic — c'est le temps de saisie
et de rédaction. L'IA doit écrire, pas conclure.

### O4 — Transformer la bibliothèque partagée en moteur de preuve
Une fois O1 + O2 en place, les protocoles portent leurs propres résultats agrégés.
La bibliothèque cesse d'être un dossier de fichiers.

---

## 5. Chantiers, dans l'ordre

### Chantier 1 — Structurer le bilan `[O1]`
*Faible risque technique, débloque tout le reste.*

- Remplacer les champs libres par des mesures typées : EVA/NPRS, goniométrie chiffrée,
  testing musculaire MRC 0-5.
- Intégrer les PROMs validés par région : EIFEL / Québec (lombalgie), QuickDASH (épaule),
  KOOS / Lysholm (genou), PSFS (objectifs fonctionnels du patient).
- Conserver un champ libre *en complément*, jamais en remplacement.

**Débloque immédiatement :** courbes d'évolution, comparaison bilan initial ↔ intermédiaire,
et **génération automatique du compte-rendu au médecin prescripteur (BDK)** — la corvée
n°1 du praticien.

**Critère de réussite :** un bilan initial + un bilan intermédiaire produisent un
graphe d'évolution sans aucune saisie supplémentaire.

### Chantier 2 — Fermer la boucle patient `[O2]`
*Le vrai différenciateur.*

- Faire évoluer le code d'accès temporaire vers un compte patient léger et persistant.
- Le patient déclare : exercice fait / pas fait, douleur avant-après, difficulté ressentie.
- Le praticien voit avant la séance : « observance 62 %, douleur en hausse depuis 4 jours ».

**Critère de réussite :** l'écran patient du kiné affiche un indicateur d'observance
et une tendance de douleur calculés, pas saisis.

### Chantier 3 — Le scribe, pas le chatbot `[O3]`

- Retirer / renommer « IA Diagnostic ».
- Le remplacer par une **dictée qui remplit le bilan** : le praticien parle ~90 secondes
  en fin de séance, l'IA structure les champs et rédige le compte-rendu.
- Même technologie, valeur perçue bien supérieure, exposition réglementaire nulle
  (on transcrit le raisonnement du praticien, on n'en produit pas).

**Critère de réussite :** un bilan complet rempli à partir d'un enregistrement vocal,
relu et corrigé par le praticien avant validation.

### Chantier 4 — Le moteur de preuve `[O4]`
*Dépend de la masse de données produite par 1 et 2.*

- Agréger les résultats par protocole : « protocole lombalgie : 340 patients,
  EIFEL −7,2 points à 6 semaines ».
- Afficher ces résultats dans la bibliothèque partagée, au moment du choix du protocole.
- Anonymisation et agrégation strictes — jamais de donnée patient identifiable.

**Critère de réussite :** choisir un protocole partagé affiche son résultat moyen observé.

---

## 6. Contraintes non négociables

- **Hébergement HDS.** Héberger des données de santé en France impose un hébergeur
  certifié *Hébergeur de Données de Santé*. L'instance PocketBase auto-hébergée
  actuelle ne l'est probablement pas. C'est **bloquant pour vendre à un cabinet** —
  et, une fois obtenu, c'est une barrière à l'entrée contre les concurrents amateurs.
- **Statut réglementaire de l'IA.** Toute fonctionnalité formulée comme une aide au
  diagnostic doit être évaluée au regard du MDR et de l'AI Act avant mise en production.
- **Modèle de prix.** Basculer d'un quota d'exercices vers un prix par patient actif
  ou par praticien, pour que la valeur facturée suive l'usage clinique.

---

## 7. Hors périmètre (gelé volontairement)

Annuaire, annonces d'emploi, formations, actualités : fonctionnalités de plateforme
qui exigent une masse critique inexistante aujourd'hui. Elles diluent le produit et
le message.

**Décision :** gelées tant que la boucle de mesure n'est pas la raison n°1 pour
laquelle un praticien paie l'abonnement.

---

## 8. Indicateurs de succès

| Objectif | Indicateur |
|---|---|
| O1 | % de bilans contenant au moins une mesure structurée |
| O2 | Taux d'observance moyen des patients suivis via le portail |
| O3 | Temps médian de rédaction d'un bilan (avant / après le scribe) |
| O4 | Nombre de protocoles disposant de résultats agrégés significatifs |
| Business | Revenu par praticien actif, et son évolution dans le temps |

---

## 9. Documents liés

- [`plan-traitements-patient.md`](./plan-traitements-patient.md) — instanciation des
  traitements par patient (prérequis technique du chantier 2 : le patient doit avoir
  *son* traitement, pas le modèle).
- [`media-image-ou-video.md`](./media-image-ou-video.md) — support média des exercices.
