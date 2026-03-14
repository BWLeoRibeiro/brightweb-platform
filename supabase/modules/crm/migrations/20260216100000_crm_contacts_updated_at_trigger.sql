-- Ensure crm_contacts.updated_at is always refreshed on every UPDATE.

CREATE OR REPLACE FUNCTION public.set_crm_contacts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_crm_contacts_updated_at ON public.crm_contacts;

CREATE TRIGGER set_crm_contacts_updated_at
BEFORE UPDATE ON public.crm_contacts
FOR EACH ROW
EXECUTE FUNCTION public.set_crm_contacts_updated_at();
