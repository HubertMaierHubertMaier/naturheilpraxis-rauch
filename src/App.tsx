import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AnamneseRouteGuard from "@/components/AnamneseRouteGuard";
import CookieBanner from "@/components/CookieBanner";
import SchemaOrg from "@/components/seo/SchemaOrg";
import Index from "./pages/Index";
import Anamnesebogen from "./pages/Anamnesebogen";
import AnamneseDemo from "./pages/AnamneseDemo";
import Datenschutz from "./pages/Datenschutz";
import Heilpraktiker from "./pages/Heilpraktiker";
import Gebueh from "./pages/Gebueh";
import Ernaehrung from "./pages/Ernaehrung";
import MilchUnvertraeglichkeit from "./pages/MilchUnvertraeglichkeit";
import MilchKnochengesundheit from "./pages/MilchKnochengesundheit";
import RohmilchMikrobiologie from "./pages/RohmilchMikrobiologie";
import Frequenztherapie from "./pages/Frequenztherapie";
import FAQ from "./pages/FAQ";
import PraxisInfo from "./pages/PraxisInfo";
import Impressum from "./pages/Impressum";
import Auth from "./pages/Auth";
import AdminDashboard from "./pages/AdminDashboard";
import PatientDashboard from "./pages/PatientDashboard";
import NotFound from "./pages/NotFound";
import PatientenManagerPage from "./pages/PatientenManager";
import Patientenaufklaerung from "./pages/Patientenaufklaerung";
import Erstanmeldung from "./pages/Erstanmeldung";
import Quellenhinweis from "./pages/Quellenhinweis";
import Wissensdatenbank from "./pages/Wissensdatenbank";
import Raucherentwoehnung from "./pages/Raucherentwoehnung";
import SchilddrueseHypnose from "./pages/SchilddrueseHypnose";
import Infothek from "./pages/Infothek";
import Reizdarm from "./pages/Reizdarm";
import Knieschwellung from "./pages/Knieschwellung";
import PatientenBibliothek from "./pages/PatientenBibliothek";
import AppUebersicht from "./pages/AppUebersicht";
import Neupatient from "./pages/Neupatient";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <SchemaOrg />
          <BrowserRouter>
            <CookieBanner />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/anamnesebogen" element={<AnamneseRouteGuard><Anamnesebogen /></AnamneseRouteGuard>} />
              <Route path="/erstanmeldung" element={<ProtectedRoute><Erstanmeldung /></ProtectedRoute>} />
              <Route path="/anamnesebogen-demo" element={<AnamneseDemo />} />
              <Route path="/datenschutz" element={<Datenschutz />} />
              <Route path="/heilpraktiker" element={<Heilpraktiker />} />
              <Route path="/gebueh" element={<Gebueh />} />
              <Route path="/ernaehrung" element={<Ernaehrung />} />
              <Route path="/milch-unvertraeglichkeit" element={<MilchUnvertraeglichkeit />} />
              <Route path="/milch-knochengesundheit" element={<MilchKnochengesundheit />} />
              <Route path="/rohmilch-mikrobiologie" element={<RohmilchMikrobiologie />} />
              <Route path="/frequenztherapie" element={<Frequenztherapie />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/praxis-info" element={<PraxisInfo />} />
              <Route path="/impressum" element={<Impressum />} />
              <Route path="/patientenaufklaerung" element={<Patientenaufklaerung />} />
              <Route path="/neupatient" element={<Neupatient />} />
              <Route path="/quellenhinweis" element={<Quellenhinweis />} />
              <Route path="/raucherentwoehnung" element={<Raucherentwoehnung />} />
              <Route path="/schilddruese-hypnose" element={<SchilddrueseHypnose />} />
              <Route path="/infothek" element={<Infothek />} />
              <Route path="/reizdarm" element={<Reizdarm />} />
              <Route path="/knieschwellung" element={<Knieschwellung />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/wissensdatenbank" element={<Wissensdatenbank />} />
              <Route path="/patienten" element={<PatientenManagerPage />} />
              <Route path="/dashboard" element={<PatientDashboard />} />
              <Route path="/patienten-bibliothek" element={<ProtectedRoute><PatientenBibliothek /></ProtectedRoute>} />
              <Route path="/app-uebersicht" element={<AppUebersicht />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
