import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar, Plus, FileDown, Edit, Trash2, GripVertical, ExternalLink, ClipboardList } from "lucide-react";

interface SeanceData {
  id: string;
  seance_type_id: string;
  ordre: number;
  seance_type?: {
    pathologie: string;
    objectif_principal: string;
  };
}

interface PatientSeancesCardProps {
  seances: SeanceData[];
  onImportSeance: () => void;
  onCreateSeance: () => void;
  onEditSeance: (seance: SeanceData) => void;
  onDeleteSeance: (seanceId: string) => void;
  onImportTraitement: () => void;
  onCreateTraitement: () => void;
  activeTraitementName?: string | null;
}

export function PatientSeancesCard({
  seances,
  onImportSeance,
  onCreateSeance,
  onEditSeance,
  onDeleteSeance,
  onImportTraitement,
  onCreateTraitement,
  activeTraitementName,
}: PatientSeancesCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ClipboardList className="w-5 h-5" />
          Plan de traitement & Séances
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Plan de traitement */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <Label className="text-base font-semibold">Plan de traitement actif</Label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onImportTraitement}>
                <FileDown className="w-4 h-4 mr-2" />
                Importer
              </Button>
              <Button variant="outline" size="sm" onClick={onCreateTraitement}>
                <Plus className="w-4 h-4 mr-2" />
                Créer
              </Button>
            </div>
          </div>
          {activeTraitementName ? (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center justify-between">
                <span className="font-medium">{activeTraitementName}</span>
                <Button variant="ghost" size="sm">
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Aucun plan de traitement actif. Importez-en un ou créez-en un nouveau.
            </p>
          )}
        </div>

        {/* Séances */}
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-base font-semibold flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Séances du patient
            </Label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onImportSeance}>
                <FileDown className="w-4 h-4 mr-2" />
                Importer
              </Button>
              <Button variant="outline" size="sm" onClick={onCreateSeance}>
                <Plus className="w-4 h-4 mr-2" />
                Créer
              </Button>
            </div>
          </div>
          {seances.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">
              Aucune séance programmée. Importez des séances existantes ou créez-en de nouvelles.
            </p>
          ) : (
            <div className="space-y-2">
              {seances.map((seance, index) => (
                <div
                  key={seance.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                  <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium">
                      {seance.seance_type?.pathologie || "Séance"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {seance.seance_type?.objectif_principal || "Objectif non défini"}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEditSeance(seance)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDeleteSeance(seance.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
