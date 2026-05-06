import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
  signOut: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Dev bypass: In non-production environments with ?dev=true, grant admin access
  // This solves the problem that the Lovable platform login is separate from the app's Supabase auth
  // Once activated, it persists for the browser session via sessionStorage
  const isNonProduction = typeof window !== 'undefined' && (
    window.location.hostname.includes('preview') || 
    window.location.hostname.includes('lovableproject.com') || 
    window.location.hostname.includes('localhost') ||
    import.meta.env.DEV
  );
  
  const getDevBypass = () => {
    if (!isNonProduction) return false;
    try {
      const urlHasDev = new URLSearchParams(window.location.search).get('dev') === 'true';
      if (urlHasDev) {
        localStorage.setItem('dev_admin_bypass', 'true');
        sessionStorage.setItem('dev_admin_bypass', 'true');
        return true;
      }
      // Persist across iframe reloads (HMR / sandbox restarts) by using localStorage
      return (
        localStorage.getItem('dev_admin_bypass') === 'true' ||
        sessionStorage.getItem('dev_admin_bypass') === 'true'
      );
    } catch {
      return false;
    }
  };
  
  const devBypass = getDevBypass();
  
  const [isAdmin, setIsAdmin] = useState(devBypass);

  useEffect(() => {
    let isMounted = true;

    const checkAdminRole = async (userId: string) => {
      console.log('[AuthContext] Checking admin role for:', userId);

      // In preview/dev mode, keep admin bypass active even if token/role RPC fails.
      if (devBypass) {
        if (isMounted) setIsAdmin(true);
        return;
      }

      try {
        const { data, error } = await supabase.rpc('has_role', {
          _user_id: userId,
          _role: 'admin'
        });
        console.log('[AuthContext] Admin check result:', { data, error });
        if (isMounted) setIsAdmin(!error && data === true);
      } catch (e) {
        console.error('[AuthContext] Admin check error:', e);
        if (isMounted) setIsAdmin(false);
      }
    };

    // Listener for ONGOING auth changes (does NOT control loading)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(() => checkAdminRole(session.user.id), 0);
          
           // Log sign-in events for DSGVO audit trail
           if (event === 'SIGNED_IN') {
            supabase.rpc('insert_audit_log', {
              _action: 'login',
              _details: { method: 'email', email: session.user.email },
            }).then(() => {}, () => {}); // fire-and-forget
          }
        } else {
          if (!devBypass) setIsAdmin(false);
        }
      }
    );

    // INITIAL load (controls loading state)
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log('[AuthContext] Initial session:', session?.user?.email, session?.user?.id);
        if (!isMounted) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await checkAdminRole(session.user.id);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    // Log sign-out for DSGVO audit trail
    if (user?.id) {
      await supabase.rpc('insert_audit_log', {
        _action: 'logout',
        _details: {},
      }).then(() => {}, () => {});
    }
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    if (!devBypass) setIsAdmin(false);
    sessionStorage.removeItem('dev_admin_bypass');
    localStorage.removeItem('dev_admin_bypass');
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
