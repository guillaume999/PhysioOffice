import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";

export default function SeanceType() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-xl bg-indigo-500/10">
            <Calendar className="w-8 h-8 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold">Séance Type</h1>
            <p className="text-muted-foreground">Gérez vos modèles de séances prédéfinies</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Modèles de séances</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Cette section vous permettra de créer et gérer vos séances types.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
