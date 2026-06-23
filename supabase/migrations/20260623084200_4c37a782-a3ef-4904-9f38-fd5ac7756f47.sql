CREATE TABLE public.email_send_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recipient TEXT NOT NULL,
  subject TEXT,
  context TEXT,
  from_addr TEXT,
  http_status INT,
  relay_success BOOLEAN,
  relay_message TEXT,
  relay_version TEXT,
  error_message TEXT,
  duration_ms INT,
  has_attachment BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_email_send_log_created ON public.email_send_log (created_at DESC);
CREATE INDEX idx_email_send_log_recipient ON public.email_send_log (lower(recipient));

GRANT SELECT ON public.email_send_log TO authenticated;
GRANT ALL ON public.email_send_log TO service_role;

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read email logs"
ON public.email_send_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
