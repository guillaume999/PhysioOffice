import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare } from "lucide-react";

interface PatientCommentsCardProps {
  comments: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}

export function PatientCommentsCard({ comments, onChange, onBlur }: PatientCommentsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Commentaires
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Textarea
          placeholder="Ajoutez vos commentaires sur ce patient..."
          value={comments}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="min-h-[120px]"
        />
      </CardContent>
    </Card>
  );
}
