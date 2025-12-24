import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Target, ClipboardList, FileText } from "lucide-react";

interface CarePlanData {
  motif_consultation: string;
  bilan_kine: string;
  objectifs_prise_en_charge: string;
}

interface PatientCareObjectivesCardProps {
  carePlan: CarePlanData;
  onChange: (field: keyof CarePlanData, value: string) => void;
  onBilanInitial?: () => void;
  onCertificats?: () => void;
}

export function PatientCareObjectivesCard({
  carePlan,
  onChange,
  onBilanInitial,
  onCertificats,
}: PatientCareObjectivesCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="w-5 h-5" />
          Objectifs soins
        </CardTitle>
        <div className="flex gap-2">
          {onBilanInitial && (
            <Button variant="outline" size="sm" onClick={onBilanInitial}>
              <ClipboardList className="w-4 h-4 mr-2" />
              Bilan initial
            </Button>
          )}
          {onCertificats && (
            <Button variant="outline" size="sm" onClick={onCertificats}>
              <FileText className="w-4 h-4 mr-2" />
              Certificat constat
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Motif de consultation</Label>
          <Textarea
            placeholder="Décrivez le motif de consultation..."
            value={carePlan.motif_consultation}
            onChange={(e) => onChange("motif_consultation", e.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <Label>Bilan kiné</Label>
          <Textarea
            placeholder="Décrivez le bilan kinésithérapique..."
            value={carePlan.bilan_kine}
            onChange={(e) => onChange("bilan_kine", e.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <Label>Objectifs de prise en charge</Label>
          <Textarea
            placeholder="Décrivez les objectifs de prise en charge..."
            value={carePlan.objectifs_prise_en_charge}
            onChange={(e) => onChange("objectifs_prise_en_charge", e.target.value)}
            className="mt-1"
          />
        </div>
      </CardContent>
    </Card>
  );
}
