import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { clearDevAdminBypass, isDevAdminBypassActive } from '@/lib/devAdminBypass';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  roleChecked: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
  roleChecked: false,
  signOut: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef<Session | null>(null);
  const nullSessionRecheckRef = useRef<number | null>(null);
  const intentionalSignOutRef = useRef(false);

  const devBypass = isDevAdminBypassActive();
  
  const [isAdmin, setIsAdmin] = useState(devBypass);

  useEffect(() => {
    let isMounted = true;

    const applySession = (nextSession: Session | null) => {
      sessionRef.current = nextSession;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
    };

    const clearSession = () => {
      sessionRef.current = null;
      setSession(null);
      setUser(null);
      if (!devBypass) setIsAdmin(false);
    };

    const confirmMissingSession = () => {
      if (nullSessionRecheckRef.current) window.clearTimeout(nullSessionRecheckRef.current);
      setLoading(true);
      nullSessionRecheckRef.current = window.setTimeout(async () => {
        try {
          const { data: { session: confirmedSession } } = await supabase.auth.getSession();
          if (!isMounted) return;

          if (confirmedSession?.user) {
            applySession(confirmedSession);
            await checkAdminRole(confirmedSession.user.id);
          } else {
            clearSession();
          }
        } finally {
          if (isMounted) setLoading(false);
        }
      }, 400);
    };

    const checkAdminRole = async (userId: string) => {
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
        if (isMounted) setIsAdmin(!error && data === true);
      } catch (e) {
        if (isMounted) setIsAdmin(false);
      }
    };

    // Listener for ONGOING auth changes (does NOT control loading)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        if (!isMounted) return;
        if (nullSessionRecheckRef.current) {
          window.clearTimeout(nullSessionRecheckRef.current);
          nullSessionRecheckRef.current = null;
        }

        if (nextSession?.user) {
          applySession(nextSession);
          setLoading(false);
          setTimeout(() => checkAdminRole(nextSession.user.id), 0);

           // Log sign-in events for DSGVO audit trail
           if (event === 'SIGNED_IN') {
            supabase.rpc('insert_audit_log', {
              _action: 'login',
              _details: { method: 'email' },
            }).then(() => {}, () => {}); // fire-and-forget
          }
          return;
        }

        if (event === 'SIGNED_OUT' || intentionalSignOutRef.current) {
          intentionalSignOutRef.current = false;
          clearSession();
          setLoading(false);
          return;
        }

        // Hot reloads/preview refreshes can briefly emit a null session before
        // persisted auth storage is available. Re-check before redirecting.
        if (sessionRef.current) confirmMissingSession();
        else clearSession();
      }
    );

    // INITIAL load (controls loading state)
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;

        applySession(session);

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
      if (nullSessionRecheckRef.current) window.clearTimeout(nullSessionRecheckRef.current);
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
    intentionalSignOutRef.current = true;
    await supabase.auth.signOut();
    sessionRef.current = null;
    setUser(null);
    setSession(null);
    if (!devBypass) setIsAdmin(false);
    clearDevAdminBypass();
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
