-- atomic_admin_invitation_acceptance
-- target: admin
-- created_at: 2026-09-06T10:16:16.616Z

CREATE OR REPLACE FUNCTION public.accept_admin_user_invitation(p_invitation_id uuid, p_profile_id uuid, p_user_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_invitation public.admin_user_invitations%ROWTYPE;
  v_old_role text;
BEGIN
  SELECT * INTO v_invitation FROM public.admin_user_invitations WHERE id = p_invitation_id FOR UPDATE;
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
    RETURN jsonb_build_object('status', 'accepted', 'role', v_invitation.role_code);
  END IF;
  IF v_invitation.status <> 'pending' THEN RAISE EXCEPTION 'Este convite já não está disponível.'; END IF;
  IF v_invitation.expires_at <= clock_timestamp() THEN
    UPDATE public.admin_user_invitations SET status = 'expired' WHERE id = p_invitation_id;
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  SELECT role_code INTO v_old_role FROM public.user_role_assignments WHERE profile_id = p_profile_id FOR UPDATE;
  INSERT INTO public.user_role_assignments(profile_id, role_code, assigned_by_profile_id, assigned_at, reason)
    VALUES(p_profile_id, v_invitation.role_code, v_invitation.invited_by_profile_id, now(), 'Convite de utilizador do portal aceite.')
    ON CONFLICT(profile_id) DO UPDATE SET role_code = EXCLUDED.role_code,
      assigned_by_profile_id = EXCLUDED.assigned_by_profile_id, assigned_at = EXCLUDED.assigned_at, reason = EXCLUDED.reason;
  IF v_invitation.invited_by_profile_id IS NOT NULL THEN
    INSERT INTO public.role_change_audit(target_profile_id, changed_by_profile_id, old_role_code, new_role_code, reason)
      VALUES(p_profile_id, v_invitation.invited_by_profile_id, v_old_role, v_invitation.role_code, 'Convite de utilizador do portal aceite.');
  END IF;
  UPDATE public.admin_user_invitations SET status = 'accepted', accepted_at = now(), accepted_by_profile_id = p_profile_id
    WHERE id = p_invitation_id;
  PERFORM public.log_app_activity_event('admin', 'admin_user_invitation_accepted', 'admin_user_invitations', p_invitation_id,
    'Convite de utilizador aceite.', jsonb_build_object('email', v_invitation.invited_email, 'role', v_invitation.role_code,
      'status', 'accepted', 'accepted_by_profile_id', p_profile_id), p_profile_id);
  RETURN jsonb_build_object('status', 'accepted', 'role', v_invitation.role_code);
END;
$$;
REVOKE ALL ON FUNCTION public.accept_admin_user_invitation(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_admin_user_invitation(uuid, uuid, text) TO service_role;
