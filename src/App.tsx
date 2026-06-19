import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { RoleSimulator } from "@/components/dev/RoleSimulator";
import ProtectedRoute from "@/components/ProtectedRoute";
import AnamneseRouteGuard from "@/components/AnamneseRouteGuard";
import InfothekGateRoute from "@/components/InfothekGateRoute";
import CookieBanner from "@/components/CookieBanner";
import SchemaOrg from "@/components/seo/SchemaOrg";

// Eager: Startseite + häufig genutzte öffentliche Seiten
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Impressum from "./pages/Impressum";
import Datenschutz from "./pages/Datenschutz";
import PraxisInfo from "./pages/PraxisInfo";

// Lazy: schwere Admin-/Therapie-/PDF-Bereiche (Bundle-Splitting für schnelleren First Paint)
const Anamnesebogen = lazy(() => import("./pages/Anamnesebogen"));
const AnamneseDemo = lazy(() => import("./pages/AnamneseDemo"));
const Heilpraktiker = lazy(() => import("./pages/Heilpraktiker"));
const Gebueh = lazy(() => import("./pages/Gebueh"));
const Ernaehrung = lazy(() => import("./pages/Ernaehrung"));
const MilchUnvertraeglichkeit = lazy(() => import("./pages/MilchUnvertraeglichkeit"));
const MilchKnochengesundheit = lazy(() => import("./pages/MilchKnochengesundheit"));
const RohmilchMikrobiologie = lazy(() => import("./pages/RohmilchMikrobiologie"));
const Frequenztherapie = lazy(() => import("./pages/Frequenztherapie"));
const FAQ = lazy(() => import("./pages/FAQ"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const PatientDashboard = lazy(() => import("./pages/PatientDashboard"));
const PatientenManagerPage = lazy(() => import("./pages/PatientenManager"));
const Patientenaufklaerung = lazy(() => import("./pages/Patientenaufklaerung"));
const Erstanmeldung = lazy(() => import("./pages/Erstanmeldung"));
const Quellenhinweis = lazy(() => import("./pages/Quellenhinweis"));
const Wissensdatenbank = lazy(() => import("./pages/Wissensdatenbank"));
const Raucherentwoehnung = lazy(() => import("./pages/Raucherentwoehnung"));
const SchilddrueseHypnose = lazy(() => import("./pages/SchilddrueseHypnose"));
const Infothek = lazy(() => import("./pages/Infothek"));
const Reizdarm = lazy(() => import("./pages/Reizdarm"));
const Knieschwellung = lazy(() => import("./pages/Knieschwellung"));
const PatientenBibliothek = lazy(() => import("./pages/PatientenBibliothek"));
const AppUebersicht = lazy(() => import("./pages/AppUebersicht"));
const Neupatient = lazy(() => import("./pages/Neupatient"));
const ReizdarmHypnose = lazy(() => import("./pages/ReizdarmHypnose"));
const ParkinsonHypnose = lazy(() => import("./pages/ParkinsonHypnose"));

const queryClient = new QueryClient();

const PageFallback = () => (
  <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground">
    <div className="animate-pulse">Lädt …</div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <SchemaOrg />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <CookieBanner />
          <RoleSimulator />
            <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/anamnesebogen" element={<AnamneseRouteGuard><Anamnesebogen /></AnamneseRouteGuard>} />
              <Route path="/erstanmeldung" element={<ProtectedRoute><Erstanmeldung /></ProtectedRoute>} />
              <Route path="/anamnesebogen-demo" element={<AnamneseDemo />} />
              <Route path="/datenschutz" element={<InfothekGateRoute><Datenschutz /></InfothekGateRoute>} />
              <Route path="/heilpraktiker" element={<InfothekGateRoute><Heilpraktiker /></InfothekGateRoute>} />
              <Route path="/gebueh" element={<InfothekGateRoute><Gebueh /></InfothekGateRoute>} />
              <Route path="/ernaehrung" element={<InfothekGateRoute><Ernaehrung /></InfothekGateRoute>} />
              <Route path="/milch-unvertraeglichkeit" element={<InfothekGateRoute defaultGated><MilchUnvertraeglichkeit /></InfothekGateRoute>} />
              <Route path="/milch-knochengesundheit" element={<InfothekGateRoute defaultGated><MilchKnochengesundheit /></InfothekGateRoute>} />
              <Route path="/rohmilch-mikrobiologie" element={<InfothekGateRoute defaultGated><RohmilchMikrobiologie /></InfothekGateRoute>} />
              <Route path="/frequenztherapie" element={<InfothekGateRoute><Frequenztherapie /></InfothekGateRoute>} />
              <Route path="/faq" element={<InfothekGateRoute><FAQ /></InfothekGateRoute>} />
              <Route path="/praxis-info" element={<PraxisInfo />} />
              <Route path="/impressum" element={<Impressum />} />
              <Route path="/patientenaufklaerung" element={<InfothekGateRoute><Patientenaufklaerung /></InfothekGateRoute>} />
              <Route path="/neupatient" element={<Neupatient />} />
              <Route path="/quellenhinweis" element={<InfothekGateRoute><Quellenhinweis /></InfothekGateRoute>} />
              <Route path="/raucherentwoehnung" element={<InfothekGateRoute defaultGated><Raucherentwoehnung /></InfothekGateRoute>} />
              <Route path="/schilddruese-hypnose" element={<InfothekGateRoute defaultGated><SchilddrueseHypnose /></InfothekGateRoute>} />
              <Route path="/reizdarm-hypnose" element={<InfothekGateRoute defaultGated><ReizdarmHypnose /></InfothekGateRoute>} />
              <Route path="/parkinson-hypnose" element={<InfothekGateRoute defaultGated><ParkinsonHypnose /></InfothekGateRoute>} />
              <Route path="/infothek" element={<Infothek />} />
              <Route path="/reizdarm" element={<InfothekGateRoute><Reizdarm /></InfothekGateRoute>} />
              <Route path="/knieschwellung" element={<InfothekGateRoute><Knieschwellung /></InfothekGateRoute>} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/wissensdatenbank" element={<Wissensdatenbank />} />
              <Route path="/patienten" element={<PatientenManagerPage />} />
              <Route path="/dashboard" element={<PatientDashboard />} />
              <Route path="/patienten-bibliothek" element={<ProtectedRoute><PatientenBibliothek /></ProtectedRoute>} />
              <Route path="/app-uebersicht" element={<AppUebersicht />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
