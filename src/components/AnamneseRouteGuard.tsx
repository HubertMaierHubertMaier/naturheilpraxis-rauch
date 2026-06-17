import React from "react";
import ProtectedRoute from "@/components/ProtectedRoute";

/**
 * Wrapper für `/anamnesebogen`:
 * - Der Online-Anamnesebogen ist grundsätzlich login-geschützt.
 * - Der frühere Public-Schalter wird bewusst ignoriert, damit der Bogen nie
 *   versehentlich ohne Anmeldung erreichbar ist.
 */
export const AnamneseRouteGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <ProtectedRoute>{children}</ProtectedRoute>;
};

export default AnamneseRouteGuard;
