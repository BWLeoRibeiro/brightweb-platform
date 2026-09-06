-- atomic_invitation_contact_link
-- target: crm
-- created_at: 2026-09-06T10:16:16.695Z

-- This integration is installed after orgs and is never required by an orgs-only app.
CREATE OR REPLACE FUNCTION public.link_organization_invitation_contact(p_profile_id uuid, p_organization_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_contact public.crm_contacts%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v_profile FROM public.profiles WHERE id = p_profile_id FOR UPDATE;
  SELECT * INTO v_contact FROM public.crm_contacts
    WHERE profile_id = p_profile_id OR lower(btrim(email)) = lower(btrim(v_profile.email))
    ORDER BY (profile_id = p_profile_id) DESC NULLS LAST, id LIMIT 1 FOR UPDATE;
  IF FOUND THEN
    IF v_contact.profile_id IS NOT NULL AND v_contact.profile_id <> p_profile_id THEN
      RAISE EXCEPTION 'O contacto CRM já está ligado a outro perfil.';
    END IF;
    UPDATE public.crm_contacts SET profile_id = p_profile_id WHERE id = v_contact.id;
  ELSE
    INSERT INTO public.crm_contacts(profile_id, first_name, last_name, email, status, source, organization_id)
      VALUES(p_profile_id, v_profile.first_name, v_profile.last_name, lower(btrim(v_profile.email)), 'lead',
        'organization_invitation_accept', p_organization_id) RETURNING * INTO v_contact;
  END IF;
  PERFORM public.link_crm_contact_organization(v_contact.id, p_organization_id);
  RETURN v_contact.id;
END;
$$;
REVOKE ALL ON FUNCTION public.link_organization_invitation_contact(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_organization_invitation_contact(uuid, uuid) TO service_role;
