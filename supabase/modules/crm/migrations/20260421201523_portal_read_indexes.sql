-- portal_read_indexes
-- target: crm
-- created_at: 2026-04-21T20:15:23.686Z

CREATE INDEX IF NOT EXISTS idx_crm_contacts_updated_at_desc
  ON public.crm_contacts (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_contacts_created_at_desc
  ON public.crm_contacts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_contacts_status
  ON public.crm_contacts (status);

CREATE INDEX IF NOT EXISTS idx_crm_contacts_source
  ON public.crm_contacts (source)
  WHERE source IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_status_log_changed_at_desc
  ON public.crm_status_log (changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_organizations_created_at_desc
  ON public.organizations (created_at DESC);
