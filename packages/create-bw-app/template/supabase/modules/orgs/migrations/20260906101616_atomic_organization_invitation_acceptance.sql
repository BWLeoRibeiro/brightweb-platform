-- atomic_organization_invitation_acceptance
-- target: orgs
-- created_at: 2026-09-06T10:16:16.656Z

CREATE OR REPLACE FUNCTION public.accept_organization_invitation(p_invitation_id uuid, p_profile_id uuid, p_user_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_invitation public.organization_invitations%ROWTYPE;
  v_contact_id uuid;
BEGIN
  SELECT * INTO v_invitation FROM public.organization_invitations WHERE id = p_invitation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Convite não encontrado.'; END IF;
  IF lower(btrim(p_user_email)) IS DISTINCT FROM lower(btrim(v_invitation.invited_email)) THEN
    RAISE EXCEPTION 'Este convite pertence a outro email.';
  END IF;
  -- Only the service role can call this RPC; the server supplies the authenticated
  -- user's email. Require the matching auth-linked profile without granting auth-table access.
  PERFORM p.id FROM public.profiles p
    WHERE p.id = p_profile_id AND p.user_id IS NOT NULL
      AND lower(btrim(p.email)) = lower(btrim(v_invitation.invited_email))
    FOR UPDATE OF p;
  IF NOT FOUND THEN RAISE EXCEPTION 'Este convite pertence a outro email.'; END IF;
  IF v_invitation.status = 'accepted' AND v_invitation.accepted_by_profile_id = p_profile_id THEN
    RETURN jsonb_build_object('status', 'accepted', 'organizationId', v_invitation.organization_id);
  END IF;
  IF v_invitation.status <> 'pending' THEN RAISE EXCEPTION 'Este convite já não está disponível.'; END IF;
  IF v_invitation.expires_at <= clock_timestamp() THEN
    UPDATE public.organization_invitations SET status = 'expired' WHERE id = p_invitation_id;
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  -- Serialize different invitations for the same organization's primary-contact choice.
  PERFORM id FROM public.organizations WHERE id = v_invitation.organization_id FOR UPDATE;
  -- Client-owned integration takes precedence; package updates never create or replace it.
  IF to_regprocedure('public.client_organization_invitation_contact_hook(uuid,uuid)') IS NOT NULL THEN
    EXECUTE 'SELECT public.client_organization_invitation_contact_hook($1, $2)' INTO v_contact_id
      USING p_profile_id, v_invitation.organization_id;
  ELSIF to_regclass('public.crm_contacts') IS NOT NULL THEN
    IF to_regprocedure('public.link_organization_invitation_contact(uuid,uuid)') IS NULL THEN
      RAISE EXCEPTION 'Aplique a migration atomic_invitation_contact_link antes de aceitar o convite.';
    END IF;
    EXECUTE 'SELECT public.link_organization_invitation_contact($1, $2)' INTO v_contact_id
      USING p_profile_id, v_invitation.organization_id;
  END IF;
  INSERT INTO public.organization_members(organization_id, profile_id, role)
    VALUES(v_invitation.organization_id, p_profile_id, v_invitation.role)
    ON CONFLICT(organization_id, profile_id) DO UPDATE SET role = EXCLUDED.role;
    UPDATE public.organizations SET primary_contact_id = (
      SELECT profile_id FROM public.organization_members WHERE organization_id = v_invitation.organization_id AND role = 'admin'
      ORDER BY joined_at, profile_id LIMIT 1
    ) WHERE id = v_invitation.organization_id;
  UPDATE public.organization_invitations SET status = 'accepted', accepted_at = now(), accepted_by_profile_id = p_profile_id,
    accepted_contact_id = v_contact_id WHERE id = p_invitation_id;
  PERFORM public.log_app_activity_event('crm', 'crm_organization_invitation_accepted', 'organizations', v_invitation.organization_id,
    'Convite de organização aceite.', jsonb_build_object('invitation_id', p_invitation_id,
      'organization_id', v_invitation.organization_id, 'email', v_invitation.invited_email), p_profile_id);
  RETURN jsonb_build_object('status', 'accepted', 'organizationId', v_invitation.organization_id);
END;
$$;
REVOKE ALL ON FUNCTION public.accept_organization_invitation(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_organization_invitation(uuid, uuid, text) TO service_role;
