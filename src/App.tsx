import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Patients from "./pages/Patients";
import PatientDetail from "./pages/PatientDetail";
import PatientTraitementActif from "./pages/PatientTraitementActif";
import PatientBilanInitial from "./pages/PatientBilanInitial";
import PatientBilanIntermediaire from "./pages/PatientBilanIntermediaire";
import PatientCertificats from "./pages/PatientCertificats";
import IADiagnostic from "./pages/IADiagnostic";
import Notes from "./pages/Notes";
import Profile from "./pages/Profile";
import Journal from "./pages/Journal";
import Contact from "./pages/Contact";
import MentionsLegales from "./pages/MentionsLegales";
import TraitementType from "./pages/TraitementType";
import SeanceType from "./pages/SeanceType";
import Pathologies from "./pages/Pathologies";
import PathologieDetail from "./pages/PathologieDetail";
import Objectifs from "./pages/Objectifs";
import Exercices from "./pages/Exercices";
import Videos from "./pages/Videos";
import Admin from "./pages/Admin";
import PatientSessionView from "./pages/PatientSessionView";
import Pricing from "./pages/Pricing";
import Planning from "./pages/Planning";
import Formation from "./pages/Formation";
import News from "./pages/News";
import Annonces from "./pages/Annonces";
import Annuaire from "./pages/Annuaire";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/mentions-legales" element={<MentionsLegales />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/exercices" element={<Exercices />} />
            <Route path="/videos" element={<Videos />} />
            <Route path="/formation" element={<Formation />} />
            <Route path="/news" element={<News />} />
            <Route path="/annonces" element={<Annonces />} />
            <Route path="/annuaire" element={<Annuaire />} />
            {/* Patient self-service view (accessed via access code, not an account) */}
            <Route path="/patient-session" element={<PatientSessionView />} />

            {/* Authenticated routes */}
            <Route path="/patients" element={<ProtectedRoute><Patients /></ProtectedRoute>} />
            <Route path="/patients/:id" element={<ProtectedRoute><PatientDetail /></ProtectedRoute>} />
            <Route path="/patients/:id/traitement-actif" element={<ProtectedRoute><PatientTraitementActif /></ProtectedRoute>} />
            <Route path="/patients/:id/bilan-initial" element={<ProtectedRoute><PatientBilanInitial /></ProtectedRoute>} />
            <Route path="/patients/:id/bilan-intermediaire" element={<ProtectedRoute><PatientBilanIntermediaire /></ProtectedRoute>} />
            <Route path="/patients/:id/certificats" element={<ProtectedRoute><PatientCertificats /></ProtectedRoute>} />
            <Route path="/ia-diagnostic" element={<ProtectedRoute><IADiagnostic /></ProtectedRoute>} />
            <Route path="/notes" element={<ProtectedRoute><Notes /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/journal" element={<ProtectedRoute><Journal /></ProtectedRoute>} />
            <Route path="/traitement-type" element={<ProtectedRoute><TraitementType /></ProtectedRoute>} />
            <Route path="/seance-type" element={<ProtectedRoute><SeanceType /></ProtectedRoute>} />
            <Route path="/pathologies" element={<ProtectedRoute><Pathologies /></ProtectedRoute>} />
            <Route path="/pathologies/:id" element={<ProtectedRoute><PathologieDetail /></ProtectedRoute>} />
            <Route path="/objectifs" element={<ProtectedRoute><Objectifs /></ProtectedRoute>} />
            <Route path="/planning" element={<ProtectedRoute><Planning /></ProtectedRoute>} />
            {/* Admin-only */}
            <Route path="/admin" element={<ProtectedRoute requireAdmin><Admin /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
// build-bust 1780693533
