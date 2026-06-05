// Migration : fusionne objectifs_secondaires -> objectifs_principaux dans seance_types
// et remappe les rows de la collection `objectifs` de type "secondaire" -> "principal".
//
// Usage :  node scripts/migrate-objectifs-secondaires.mjs
//
// Variables d'env (sinon valeurs par défaut) :
//   PB_URL       (défaut: https://pocketbase-dev.physiooffice.com)
//   PB_EMAIL     (défaut: guillaume.aragon.montemagni@gmail.com)
//   PB_PASSWORD  (obligatoire)

import PocketBase from "pocketbase";

const PB_URL = process.env.PB_URL || "https://pocketbase-dev.physiooffice.com";
const PB_EMAIL = process.env.PB_EMAIL || "guillaume.aragon.montemagni@gmail.com";
const PB_PASSWORD = process.env.PB_PASSWORD;

if (!PB_PASSWORD) {
  console.error("ERREUR : variable PB_PASSWORD manquante.");
  console.error('Exemple : PB_PASSWORD="..." node scripts/migrate-objectifs-secondaires.mjs');
  process.exit(1);
}

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

const uniq = (arr) => [...new Set(arr.filter(Boolean))];

async function main() {
  console.log(`Auth superuser sur ${PB_URL}…`);
  await pb.collection("_superusers").authWithPassword(PB_EMAIL, PB_PASSWORD);
  console.log("OK.\n");

  // --- 1. seance_types : fusion des objectifs ---
  console.log("== seance_types : fusion objectifs_secondaires -> objectifs_principaux ==");
  const seances = await pb.collection("seance_types").getFullList({ batch: 200 });
  let updated = 0;
  for (const s of seances) {
    const principaux = Array.isArray(s.objectifs_principaux) ? s.objectifs_principaux : [];
    const secondaires = Array.isArray(s.objectifs_secondaires) ? s.objectifs_secondaires : [];
    const legacyPrincipal = s.objectif_principal ? [s.objectif_principal] : [];
    const legacySecondaire = s.objectif_secondaire ? [s.objectif_secondaire] : [];

    const merged = uniq([...principaux, ...secondaires, ...legacyPrincipal, ...legacySecondaire]);

    const needsUpdate =
      JSON.stringify(merged) !== JSON.stringify(principaux) ||
      (Array.isArray(s.objectifs_secondaires) && s.objectifs_secondaires.length > 0) ||
      (s.objectif_secondaire ?? null) !== null;

    if (!needsUpdate) continue;

    await pb.collection("seance_types").update(s.id, {
      objectifs_principaux: merged,
      objectifs_secondaires: [],
      objectif_principal: merged[0] || "",
      objectif_secondaire: null,
    });
    updated++;
  }
  console.log(`  -> ${updated}/${seances.length} seance_types mises à jour.\n`);

  // --- 2. collection `objectifs` : type "secondaire" -> "principal" (dédup) ---
  console.log("== objectifs : type 'secondaire' -> 'principal' (dédup par user+name) ==");
  const all = await pb.collection("objectifs").getFullList({ batch: 200 });
  const byKey = new Map(); // user|name -> { principalId, secondaireIds[] }
  for (const o of all) {
    const key = `${o.user}|${o.name}`;
    if (!byKey.has(key)) byKey.set(key, { principalId: null, secondaireIds: [] });
    const slot = byKey.get(key);
    if (o.type === "principal") slot.principalId = o.id;
    else if (o.type === "secondaire") slot.secondaireIds.push(o.id);
  }

  let promoted = 0;
  let deleted = 0;
  for (const [, slot] of byKey) {
    if (slot.secondaireIds.length === 0) continue;
    if (slot.principalId) {
      // un principal existe déjà -> supprime les doublons secondaires
      for (const id of slot.secondaireIds) {
        await pb.collection("objectifs").delete(id);
        deleted++;
      }
    } else {
      // promeut le premier secondaire en principal, supprime le reste
      const [first, ...rest] = slot.secondaireIds;
      await pb.collection("objectifs").update(first, { type: "principal" });
      promoted++;
      for (const id of rest) {
        await pb.collection("objectifs").delete(id);
        deleted++;
      }
    }
  }
  console.log(`  -> ${promoted} promus, ${deleted} doublons supprimés.\n`);

  // --- 3. Suppression des champs obsolètes sur la collection seance_types ---
  console.log("== seance_types : suppression des champs objectif_secondaire / objectifs_secondaires ==");
  const coll = await pb.collections.getOne("seance_types");
  const before = coll.fields.length;
  coll.fields = coll.fields.filter(
    (f) => f.name !== "objectif_secondaire" && f.name !== "objectifs_secondaires",
  );
  const removed = before - coll.fields.length;
  if (removed > 0) {
    await pb.collections.update(coll.id, { fields: coll.fields });
    console.log(`  -> ${removed} champ(s) supprimé(s) du schéma.\n`);
  } else {
    console.log("  -> champs déjà absents.\n");
  }

  console.log("Migration terminée.");
}

main().catch((err) => {
  console.error("ECHEC migration :", err);
  process.exit(1);
});
