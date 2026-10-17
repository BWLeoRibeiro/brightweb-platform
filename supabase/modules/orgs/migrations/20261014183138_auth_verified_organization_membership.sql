-- auth_verified_organization_membership
-- target: orgs
-- created_at: 2026-10-14T18:31:38.382Z

-- One atomic statement protects old CLI/manual continue-on-error application:
-- failed prerequisites or later DDL leave every existing guard/function intact.
DO $identity_migration$
BEGIN
  IF to_regprocedure('public.assert_profile_auth_identity_v1()') IS NULL THEN
    RAISE EXCEPTION 'IDENTITY_MIGRATION_REQUIRED: apply Core 20261014183138_protect_profile_identity before Admin/Orgs identity migrations.' USING ERRCODE = '55000';
  END IF;
  PERFORM public.assert_profile_auth_identity_v1();
  EXECUTE $identity_ddl$
-- Each direct assignment, including database integration and reconciliation, commits together.
CREATE OR REPLACE FUNCTION public.assign_organization_member_atomic(
  p_organization_id uuid, p_profile_id uuid, p_email text, p_role text, p_actor_profile_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_user_id uuid;
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

  -- Auth -> ordered invitations -> profile -> organisation -> membership.
  v_user_id := public.lock_confirmed_profile_auth_identity(p_profile_id, p_email);
  PERFORM id FROM public.organization_invitations
    WHERE organization_id = p_organization_id AND lower(btrim(invited_email)) = lower(btrim(p_email))
    ORDER BY id FOR UPDATE;
  PERFORM id FROM public.profiles WHERE id = p_profile_id AND user_id = v_user_id
    AND lower(btrim(email)) = lower(btrim(p_email)) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'O perfil não corresponde ao email do membro.' USING ERRCODE = 'BW002'; END IF;
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

-- atomic_organization_invitation_acceptance
-- target: orgs
-- created_at: 2026-09-06T10:16:16.656Z

CREATE OR REPLACE FUNCTION public.accept_organization_invitation(p_invitation_id uuid, p_profile_id uuid, p_user_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_invitation public.organization_invitations%ROWTYPE;
  v_user_id uuid;
  v_contact_id uuid;
BEGIN
  v_user_id := public.lock_confirmed_profile_auth_identity(p_profile_id, p_user_email);
  -- Lock the same ordered set as direct assignment, including terminal retries.
  SELECT * INTO v_invitation FROM public.organization_invitations WHERE id = p_invitation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Convite não encontrado.'; END IF;
  PERFORM id FROM public.organization_invitations
    WHERE organization_id = v_invitation.organization_id AND lower(btrim(invited_email)) = lower(btrim(v_invitation.invited_email))
    ORDER BY id FOR UPDATE;
  SELECT * INTO v_invitation FROM public.organization_invitations WHERE id = p_invitation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Convite não encontrado.'; END IF;
  IF lower(btrim(p_user_email)) IS DISTINCT FROM lower(btrim(v_invitation.invited_email)) THEN
    RAISE EXCEPTION 'Este convite pertence a outro email.';
  END IF;
  -- Recheck the profile link after Auth and invitations are locked.
  PERFORM p.id FROM public.profiles p
    WHERE p.id = p_profile_id AND p.user_id = v_user_id
      AND lower(btrim(p.email)) = lower(btrim(v_invitation.invited_email))
    FOR UPDATE OF p;
  IF NOT FOUND THEN RAISE EXCEPTION 'Este convite pertence a outro email.' USING ERRCODE = 'BW002'; END IF;
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

-- A new package must not silently call pre-repair module RPCs.
CREATE OR REPLACE FUNCTION public.assert_orgs_auth_identity_v1()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  expected record;
  actual pg_catalog.pg_proc%ROWTYPE;
BEGIN
  PERFORM public.assert_profile_auth_identity_v1();
  FOR expected IN SELECT * FROM (VALUES
      ('public.assign_organization_member_atomic(uuid,uuid,text,text,uuid)','c53da15bbfc07ff1871980c730165ebb',false,'jsonb',true),
      ('public.accept_organization_invitation(uuid,uuid,text)','0eef95e11deadf31d0724283a35110cd',false,'jsonb',true)
    ) AS contracts(signature, body_hash, definer, result_type, service_callable)
  LOOP
    SELECT * INTO actual FROM pg_catalog.pg_proc WHERE oid = to_regprocedure(expected.signature);
    IF NOT FOUND OR md5(actual.prosrc) IS DISTINCT FROM expected.body_hash
        OR actual.prosecdef IS DISTINCT FROM expected.definer
        OR actual.prorettype IS DISTINCT FROM to_regtype(expected.result_type)
        OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
        OR pg_catalog.pg_get_userbyid(actual.proowner) IN ('anon', 'authenticated')
        OR has_function_privilege('anon', actual.oid, 'EXECUTE')
        OR has_function_privilege('authenticated', actual.oid, 'EXECUTE')
        OR (expected.service_callable AND NOT has_function_privilege('service_role', actual.oid, 'EXECUTE')) THEN
      RAISE EXCEPTION 'IDENTITY_MIGRATION_REQUIRED: apply complete Core profile_auth_identity_v1 (%).', expected.signature USING ERRCODE = '55000';
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.assert_orgs_auth_identity_v1() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_orgs_auth_identity_v1() TO service_role;

$identity_ddl$;
  PERFORM public.assert_orgs_auth_identity_v1();
END;
$identity_migration$;
