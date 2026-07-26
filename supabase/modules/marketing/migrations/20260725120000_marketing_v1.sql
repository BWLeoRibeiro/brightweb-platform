-- Brightweb Marketing v1: consent, contact preferences, and suppression.

CREATE TABLE IF NOT EXISTS public.marketing_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.marketing_topics (slug, label, description, position)
VALUES
  ('newsletter', 'Newsletter', 'News, stories, and practical updates from BrightWeb.', 0),
  ('product-updates', 'Product updates & events', 'Product announcements, releases, and events.', 10)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.marketing_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.marketing_topics(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'subscribed',
  consent_source text,
  consent_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketing_subscriptions_status_check
    CHECK (status IN ('subscribed', 'unsubscribed')),
  CONSTRAINT marketing_subscriptions_contact_topic_unique
    UNIQUE (contact_id, topic_id)
);

CREATE INDEX IF NOT EXISTS idx_marketing_subscriptions_contact_id
  ON public.marketing_subscriptions (contact_id);

CREATE INDEX IF NOT EXISTS idx_marketing_subscriptions_topic_id
  ON public.marketing_subscriptions (topic_id);

CREATE TABLE IF NOT EXISTS public.marketing_contact_settings (
  contact_id uuid PRIMARY KEY REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  preferred_language text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketing_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  reason text NOT NULL,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketing_suppressions_email_lowercase_check
    CHECK (email = lower(trim(email))),
  CONSTRAINT marketing_suppressions_reason_check
    CHECK (reason IN ('bounced', 'complained', 'unsubscribed_all', 'manual'))
);

CREATE INDEX IF NOT EXISTS idx_marketing_suppressions_email
  ON public.marketing_suppressions (email);

CREATE OR REPLACE FUNCTION public.set_marketing_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_marketing_topics_updated_at ON public.marketing_topics;
CREATE TRIGGER set_marketing_topics_updated_at
BEFORE UPDATE ON public.marketing_topics
FOR EACH ROW
EXECUTE FUNCTION public.set_marketing_updated_at();

DROP TRIGGER IF EXISTS set_marketing_subscriptions_updated_at ON public.marketing_subscriptions;
CREATE TRIGGER set_marketing_subscriptions_updated_at
BEFORE UPDATE ON public.marketing_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.set_marketing_updated_at();

DROP TRIGGER IF EXISTS set_marketing_contact_settings_updated_at ON public.marketing_contact_settings;
CREATE TRIGGER set_marketing_contact_settings_updated_at
BEFORE UPDATE ON public.marketing_contact_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_marketing_updated_at();

ALTER TABLE public.marketing_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_contact_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_suppressions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages marketing topics" ON public.marketing_topics;
CREATE POLICY "Service role manages marketing topics"
  ON public.marketing_topics FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages marketing subscriptions" ON public.marketing_subscriptions;
CREATE POLICY "Service role manages marketing subscriptions"
  ON public.marketing_subscriptions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages marketing contact settings" ON public.marketing_contact_settings;
CREATE POLICY "Service role manages marketing contact settings"
  ON public.marketing_contact_settings FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages marketing suppressions" ON public.marketing_suppressions;
CREATE POLICY "Service role manages marketing suppressions"
  ON public.marketing_suppressions FOR ALL TO service_role
  USING (true) WITH CHECK (true);
