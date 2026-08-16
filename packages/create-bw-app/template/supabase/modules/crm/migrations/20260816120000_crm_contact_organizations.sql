-- Compatibility-first multi-organization CRM contacts.
-- crm_contacts.organization_id remains the primary organization projection while
-- this link table records every organization relationship.

CREATE TABLE IF NOT EXISTS public.crm_contact_organizations (
  contact_id uuid NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (contact_id, organization_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_contact_organizations_one_primary_idx
  ON public.crm_contact_organizations (contact_id)
  WHERE is_primary;

CREATE INDEX IF NOT EXISTS crm_contact_organizations_organization_idx
  ON public.crm_contact_organizations (organization_id, contact_id);

INSERT INTO public.crm_contact_organizations (contact_id, organization_id, is_primary)
SELECT contact.id, contact.organization_id, true
FROM public.crm_contacts contact
WHERE contact.organization_id IS NOT NULL
ON CONFLICT (contact_id, organization_id) DO UPDATE SET is_primary = true;

CREATE OR REPLACE FUNCTION public.sync_crm_contact_primary_organization_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.crm_contact_organizations
  SET is_primary = false
  WHERE contact_id = NEW.id
    AND is_primary;

  IF NEW.organization_id IS NOT NULL THEN
    INSERT INTO public.crm_contact_organizations (contact_id, organization_id, is_primary)
    VALUES (NEW.id, NEW.organization_id, true)
    ON CONFLICT (contact_id, organization_id)
    DO UPDATE SET is_primary = true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_crm_contact_primary_organization_link ON public.crm_contacts;
CREATE TRIGGER trg_sync_crm_contact_primary_organization_link
AFTER INSERT OR UPDATE OF organization_id ON public.crm_contacts
FOR EACH ROW
EXECUTE FUNCTION public.sync_crm_contact_primary_organization_link();

CREATE OR REPLACE FUNCTION public.link_crm_contact_organization(
  p_contact_id uuid,
  p_organization_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_primary_organization_id uuid;
BEGIN
  SELECT organization_id
  INTO v_primary_organization_id
  FROM public.crm_contacts
  WHERE id = p_contact_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CRM contact not found';
  END IF;

  IF v_primary_organization_id IS NULL THEN
    UPDATE public.crm_contacts
    SET organization_id = p_organization_id
    WHERE id = p_contact_id;
  ELSE
    INSERT INTO public.crm_contact_organizations (contact_id, organization_id, is_primary)
    VALUES (p_contact_id, p_organization_id, v_primary_organization_id = p_organization_id)
    ON CONFLICT (contact_id, organization_id) DO NOTHING;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.link_crm_contact_organization(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_crm_contact_organization(uuid, uuid)
  TO service_role;

ALTER TABLE public.crm_contact_organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage crm contact organizations" ON public.crm_contact_organizations;
CREATE POLICY "Staff manage crm contact organizations"
  ON public.crm_contact_organizations
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());
