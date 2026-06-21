import { Layout } from "@/components/layout/Layout";
import { CorbeilleList } from "@/components/corbeille/CorbeilleList";
import { useAuth } from "@/lib/auth";

export default function Corbeille() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Connectez-vous pour accéder à cette page.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-2 sm:px-4 py-4 md:py-8">
        <CorbeilleList />
      </div>
    </Layout>
  );
}
