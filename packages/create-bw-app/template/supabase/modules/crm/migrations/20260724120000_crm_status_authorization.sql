-- Restrict the CRM status transition RPC to staff and trusted service calls.

CREATE OR REPLACE FUNCTION public.set_crm_status(
  p_contact_id uuid,
  p_new_status text,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current text;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
    AND NOT COALESCE(public.is_staff(), false)
  THEN
    RAISE EXCEPTION 'Staff access required'
      USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_current
  FROM public.crm_contacts
  WHERE id = p_contact_id;

  IF v_current IS NULL THEN
    v_current := 'none';
  END IF;

  IF v_current = p_new_status THEN
    RETURN;
  END IF;

  UPDATE public.crm_contacts
  SET status = p_new_status,
      updated_at = now()
  WHERE id = p_contact_id;

  INSERT INTO public.crm_status_log (
    contact_id,
    previous_status,
    new_status,
    reason,
    changed_by_user_id
  ) VALUES (
    p_contact_id,
    v_current,
    p_new_status,
    p_reason,
    auth.uid()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_crm_status(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_crm_status(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_crm_status(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_crm_status(uuid, text, text) TO service_role;
