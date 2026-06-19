import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Mail, ArrowLeft, Loader2, Shield, UserPlus, LogIn, Lock, Eye, EyeOff, KeyRound, HelpCircle, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Alert, AlertDescription } from '@/components/ui/alert';

const emailSchema = z.string().trim().email({ message: "Ungültige E-Mail-Adresse" }).max(255);
const passwordSchema = z.string().min(8, { message: "Passwort muss mindestens 8 Zeichen lang sein" });

type AuthStep = 'credentials' | 'verification' | 'reset_password';
type AuthMode = 'login' | 'registration' | 'password_reset';
type PatientType = 'new_patient' | 'existing_patient' | null;

const Auth: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { language } = useLanguage();
  const { user } = useAuth();

  // Preview/Dev bypass: skip auth page entirely in non-production environments
  const isNonProduction = import.meta.env.DEV || window.location.hostname.includes('preview') || window.location.hostname.includes('lovableproject.com') || window.location.hostname.includes('localhost');
  const searchParams = new URLSearchParams(window.location.search);
  const devBypass = isNonProduction && searchParams.get('dev') === 'true';
  
  // Patient type from landing page selection
  const patientType: PatientType = (searchParams.get('type') as PatientType) || null;
  const isExistingPatient = patientType === 'existing_patient';

  // Only redirect if user was ALREADY logged in when Auth page first mounted.
  // Do NOT react to auth state changes during the login/2FA flow.
  const hasCheckedInitialAuth = React.useRef(false);
  React.useEffect(() => {
    if (hasCheckedInitialAuth.current) return;
    hasCheckedInitialAuth.current = true;
    if (user || devBypass) {
      navigate('/');
    }
  }, [user, navigate, devBypass]);

  const [mode, setMode] = useState<AuthMode>('login');
  const [step, setStep] = useState<AuthStep>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [acceptedPracticeNotice, setAcceptedPracticeNotice] = useState(false);

  // Handle Login with password + 2FA
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
    } catch (err: any) {
      toast({
        title: language === 'de' ? 'Ungültige Eingabe' : 'Invalid Input',
        description: err.message,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {

      // First verify password is correct
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw new Error(
          language === 'de' 
            ? 'E-Mail oder Passwort ist falsch' 
            : 'Email or password is incorrect'
        );
      }

      // Check if user is admin – admins skip 2FA AND bypass login lock
      const { data: isAdminData } = await supabase.rpc('has_role', {
        _user_id: signInData.user?.id,
        _role: 'admin',
      });

      if (isAdminData === true) {
        // Admin: direct login, no 2FA needed
        toast({
          title: language === 'de' ? 'Willkommen!' : 'Welcome!',
          description: language === 'de' ? 'Admin-Anmeldung erfolgreich.' : 'Admin login successful.',
        });
        navigate('/');
        return;
      }

      // Non-admin: check global lock
      const { data: setting } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'patient_login_enabled')
        .maybeSingle();
      const loginEnabled = (setting?.value as { enabled?: boolean } | null)?.enabled === true;

      if (!loginEnabled) {
        await supabase.auth.signOut();
        throw new Error(
          language === 'de'
            ? 'Die Patienten-Anmeldung ist derzeit nicht möglich. Bitte kontaktieren Sie die Praxis telefonisch.'
            : 'Patient login is currently disabled. Please contact the practice by phone.'
        );
      }

      // Non-admin: Sign out and require 2FA
      await supabase.auth.signOut();

      // Request 2FA code
      const response = await supabase.functions.invoke('request-verification-code', {
        body: { email, type: 'login', userId: signInData.user?.id },
      });

      if (response.error || response.data?.error) {
        throw new Error(response.data?.error || response.error?.message || 'Fehler beim Senden des Codes');
      }

      setUserId(signInData.user?.id || null);
      setStep('verification');

      toast({
        title: language === 'de' ? 'Bestätigungscode gesendet' : 'Verification Code Sent',
        description: language === 'de' 
          ? 'Bitte prüfen Sie Ihre E-Mail für den 2FA-Code.' 
          : 'Please check your email for the 2FA code.',
      });
    } catch (error: any) {
      toast({
        title: language === 'de' ? 'Fehler' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle Registration with email verification
  const handleRegistrationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!acceptedPracticeNotice) {
      toast({
        title: language === 'de' ? 'Hinweis bestätigen' : 'Confirm notice',
        description: language === 'de'
          ? 'Bitte bestätige den Hinweis zum Praxisablauf, um Dich zu registrieren.'
          : 'Please confirm the practice notice to register.',
        variant: 'destructive',
      });
      return;
    }

    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
      
      if (password !== confirmPassword) {
        throw new Error(
          language === 'de' 
            ? 'Passwörter stimmen nicht überein' 
            : 'Passwords do not match'
        );
      }
    } catch (err: any) {
      toast({
        title: language === 'de' ? 'Ungültige Eingabe' : 'Invalid Input',
        description: err.message,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Check global lock for patient registration (anon-safe RPC)
      const { data: setting } = await supabase.rpc('get_public_app_setting', {
        _key: 'patient_login_enabled',
      });
      const loginEnabled = (setting as { enabled?: boolean } | null)?.enabled === true;
      if (!loginEnabled) {
        throw new Error(
          language === 'de'
            ? 'Die Patienten-Registrierung ist derzeit nicht möglich. Bitte kontaktieren Sie die Praxis telefonisch.'
            : 'Patient registration is currently disabled. Please contact the practice by phone.'
        );
      }

      // Request verification code - this also creates the unconfirmed user
      const response = await supabase.functions.invoke('request-verification-code', {
        body: { email, type: 'registration', password },
      });

      // Extract real server message from FunctionsHttpError context if needed
      let errorMsg: string | null = response.data?.error ?? null;
      if (!errorMsg && response.error) {
        try {
          const ctx: any = (response.error as any).context;
          if (ctx && typeof ctx.json === 'function') {
            const parsed = await ctx.json();
            errorMsg = parsed?.error || null;
          }
        } catch { /* ignore */ }
        if (!errorMsg) errorMsg = response.error.message;
      }

      if (errorMsg) {
        // Check for "already registered" error
        if (errorMsg.includes('bereits registriert') || errorMsg.includes('already registered')) {
          toast({
            title: language === 'de' ? 'Bereits registriert' : 'Already Registered',
            description: language === 'de' 
              ? 'Diese E-Mail ist bereits registriert. Wechsel zum Anmelden...' 
              : 'This email is already registered. Switching to login...',
          });
          setTimeout(() => setMode('login'), 1500);
          return;
        }
        
        throw new Error(errorMsg);
      }

      setUserId(response.data.userId || null);
      setStep('verification');

      toast({
        title: language === 'de' ? 'Bestätigungscode gesendet' : 'Verification Code Sent',
        description: language === 'de' 
          ? 'Bitte prüfen Sie Ihre E-Mail für den Bestätigungscode.' 
          : 'Please check your email for the verification code.',
      });
    } catch (error: any) {
      toast({
        title: language === 'de' ? 'Fehler' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle Password Reset Request
  const handlePasswordResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      emailSchema.parse(email);
    } catch {
      toast({
        title: language === 'de' ? 'Ungültige E-Mail' : 'Invalid Email',
        description: language === 'de' ? 'Bitte geben Sie eine gültige E-Mail-Adresse ein.' : 'Please enter a valid email address.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Clear any stale auth state before making the request
      await supabase.auth.signOut();

      const response = await supabase.functions.invoke('request-verification-code', {
        body: { email, type: 'password_reset' },
      });

      if (response.error || response.data?.error) {
        throw new Error(response.data?.error || response.error?.message || 'Fehler');
      }

      setStep('reset_password');
      
      toast({
        title: language === 'de' ? 'Code gesendet' : 'Code Sent',
        description: language === 'de' 
          ? 'Falls ein Konto existiert, wurde ein Reset-Code gesendet.' 
          : 'If an account exists, a reset code has been sent.',
      });
    } catch (error: any) {
      toast({
        title: language === 'de' ? 'Fehler' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle 2FA Code Verification for Login
  const handleLoginCodeVerification = async () => {
    if (code.length !== 6) {
      toast({
        title: language === 'de' ? 'Ungültiger Code' : 'Invalid Code',
        description: language === 'de' ? 'Bitte geben Sie den 6-stelligen Code ein.' : 'Please enter the 6-digit code.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const response = await supabase.functions.invoke('verify-code', {
        body: { email, code, type: 'login' },
      });

      if (response.error || response.data?.error) {
        throw new Error(response.data?.error || response.error?.message || 'Fehler bei der Verifizierung');
      }

      // Use the token to sign in
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: response.data.token,
        type: 'magiclink',
      });

      if (verifyError) {
        throw verifyError;
      }

      toast({
        title: language === 'de' ? 'Erfolgreich' : 'Success',
        description: language === 'de' ? 'Anmeldung erfolgreich!' : 'Login successful!',
      });

      // Check if patient has existing submissions → dashboard, otherwise onboarding
      const { data: existingSub } = await supabase
        .from('anamnesis_submissions')
        .select('id')
        .eq('status', 'verified')
        .limit(1)
        .maybeSingle();

      navigate(existingSub ? '/dashboard' : '/erstanmeldung');
    } catch (error: any) {
      toast({
        title: language === 'de' ? 'Fehler' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle Registration Code Verification (creates user with password)
  const handleRegistrationCodeVerification = async () => {
    if (code.length !== 6) {
      toast({
        title: language === 'de' ? 'Ungültiger Code' : 'Invalid Code',
        description: language === 'de' ? 'Bitte geben Sie den 6-stelligen Code ein.' : 'Please enter the 6-digit code.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const response = await supabase.functions.invoke('verify-code', {
        body: { email, code, type: 'registration' },
      });


      if (response.error || response.data?.error) {
        throw new Error(response.data?.error || response.error?.message || 'Fehler bei der Verifizierung');
      }

      // Now sign in with the new account
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw signInError;
      }

      toast({
        title: language === 'de' ? 'Erfolgreich' : 'Success',
        description: language === 'de' ? 'Registrierung erfolgreich! Sie sind jetzt angemeldet.' : 'Registration successful! You are now logged in.',
      });

      // Send notification to practice for existing patients
      if (isExistingPatient) {
        try {
          await supabase.functions.invoke('notify-existing-patient', {
            body: { email, patientType: 'existing_patient' },
          });
          toast({
            title: 'Freischaltung beantragt',
            description: 'Die Praxis wurde benachrichtigt. Sie erhalten Zugriff auf alle Inhalte, sobald Ihre Identität bestätigt wurde.',
          });
        } catch (err) {
          console.error('Failed to send notification:', err);
        }
      } else {
        // New patients: notify practice too
        try {
          await supabase.functions.invoke('notify-existing-patient', {
            body: { email, patientType: 'new_patient' },
          });
        } catch (err) {
          console.error('Failed to send notification:', err);
        }
      }

      navigate('/erstanmeldung');
    } catch (error: any) {
      toast({
        title: language === 'de' ? 'Fehler' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle Password Reset with Code
  const handlePasswordResetVerification = async () => {
    if (code.length !== 6) {
      toast({
        title: language === 'de' ? 'Ungültiger Code' : 'Invalid Code',
        description: language === 'de' ? 'Bitte geben Sie den 6-stelligen Code ein.' : 'Please enter the 6-digit code.',
        variant: 'destructive',
      });
      return;
    }

    try {
      passwordSchema.parse(newPassword);
    } catch {
      toast({
        title: language === 'de' ? 'Ungültiges Passwort' : 'Invalid Password',
        description: language === 'de' ? 'Passwort muss mindestens 8 Zeichen lang sein.' : 'Password must be at least 8 characters.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const response = await supabase.functions.invoke('verify-code', {
        body: { email, code, type: 'password_reset', newPassword },
      });

      if (response.error || response.data?.error) {
        throw new Error(response.data?.error || response.error?.message || 'Fehler');
      }

      toast({
        title: language === 'de' ? 'Passwort geändert' : 'Password Changed',
        description: language === 'de' 
          ? 'Ihr Passwort wurde erfolgreich geändert. Sie können sich jetzt anmelden.' 
          : 'Your password has been successfully changed. You can now log in.',
      });

      // Reset to login
      setMode('login');
      setStep('credentials');
      setCode('');
      setNewPassword('');
      setPassword('');
    } catch (error: any) {
      toast({
        title: language === 'de' ? 'Fehler' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setLoading(true);

    try {
      const type = mode === 'password_reset' ? 'password_reset' : mode;
      const body: Record<string, string> = { email, type };
      if (userId) body.userId = userId;
      const response = await supabase.functions.invoke('request-verification-code', {
        body,
      });

      if (response.error || response.data?.error) {
        throw new Error(response.data?.error || response.error?.message || 'Fehler');
      }

      toast({
        title: language === 'de' ? 'Code erneut gesendet' : 'Code Resent',
        description: language === 'de' 
          ? 'Ein neuer Code wurde an Ihre E-Mail gesendet.' 
          : 'A new code has been sent to your email.',
      });
    } catch (error: any) {
      toast({
        title: language === 'de' ? 'Fehler' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep('credentials');
    setCode('');
  };

  const handleModeChange = (newMode: string) => {
    setMode(newMode as AuthMode);
    setStep('credentials');
    setCode('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setNewPassword('');
  };

  const renderCredentialsStep = () => (
    <Tabs value={mode} onValueChange={handleModeChange} className="w-full">
      <TabsList className="grid w-full grid-cols-2 mb-6">
        <TabsTrigger value="login" className="flex items-center gap-2">
          <LogIn className="h-4 w-4" />
          {language === 'de' ? 'Anmelden' : 'Login'}
        </TabsTrigger>
        <TabsTrigger value="registration" className="flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          {language === 'de' ? 'Registrieren' : 'Register'}
        </TabsTrigger>
      </TabsList>

      {/* Login Tab */}
      <TabsContent value="login">
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-login">
              {language === 'de' ? 'E-Mail-Adresse' : 'Email Address'}
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email-login"
                type="email"
                placeholder="ihre.email@beispiel.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
                disabled={loading}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password-login">
              {language === 'de' ? 'Passwort' : 'Password'}
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password-login"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {language === 'de' ? 'Wird geprüft...' : 'Checking...'}
              </>
            ) : (
              language === 'de' ? 'Anmelden' : 'Login'
            )}
          </Button>

          <Button
            type="button"
            variant="link"
            className="w-full text-sm"
            onClick={() => handleModeChange('password_reset')}
          >
            <KeyRound className="mr-2 h-4 w-4" />
            {language === 'de' ? 'Passwort vergessen?' : 'Forgot password?'}
          </Button>
        </form>
      </TabsContent>

      {/* Registration Tab */}
      <TabsContent value="registration">
        <form onSubmit={handleRegistrationSubmit} className="space-y-4">
          {!isExistingPatient && (
            <div className="rounded-xl border-2 border-primary/30 bg-sage-50 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div className="space-y-2 text-sm">
                  <p className="font-serif font-semibold text-foreground text-base">
                    {language === 'de' ? 'Bevor Du Dich registrierst — bitte kurz lesen:' : 'Before you register — please read:'}
                  </p>
                  <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground leading-relaxed">
                    <li>
                      {language === 'de'
                        ? 'Das Erstgespräch dauert ca. 90 Minuten und ist nur nach telefonischer Terminvereinbarung möglich.'
                        : 'The first consultation lasts ~90 min and requires a phone appointment.'}
                    </li>
                    <li>
                      {language === 'de' ? (
                        <>
                          Die <strong>Wartezeit</strong> auf einen Ersttermin schwankt je nach Auslastung — aktuell ca. <strong>2 Wochen</strong>, in stärker gebuchten Phasen auch <strong>mehrere Wochen</strong>. Bitte ruf vorab an: <a href="tel:08212621462" className="text-primary font-medium hover:underline">0821 - 2621462</a> (AB → ich rufe zurück).
                        </>
                      ) : (
                        <>
                          Waiting time for a first appointment varies — currently ~<strong>2 weeks</strong>, in busy periods <strong>several weeks</strong>. Please call first: <a href="tel:08212621462" className="text-primary font-medium hover:underline">0821 - 2621462</a>.
                        </>
                      )}
                    </li>
                    <li>
                      {language === 'de'
                        ? 'Der Anamnesebogen ist nur dann sinnvoll, wenn Du auch wirklich zum Termin kommst — er bleibt ansonsten ungenutzt.'
                        : 'The anamnesis form only makes sense if you actually come to the appointment.'}
                    </li>
                    <li>
                      {language === 'de' ? (
                        <>Ablauf, Methoden und Kosten findest Du im Artikel <a href="/therapieweg-uebersicht.html" target="_blank" rel="noopener" className="text-primary font-medium hover:underline">„Ihr Therapieweg"</a>.</>
                      ) : (
                        <>Procedure, methods and costs are described in our article <a href="/therapieweg-uebersicht.html" target="_blank" rel="noopener" className="text-primary font-medium hover:underline">"Your Therapy Path"</a>.</>
                      )}
                    </li>
                  </ul>
                </div>
              </div>

              <label className="flex items-start gap-2 cursor-pointer rounded-lg bg-background border border-border p-3 hover:border-primary/50 transition-colors">
                <input
                  type="checkbox"
                  checked={acceptedPracticeNotice}
                  onChange={(e) => setAcceptedPracticeNotice(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-primary shrink-0"
                  disabled={loading}
                />
                <span className="text-sm leading-relaxed text-foreground">
                  {language === 'de'
                    ? 'Ich habe gelesen, dass ich zuerst telefonisch einen Termin vereinbare und dass die Wartezeit je nach Auslastung von ca. 2 Wochen bis zu mehreren Wochen betragen kann.'
                    : 'I have read that I need to call first to book an appointment and that waiting time varies from ~2 weeks up to several weeks depending on workload.'}
                </span>
              </label>
            </div>
          )}

          {isExistingPatient && (
            <Alert className="bg-sage-50 border-sage-200">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription className="text-sm">
                {language === 'de'
                  ? 'Als bestehender Patient: Nach der Registrierung wird die Praxis informiert und Ihren Zugang freischalten.'
                  : 'As an existing patient: After registration, the practice will be notified and will activate your access.'}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email-register">
              {language === 'de' ? 'E-Mail-Adresse' : 'Email Address'}
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email-register"
                type="email"
                placeholder="ihre.email@beispiel.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password-register">
              {language === 'de' ? 'Passwort (mind. 8 Zeichen)' : 'Password (min. 8 characters)'}
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password-register"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10"
                required
                disabled={loading}
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">
              {language === 'de' ? 'Passwort bestätigen' : 'Confirm Password'}
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10"
                required
                disabled={loading}
                minLength={8}
              />
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            {language === 'de'
              ? 'Nach der Registrierung kannst Du den ausfüllbaren PDF-Anamnesebogen herunterladen. Die Online-Eingabe ist aus Datenschutzgründen aktuell deaktiviert.'
              : 'After registration, you can download the fillable PDF anamnesis form. Online entry is currently disabled for data-protection reasons.'}
          </p>


          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {language === 'de' ? 'Wird gesendet...' : 'Sending...'}
              </>
            ) : (
              language === 'de' ? 'Registrieren' : 'Register'
            )}
          </Button>
        </form>
      </TabsContent>

      {/* Password Reset Tab */}
      <TabsContent value="password_reset">
        <form onSubmit={handlePasswordResetRequest} className="space-y-4">
          <div className="text-center mb-4">
            <KeyRound className="mx-auto h-12 w-12 text-primary mb-2" />
            <h3 className="font-semibold">
              {language === 'de' ? 'Passwort zurücksetzen' : 'Reset Password'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {language === 'de' 
                ? 'Geben Sie Ihre E-Mail-Adresse ein, um einen Reset-Code zu erhalten.' 
                : 'Enter your email address to receive a reset code.'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-reset">
              {language === 'de' ? 'E-Mail-Adresse' : 'Email Address'}
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email-reset"
                type="email"
                placeholder="ihre.email@beispiel.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
                disabled={loading}
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {language === 'de' ? 'Wird gesendet...' : 'Sending...'}
              </>
            ) : (
              language === 'de' ? 'Reset-Code senden' : 'Send Reset Code'
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => handleModeChange('login')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {language === 'de' ? 'Zurück zum Login' : 'Back to Login'}
          </Button>
        </form>
      </TabsContent>
    </Tabs>
  );

  const renderVerificationStep = () => (
    <div className="space-y-6">
      <Button
        variant="ghost"
        onClick={handleBack}
        className="mb-2 -ml-2"
        disabled={loading}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {language === 'de' ? 'Zurück' : 'Back'}
      </Button>

      <div className="text-center space-y-2">
        <h3 className="font-semibold text-lg">
          {mode === 'login' 
            ? (language === 'de' ? '2FA-Bestätigungscode' : '2FA Verification Code')
            : (language === 'de' ? 'E-Mail bestätigen' : 'Confirm Email')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {language === 'de' 
            ? `Wir haben einen 6-stelligen Code an ${email} gesendet.` 
            : `We sent a 6-digit code to ${email}.`}
        </p>
      </div>

      <div className="flex justify-center">
        <InputOTP
          maxLength={6}
          value={code}
          onChange={(value) => setCode(value)}
          disabled={loading}
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
      </div>

      <Button 
        onClick={mode === 'login' ? handleLoginCodeVerification : handleRegistrationCodeVerification} 
        className="w-full" 
        disabled={loading || code.length !== 6}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {language === 'de' ? 'Wird verifiziert...' : 'Verifying...'}
          </>
        ) : (
          language === 'de' ? 'Bestätigen' : 'Verify'
        )}
      </Button>

      <div className="text-center">
        <Button
          variant="link"
          onClick={handleResendCode}
          disabled={loading}
          className="text-sm"
        >
          {language === 'de' ? 'Code erneut senden' : 'Resend code'}
        </Button>
      </div>
    </div>
  );

  const renderPasswordResetStep = () => (
    <div className="space-y-6">
      <Button
        variant="ghost"
        onClick={() => {
          setMode('login');
          setStep('credentials');
        }}
        className="mb-2 -ml-2"
        disabled={loading}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {language === 'de' ? 'Zurück' : 'Back'}
      </Button>

      <div className="text-center space-y-2">
        <KeyRound className="mx-auto h-12 w-12 text-primary" />
        <h3 className="font-semibold text-lg">
          {language === 'de' ? 'Neues Passwort setzen' : 'Set New Password'}
        </h3>
        <p className="text-sm text-muted-foreground">
          {language === 'de' 
            ? `Geben Sie den Code aus der E-Mail an ${email} ein.` 
            : `Enter the code from the email sent to ${email}.`}
        </p>
      </div>

      <div className="flex justify-center">
        <InputOTP
          maxLength={6}
          value={code}
          onChange={(value) => setCode(value)}
          disabled={loading}
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
      </div>

      <div className="space-y-2">
        <Label htmlFor="new-password">
          {language === 'de' ? 'Neues Passwort (mind. 8 Zeichen)' : 'New Password (min. 8 characters)'}
        </Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="new-password"
            type={showNewPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="pl-10 pr-10"
            required
            disabled={loading}
            minLength={8}
          />
          <button
            type="button"
            onClick={() => setShowNewPassword(!showNewPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <Button 
        onClick={handlePasswordResetVerification} 
        className="w-full" 
        disabled={loading || code.length !== 6 || newPassword.length < 8}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {language === 'de' ? 'Wird gespeichert...' : 'Saving...'}
          </>
        ) : (
          language === 'de' ? 'Passwort ändern' : 'Change Password'
        )}
      </Button>

      <div className="text-center">
        <Button
          variant="link"
          onClick={handleResendCode}
          disabled={loading}
          className="text-sm"
        >
          {language === 'de' ? 'Code erneut senden' : 'Resend code'}
        </Button>
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">
              {isExistingPatient 
                ? (language === 'de' ? 'Bestehender Patient' : 'Existing Patient')
                : patientType === 'new_patient'
                  ? (language === 'de' ? 'Neupatient – Registrierung' : 'New Patient – Registration')
                  : (language === 'de' ? 'Praxis-Login' : 'Practice Login')
              }
            </CardTitle>
            <CardDescription>
              {isExistingPatient
                ? (language === 'de' 
                    ? 'Melden Sie sich an oder registrieren Sie sich. Nach der Registrierung wird die Praxis benachrichtigt und schaltet Ihren Zugang frei.' 
                    : 'Log in or register. After registration, the practice will be notified and will activate your access.')
                : patientType === 'new_patient'
                  ? (language === 'de'
                    ? 'Registrieren Sie sich, um Ihren Anamnesebogen online auszufüllen.'
                    : 'Register to fill out your medical history form online.')
                  : (language === 'de' 
                    ? 'Sichere Anmeldung mit Passwort und 2FA' 
                    : 'Secure login with password and 2FA')
              }
            </CardDescription>
          </CardHeader>

          <CardContent>
            {step === 'credentials' && renderCredentialsStep()}
            {step === 'verification' && renderVerificationStep()}
            {step === 'reset_password' && renderPasswordResetStep()}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Auth;
