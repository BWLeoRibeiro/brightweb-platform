-- Durable API rate limiting counters shared across all app instances.

CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 1 CHECK (count >= 0),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_counters_expires_at
  ON public.rate_limit_counters (expires_at);

REVOKE ALL ON public.rate_limit_counters FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key text,
  p_window_seconds integer,
  p_max_requests integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := timezone('utc', now());
  v_window_seconds integer := GREATEST(1, p_window_seconds);
  v_max_requests integer := GREATEST(1, p_max_requests);
  v_window_start_epoch bigint;
  v_window_start timestamptz;
  v_window_interval interval;
  v_count integer;
  v_reset_at timestamptz;
  v_allowed boolean;
BEGIN
  DELETE FROM public.rate_limit_counters
  WHERE expires_at < v_now;

  v_window_start_epoch := FLOOR(EXTRACT(EPOCH FROM v_now) / v_window_seconds) * v_window_seconds;
  v_window_start := to_timestamp(v_window_start_epoch);
  v_window_interval := make_interval(secs => v_window_seconds);

  INSERT INTO public.rate_limit_counters (key, window_started_at, count, updated_at, expires_at)
  VALUES (p_key, v_window_start, 1, v_now, v_window_start + v_window_interval)
  ON CONFLICT (key) DO UPDATE
    SET count = CASE
      WHEN public.rate_limit_counters.window_started_at = EXCLUDED.window_started_at
        THEN public.rate_limit_counters.count + 1
      ELSE 1
    END,
    window_started_at = EXCLUDED.window_started_at,
    updated_at = v_now,
    expires_at = EXCLUDED.expires_at
  RETURNING count, (window_started_at + v_window_interval) INTO v_count, v_reset_at;

  v_allowed := v_count <= v_max_requests;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'remaining', GREATEST(v_max_requests - v_count, 0),
    'reset_at', v_reset_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO anon, authenticated, service_role;
