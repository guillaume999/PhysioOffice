import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MentionsLegales() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-4xl font-display font-bold mb-8 text-center">Mentions Légales</h1>
        <div className="space-y-6">
          <Card><CardHeader><CardTitle>Éditeur du site</CardTitle></CardHeader><CardContent className="text-muted-foreground"><p>PhysioOffice SAS<br />123 Rue de la Santé<br />75000 Paris, France<br />SIRET : 123 456 789 00012</p></CardContent></Card>
          <Card><CardHeader><CardTitle>Hébergement</CardTitle></CardHeader><CardContent className="text-muted-foreground"><p>Ce site est hébergé par Lovable Cloud.</p></CardContent></Card>
          <Card><CardHeader><CardTitle>Protection des données</CardTitle></CardHeader><CardContent className="text-muted-foreground"><p>Conformément au RGPD, vous disposez d'un droit d'accès, de rectification et de suppression de vos données. Contactez-nous pour toute demande.</p></CardContent></Card>
          <Card><CardHeader><CardTitle>Cookies</CardTitle></CardHeader><CardContent className="text-muted-foreground"><p>Ce site utilise des cookies techniques nécessaires à son fonctionnement.</p></CardContent></Card>
        </div>
      </div>
    </Layout>
  );
}
