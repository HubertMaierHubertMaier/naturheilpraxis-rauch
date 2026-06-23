import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

const SCRIPT_ID = 'cf-turnstile-script';
let siteKeyCache: string | null = null;

async function fetchSiteKey(): Promise<string> {
  if (siteKeyCache) return siteKeyCache;
  const { data, error } = await supabase.functions.invoke('get-turnstile-config');
  if (error) throw error;
  siteKeyCache = (data as { siteKey?: string })?.siteKey || '';
  return siteKeyCache;
}

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) return resolve();
    let s = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!s) {
      s = document.createElement('script');
      s.id = SCRIPT_ID;
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit';
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    }
    window.onTurnstileLoad = () => resolve();
    s.addEventListener('error', () => reject(new Error('Turnstile-Skript konnte nicht geladen werden')));
    // Fallback if already loaded
    const t = setInterval(() => {
      if (window.turnstile) { clearInterval(t); resolve(); }
    }, 100);
    setTimeout(() => clearInterval(t), 10000);
  });
}

interface Props {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  language?: 'de' | 'en';
}

export const TurnstileWidget: React.FC<Props> = ({ onVerify, onExpire, language = 'de' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  const [error, setError] = useState<string | null>(null);

  // Callbacks immer aktuell halten, ohne Widget neu zu mounten
  useEffect(() => { onVerifyRef.current = onVerify; }, [onVerify]);
  useEffect(() => { onExpireRef.current = onExpire; }, [onExpire]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const siteKey = await fetchSiteKey();
        if (!siteKey) {
          setError(language === 'de' ? 'Bot-Schutz nicht konfiguriert' : 'Bot protection not configured');
          return;
        }
        await loadScript();
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => onVerifyRef.current?.(token),
          'expired-callback': () => onExpireRef.current?.(),
          'error-callback': () => setError(language === 'de' ? 'Bot-Prüfung fehlgeschlagen' : 'Bot check failed'),
          theme: 'light',
          language: language === 'de' ? 'de' : 'en',
        });
      } catch (e: any) {
        setError(e?.message || 'Turnstile error');
      }
    })();
    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch { /* noop */ }
      }
    };
  }, [language]);

  return (
    <div className="space-y-1">
      <div ref={containerRef} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
};
