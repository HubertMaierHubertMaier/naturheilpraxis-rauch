import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { clearDevAdminBypass, isDevAdminBypassActive } from '@/lib/devAdminBypass';
import { getSimulatedPreset, onSimulatedRoleChange } from '@/lib/roleSimulator';
import { sameAuthenticatedSession } from '@/lib/authSessionIdentity';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** Im Rollen-Simulator ggf. auf false gezwungen, damit der Admin die Patientensicht sieht. */
  isAdmin: boolean;
  /** Tatsächliche Admin-Rolle aus der Datenbank – wird vom Simulator nicht überschrieben. */
  realIsAdmin: boolean;
  twoFactorVerified: boolean;
  twoFactorChecked: boolean;
  roleChecked: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
  realIsAdmin: false,
  twoFactorVerified: false,
  twoFactorChecked: false,
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
  const signOutRequestVersionRef = useRef(0);

  const devBypass = isDevAdminBypassActive();
  
  const [isAdmin, setIsAdmin] = useState(devBypass);
  const [twoFactorVerified, setTwoFactorVerified] = useState(devBypass);
  const [twoFactorChecked, setTwoFactorChecked] = useState(devBypass);
  const [roleChecked, setRoleChecked] = useState(devBypass);

  useEffect(() => {
    let isMounted = true;
    let securityCheckVersion = 0;
    let authEventVersion = 0;

    const applySession = (nextSession: Session | null) => {
      if (!sameAuthenticatedSession(sessionRef.current, nextSession)) {
        signOutRequestVersionRef.current += 1;
        intentionalSignOutRef.current = false;
      }
      sessionRef.current = nextSession;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
    };

    const clearSession = () => {
      securityCheckVersion += 1;
      sessionRef.current = null;
      setSession(null);
      setUser(null);
      if (!devBypass) setIsAdmin(false);
      if (!devBypass) setTwoFactorVerified(false);
      setTwoFactorChecked(true);
      setRoleChecked(true);
    };

    const confirmMissingSession = () => {
      const requestedVersion = authEventVersion;
      if (nullSessionRecheckRef.current) window.clearTimeout(nullSessionRecheckRef.current);
      if (!sessionRef.current) setLoading(true);
      nullSessionRecheckRef.current = window.setTimeout(async () => {
        try {
          const { data: { session: confirmedSession } } = await supabase.auth.getSession();
          if (!isMounted || requestedVersion !== authEventVersion) return;

          if (confirmedSession?.user) {
            const unchangedSession = sameAuthenticatedSession(sessionRef.current, confirmedSession);
            applySession(confirmedSession);
            if (!unchangedSession) {
              if (!devBypass) { setIsAdmin(false); setTwoFactorVerified(false); }
              setRoleChecked(false);
              setTwoFactorChecked(false);
            }
            await checkSessionSecurity(confirmedSession.user.id);
          } else {
            clearSession();
          }
        } finally {
          if (isMounted && requestedVersion === authEventVersion) setLoading(false);
        }
      }, 400);
    };

    const checkSessionSecurity = async (userId: string) => {
      const version = ++securityCheckVersion;
      const checkedSession = sessionRef.current;
      const isCurrent = () => isMounted && version === securityCheckVersion
        && checkedSession?.user.id === userId && sameAuthenticatedSession(checkedSession, sessionRef.current);
      // In preview/dev mode, keep admin bypass active even if token/role RPC fails.
      if (devBypass) {
        if (isCurrent()) {
          setIsAdmin(true);
          setTwoFactorVerified(true);
          setTwoFactorChecked(true);
          setRoleChecked(true);
        }
        return;
      }

      let admin = false;
      try {
        const { data, error } = await supabase.rpc('has_role', {
          _user_id: userId,
          _role: 'admin'
        });
        admin = !error && data === true;
        if (isCurrent()) setIsAdmin(admin);
      } catch (e) {
        if (isCurrent()) setIsAdmin(false);
      } finally {
        if (isCurrent()) setRoleChecked(true);
      }

      try {
        if (!isCurrent()) return;
        const { data, error } = await supabase.rpc('is_current_session_two_factor_completed');
        if (isCurrent()) setTwoFactorVerified(!error && data === true);
      } catch {
        if (isCurrent()) setTwoFactorVerified(false);
      } finally {
        if (isCurrent()) setTwoFactorChecked(true);
      }
    };

    // Listener for ONGOING auth changes (does NOT control loading)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        if (!isMounted) return;
        authEventVersion += 1;
        if (nullSessionRecheckRef.current) {
          window.clearTimeout(nullSessionRecheckRef.current);
          nullSessionRecheckRef.current = null;
        }

        if (nextSession?.user) {
          const unchangedSession = sameAuthenticatedSession(sessionRef.current, nextSession);
          securityCheckVersion += 1;
          applySession(nextSession);
          setLoading(false);
          // Retain queued Files while the unchanged session is rechecked normally.
          if (!unchangedSession) {
            if (!devBypass) { setIsAdmin(false); setTwoFactorVerified(false); }
            setRoleChecked(false);
            setTwoFactorChecked(false);
          }
          setTimeout(() => {
            if (sameAuthenticatedSession(sessionRef.current, nextSession)) void checkSessionSecurity(nextSession.user.id);
          }, 0);

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
      const requestedVersion = authEventVersion;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted || requestedVersion !== authEventVersion) return;

        if (session?.user) {
          applySession(session);
          setRoleChecked(false);
          setTwoFactorChecked(false);
          await checkSessionSecurity(session.user.id);
        } else {
          clearSession();
        }
      } finally {
        if (isMounted && requestedVersion === authEventVersion) setLoading(false);
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
    const requestedSession = sessionRef.current;
    const requestVersion = ++signOutRequestVersionRef.current;
    const stillRequested = () => requestVersion === signOutRequestVersionRef.current
      && (requestedSession ? sameAuthenticatedSession(requestedSession, sessionRef.current) : !sessionRef.current);
    // Bind ancillary requests to the session whose logout was requested.
    if (requestedSession?.user.id) {
      await supabase.rpc('insert_audit_log', {
        _action: 'logout',
        _details: {},
      }).setHeader('Authorization', `Bearer ${requestedSession.access_token}`).then(() => {}, () => {});
      if (!stillRequested()) return;
      await supabase.rpc('clear_current_two_factor_session' as never)
        .setHeader('Authorization', `Bearer ${requestedSession.access_token}`).then(() => {}, () => {});
    }
    if (!stillRequested()) return;
    intentionalSignOutRef.current = true;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      if (requestVersion === signOutRequestVersionRef.current) intentionalSignOutRef.current = false;
      throw error;
    }
    if (requestVersion !== signOutRequestVersionRef.current
      || (sessionRef.current && !sameAuthenticatedSession(requestedSession, sessionRef.current))) return;
    intentionalSignOutRef.current = false;
    sessionRef.current = null;
    setUser(null);
    setSession(null);
    if (!devBypass) setIsAdmin(false);
    if (!devBypass) setTwoFactorVerified(false);
    setTwoFactorChecked(true);
    clearDevAdminBypass();
  };

  // Rollen-Simulator: Admin-UI bei Bedarf verstecken
  const [simHideAdmin, setSimHideAdmin] = useState<boolean>(() => !!getSimulatedPreset()?.hideAdminUi);
  useEffect(
    () => onSimulatedRoleChange(() => setSimHideAdmin(!!getSimulatedPreset()?.hideAdminUi)),
    []
  );

  const effectiveIsAdmin = simHideAdmin ? false : isAdmin;

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin: effectiveIsAdmin, realIsAdmin: isAdmin, twoFactorVerified, twoFactorChecked, roleChecked, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
