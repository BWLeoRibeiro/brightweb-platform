CREATE OR REPLACE FUNCTION public.reorder_marketing_topics(p_topic_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  selected_count integer;
BEGIN
  IF p_topic_ids IS NULL OR cardinality(p_topic_ids) = 0 THEN
    RAISE EXCEPTION 'Topic order is required.';
  END IF;

  IF cardinality(p_topic_ids) <> (
    SELECT count(DISTINCT ordered.topic_id)
    FROM unnest(p_topic_ids) AS ordered(topic_id)
  ) THEN
    RAISE EXCEPTION 'Topic order must contain unique topic IDs.';
  END IF;

  SELECT count(*)
  INTO selected_count
  FROM public.marketing_topics
  WHERE id = ANY(p_topic_ids);

  IF selected_count <> cardinality(p_topic_ids)
    OR selected_count <> (SELECT count(*) FROM public.marketing_topics) THEN
    RAISE EXCEPTION 'Topic order must contain every topic exactly once.';
  END IF;

  UPDATE public.marketing_topics AS topic
  SET position = (ordered.ordinality - 1) * 10
  FROM unnest(p_topic_ids) WITH ORDINALITY AS ordered(topic_id, ordinality)
  WHERE topic.id = ordered.topic_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_marketing_topics(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_marketing_topics(uuid[]) TO service_role;
