import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
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
import Exercices from "./pages/Exercices";
import Videos from "./pages/Videos";
import Admin from "./pages/Admin";
import PatientSessionView from "./pages/PatientSessionView";
import Pricing from "./pages/Pricing";
import Planning from "./pages/Planning";
import Formation from "./pages/Formation";
import News from "./pages/News";
import Annonces from "./pages/Annonces";
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
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/patients/:id" element={<PatientDetail />} />
            <Route path="/patients/:id/traitement-actif" element={<PatientTraitementActif />} />
            <Route path="/patients/:id/bilan-initial" element={<PatientBilanInitial />} />
            <Route path="/patients/:id/bilan-intermediaire" element={<PatientBilanIntermediaire />} />
            <Route path="/patients/:id/certificats" element={<PatientCertificats />} />
            <Route path="/ia-diagnostic" element={<IADiagnostic />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/mentions-legales" element={<MentionsLegales />} />
            <Route path="/traitement-type" element={<TraitementType />} />
            <Route path="/seance-type" element={<SeanceType />} />
            <Route path="/exercices" element={<Exercices />} />
            <Route path="/videos" element={<Videos />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/patient-session" element={<PatientSessionView />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/planning" element={<Planning />} />
            <Route path="/formation" element={<Formation />} />
            <Route path="/news" element={<News />} />
            <Route path="/annonces" element={<Annonces />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
