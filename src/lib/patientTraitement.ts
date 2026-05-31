import { pb } from "@/integrations/pocketbase/client";

/**
 * Instantiate a treatment template (traitement_types) as an independent patient
 * instance: copies the template + its tests + its séances (and their exercises)
 * into the patient_* instance tables. The instance keeps a `source` back-reference
 * to its origin but is fully independent — editing it never touches the template.
 *
 * @returns the created patient_traitements record
 */
export async function instantiateTraitementForPatient(
  templateId: string,
  patientId: string,
  praticienId: string,
) {
  const template: any = await pb.collection("traitement_types").getOne(templateId, {
    fields: "id,nom,pathologie,description",
  });

  const pt = await pb.collection("patient_traitements").create({
    patient: patientId,
    praticien: praticienId,
    source: templateId,
    nom: template.nom || template.pathologie || "",
    pathologie: template.pathologie || "",
    description: template.description || "",
    statut: "actif",
    date_debut: new Date().toISOString(),
  });

  // Copy tests
  const tests = await pb.collection("traitement_tests").getFullList({
    filter: `traitement_type = "${templateId}"`, sort: "ordre", expand: "exercice",
  });
  for (const t of tests as any[]) {
    await pb.collection("patient_traitement_tests").create({
      patient_traitement: pt.id,
      source: t.exercice || null,
      nom: t.expand?.exercice?.title || "",
      description: t.description || t.expand?.exercice?.description || "",
      video_url: t.expand?.exercice?.video_url || "",
      ordre: t.ordre,
    });
  }

  // Copy séances + their exercises
  const seances = await pb.collection("traitement_seances").getFullList({
    filter: `traitement_type = "${templateId}"`, sort: "ordre", expand: "seance_type",
  });
  for (const s of seances as any[]) {
    const st = s.expand?.seance_type;
    const ps = await pb.collection("patient_seances").create({
      patient_traitement: pt.id,
      patient: patientId,
      praticien: praticienId,
      source: s.seance_type || null,
      nom: st?.objectif_principal || st?.pathologie || st?.nom || "",
      objectif: st?.objectif_principal || st?.objectif || "",
      statut: "planifiée",
    });

    const exs = await pb.collection("seance_exercices").getFullList({
      filter: `seance_type = "${s.seance_type}"`, sort: "ordre", expand: "exercice",
    });
    for (const ex of exs as any[]) {
      await pb.collection("patient_seance_exercices").create({
        patient_seance: ps.id,
        source: ex.exercice || null,
        nom: ex.name || ex.expand?.exercice?.title || "",
        description: ex.description || "",
        video_url: ex.expand?.exercice?.video_url || "",
        ordre: ex.ordre,
        series: ex.series,
        repetitions: ex.repetitions,
        duree: ex.duration_seconds,
        realise: false,
      });
    }
  }

  return pt;
}
