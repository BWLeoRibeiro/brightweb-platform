-- Each direct assignment, including database integration and reconciliation, commits together.
CREATE OR REPLACE FUNCTION public.assign_organization_member_atomic(
  p_organization_id uuid, p_profile_id uuid, p_email text, p_role text, p_actor_profile_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_role text;
  v_inserted boolean;
  v_status text;
  v_contact_id uuid;
BEGIN
  IF p_role IS NULL OR p_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'Função de membro inválida.';
  END IF;
  IF p_email IS NULL OR btrim(p_email) = '' THEN
    RAISE EXCEPTION 'Email de membro inválido.';
  END IF;
  PERFORM id FROM public.profiles WHERE id = p_actor_profile_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil do autor não encontrado.'; END IF;

  -- Match acceptance's invitation -> profile -> organization lock order. Lock
  -- terminal rows too: acceptance may still be checking an idempotent retry.
  PERFORM id FROM public.organization_invitations
    WHERE organization_id = p_organization_id AND lower(btrim(invited_email)) = lower(btrim(p_email))
    ORDER BY id FOR UPDATE;
  PERFORM id FROM public.profiles WHERE id = p_profile_id
    AND lower(btrim(email)) = lower(btrim(p_email)) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'O perfil não corresponde ao email do membro.'; END IF;
  PERFORM id FROM public.organizations WHERE id = p_organization_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Organização não encontrada.'; END IF;

  -- A writer outside this RPC may have inserted since the caller's snapshot.
  -- Wait for that row, then derive the outcome from its committed current role.
  INSERT INTO public.organization_members(organization_id, profile_id, role)
    VALUES(p_organization_id, p_profile_id, p_role)
    ON CONFLICT(organization_id, profile_id) DO NOTHING;
  v_inserted := FOUND;
  SELECT role INTO STRICT v_role FROM public.organization_members
    WHERE organization_id = p_organization_id AND profile_id = p_profile_id FOR UPDATE;
  IF v_inserted THEN v_status := 'immediate_access';
  ELSIF v_role = p_role THEN v_status := 'already_member';
  ELSE
    UPDATE public.organization_members SET role = p_role
      WHERE organization_id = p_organization_id AND profile_id = p_profile_id;
    v_status := 'membership_updated';
  END IF;

  BEGIN
    -- Client-owned SQL is transactional and takes precedence over stock CRM.
    IF to_regprocedure('public.client_organization_invitation_contact_hook(uuid,uuid)') IS NOT NULL THEN
      EXECUTE 'SELECT public.client_organization_invitation_contact_hook($1, $2)' INTO v_contact_id
        USING p_profile_id, p_organization_id;
    ELSIF to_regclass('public.crm_contacts') IS NOT NULL THEN
      IF to_regprocedure('public.link_organization_invitation_contact(uuid,uuid)') IS NULL THEN
        RAISE EXCEPTION 'Aplique a migration atomic_invitation_contact_link.';
      END IF;
      EXECUTE 'SELECT public.link_organization_invitation_contact($1, $2)' INTO v_contact_id
        USING p_profile_id, p_organization_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'ORGANIZATION_CONTACT_LINK_FAILED: %', SQLERRM USING ERRCODE = 'BW001';
  END;

  UPDATE public.organizations SET primary_contact_id = (
    SELECT profile_id FROM public.organization_members
      WHERE organization_id = p_organization_id AND role = 'admin'
      ORDER BY joined_at, profile_id LIMIT 1
  ) WHERE id = p_organization_id;
  UPDATE public.organization_invitations SET status = 'accepted', accepted_at = now(),
    accepted_by_profile_id = p_profile_id, accepted_contact_id = v_contact_id
    WHERE organization_id = p_organization_id AND lower(btrim(invited_email)) = lower(btrim(p_email))
      AND status = 'pending';
  RETURN jsonb_build_object('status', v_status, 'profileId', p_profile_id, 'organizationId', p_organization_id);
END;
$$;
REVOKE ALL ON FUNCTION public.assign_organization_member_atomic(uuid, uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_organization_member_atomic(uuid, uuid, text, text, uuid) TO service_role;
