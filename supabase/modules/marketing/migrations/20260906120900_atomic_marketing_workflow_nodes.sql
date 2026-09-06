-- Check position uniqueness at the end of the statement so retained node IDs
-- can exchange positions without breaking their step-history references.
ALTER TABLE public.marketing_workflow_nodes
  DROP CONSTRAINT marketing_workflow_nodes_workflow_id_position_key;
ALTER TABLE public.marketing_workflow_nodes
  ADD CONSTRAINT marketing_workflow_nodes_workflow_id_position_key
  UNIQUE (workflow_id, position) DEFERRABLE INITIALLY IMMEDIATE;

CREATE OR REPLACE FUNCTION public.replace_marketing_workflow_nodes(p_workflow_id uuid, p_nodes jsonb)
RETURNS SETOF public.marketing_workflow_nodes
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM public.marketing_workflows WHERE id = p_workflow_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Workflow not found.'; END IF;
  IF v_status = 'active' THEN RAISE EXCEPTION 'Pause the workflow before editing its nodes.'; END IF;
  IF jsonb_typeof(p_nodes) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Workflow nodes must be an array.'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_nodes) AS node
    WHERE jsonb_typeof(node) IS DISTINCT FROM 'object'
      OR node->>'node_type' IS NULL
      OR node->>'node_type' NOT IN ('send_email', 'wait', 'add_tag')
      OR (node ? 'config' AND jsonb_typeof(node->'config') IS DISTINCT FROM 'object')
  ) THEN RAISE EXCEPTION 'Invalid workflow node.'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_nodes) AS node
    WHERE node->>'id' IS NOT NULL
    GROUP BY (node->>'id')::uuid HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'Duplicate workflow node ID.'; END IF;
  PERFORM id FROM public.marketing_workflow_nodes WHERE workflow_id = p_workflow_id ORDER BY id FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_nodes) AS node
    WHERE node->>'id' IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.marketing_workflow_nodes existing
      WHERE existing.id = (node->>'id')::uuid AND existing.workflow_id = p_workflow_id
    )
  ) THEN RAISE EXCEPTION 'Workflow node does not belong to this workflow.'; END IF;

  DELETE FROM public.marketing_workflow_nodes existing
    WHERE existing.workflow_id = p_workflow_id AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_nodes) AS node WHERE (node->>'id')::uuid = existing.id
    );
  INSERT INTO public.marketing_workflow_nodes(id, workflow_id, position, node_type, config)
    SELECT coalesce((node->>'id')::uuid, gen_random_uuid()), p_workflow_id,
      (ordinality - 1)::integer, node->>'node_type', coalesce(node->'config', '{}'::jsonb)
    FROM jsonb_array_elements(p_nodes) WITH ORDINALITY AS input(node, ordinality)
    ON CONFLICT(id) DO UPDATE SET position = EXCLUDED.position, node_type = EXCLUDED.node_type, config = EXCLUDED.config;
  RETURN QUERY SELECT * FROM public.marketing_workflow_nodes WHERE workflow_id = p_workflow_id ORDER BY position;
END;
$$;
REVOKE ALL ON FUNCTION public.replace_marketing_workflow_nodes(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_marketing_workflow_nodes(uuid, jsonb) TO service_role;

-- Activation must share the node editor's parent lock; otherwise it can approve
-- an old non-empty snapshot while a concurrent edit clears the node set.
CREATE OR REPLACE FUNCTION public.set_marketing_workflow_status(p_workflow_id uuid, p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_workflow public.marketing_workflows%ROWTYPE;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('active', 'paused') THEN RAISE EXCEPTION 'Invalid workflow status.'; END IF;
  SELECT * INTO v_workflow FROM public.marketing_workflows WHERE id = p_workflow_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Workflow not found.'; END IF;
  IF p_status = 'active' AND NOT EXISTS (SELECT 1 FROM public.marketing_workflow_nodes WHERE workflow_id = p_workflow_id) THEN
    RAISE EXCEPTION 'A workflow must have at least one node before activation.';
  END IF;
  UPDATE public.marketing_workflows SET status = p_status WHERE id = p_workflow_id RETURNING * INTO v_workflow;
  RETURN to_jsonb(v_workflow);
END;
$$;
REVOKE ALL ON FUNCTION public.set_marketing_workflow_status(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_marketing_workflow_status(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.delete_marketing_workflow_node(p_workflow_id uuid, p_node_id uuid)
RETURNS SETOF public.marketing_workflow_nodes
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM public.marketing_workflows WHERE id = p_workflow_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Workflow not found.'; END IF;
  IF v_status = 'active' THEN RAISE EXCEPTION 'Pause the workflow before editing its nodes.'; END IF;
  -- Remove only the requested node, never a stale replacement snapshot supplied
  -- by the server before another editor appended or changed a different node.
  DELETE FROM public.marketing_workflow_nodes WHERE workflow_id = p_workflow_id AND id = p_node_id;
  WITH positions AS (
    SELECT id, (row_number() OVER (ORDER BY position, id) - 1)::integer AS position
    FROM public.marketing_workflow_nodes WHERE workflow_id = p_workflow_id
  )
  UPDATE public.marketing_workflow_nodes node SET position = positions.position
    FROM positions WHERE node.id = positions.id AND node.position <> positions.position;
  RETURN QUERY SELECT * FROM public.marketing_workflow_nodes WHERE workflow_id = p_workflow_id ORDER BY position;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_marketing_workflow_node(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_marketing_workflow_node(uuid, uuid) TO service_role;
