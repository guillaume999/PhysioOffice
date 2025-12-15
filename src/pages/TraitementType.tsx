import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList } from "lucide-react";

export default function TraitementType() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-xl bg-rose-500/10">
            <ClipboardList className="w-8 h-8 text-rose-500" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold">Traitement Type</h1>
            <p className="text-muted-foreground">Gérez vos modèles de traitements standardisés</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Modèles de traitements</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Cette section vous permettra de créer et gérer vos traitements types.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
