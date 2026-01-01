import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Target, ClipboardList, FileText, Calendar } from "lucide-react";
import { format } from "date-fns";

interface CarePlanData {
  motif_consultation: string;
  bilan_kine: string;
  objectifs_prise_en_charge: string;
  bilan_initial_date?: string | null;
}

interface PatientCareObjectivesCardProps {
  carePlan: CarePlanData;
  onChange: (field: keyof CarePlanData, value: string) => void;
  onBlur?: () => void;
  onBilanInitial?: () => void;
  onCertificats?: () => void;
}

export function PatientCareObjectivesCard({
  carePlan,
  onChange,
  onBlur,
  onBilanInitial,
  onCertificats,
}: PatientCareObjectivesCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="w-5 h-5" />
            Objectifs soins
          </CardTitle>
        </div>
        {/* Actions - responsive layout */}
        <div className="flex flex-col sm:flex-row gap-2">
          {onBilanInitial && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={carePlan.bilan_initial_date || ""}
                onChange={(e) => onChange("bilan_initial_date", e.target.value)}
                onBlur={onBlur}
                className="flex-1 sm:w-36 h-9 text-xs"
              />
              <Button variant="outline" size="sm" onClick={onBilanInitial} className="shrink-0">
                <ClipboardList className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Bilan initial</span>
              </Button>
            </div>
          )}
          {onCertificats && (
            <Button variant="outline" size="sm" onClick={onCertificats} className="shrink-0">
              <FileText className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Certificat constat</span>
              <span className="sm:hidden">Certificat</span>
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
            onBlur={onBlur}
            className="mt-1"
          />
        </div>

        <div>
          <Label>Objectifs de prise en charge</Label>
          <Textarea
            placeholder="Décrivez les objectifs de prise en charge..."
            value={carePlan.objectifs_prise_en_charge}
            onChange={(e) => onChange("objectifs_prise_en_charge", e.target.value)}
            onBlur={onBlur}
            className="mt-1"
          />
        </div>

        <div>
          <Label>Bilan kiné</Label>
          <Textarea
            placeholder="Décrivez le bilan kinésithérapique..."
            value={carePlan.bilan_kine}
            onChange={(e) => onChange("bilan_kine", e.target.value)}
            onBlur={onBlur}
            className="mt-1"
          />
        </div>
      </CardContent>
    </Card>
  );
}
