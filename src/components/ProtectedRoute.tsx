import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { isDevAdminBypassActive } from '@/lib/devAdminBypass';
import { useNoIndex } from '@/hooks/useNoIndex';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireTwoFactor?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireTwoFactor = false }) => {
  const { user, loading, twoFactorVerified, twoFactorChecked } = useAuth();
  const location = useLocation();
  useNoIndex();

  const devBypass = isDevAdminBypassActive();

  if (devBypass) {
    // Development mode bypass - only works in non-production builds
    return <>{children}</>;
  }

  if (loading || (requireTwoFactor && !twoFactorChecked)) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        role="status"
        aria-label="Authentifizierung wird geprüft"
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
      </div>
    );
  }

  if (!user) {
    // Redirect to auth page, saving the intended destination
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (requireTwoFactor && !twoFactorVerified) {
    return <Navigate to="/auth" state={{ from: location, reason: 'two_factor_required' }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
