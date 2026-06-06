import React from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAnamnesePublic } from "@/hooks/useAnamnesePublic";
import { Loader2 } from "lucide-react";

/**
 * Wrapper für `/anamnesebogen`:
 * - Wenn admin-seitig `anamnese_public` aktiv → freier Zugang (kein Login nötig).
 * - Sonst → normale ProtectedRoute.
 */
export const AnamneseRouteGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { enabled, loading } = useAnamnesePublic();

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        role="status"
        aria-label="Anamnese-Zugriff wird geprüft"
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
      </div>
    );
  }

  if (enabled) return <>{children}</>;
  return <ProtectedRoute>{children}</ProtectedRoute>;
};

export default AnamneseRouteGuard;
