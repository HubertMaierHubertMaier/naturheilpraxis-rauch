CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'delete-quarantined-therapy-sessions',
  '0 3 * * *',
  $$DELETE FROM public.therapy_sessions
    WHERE typ = 'quarantine_patient_mismatch'
      AND created_at < now() - interval '30 days'$$
);