-- Mirror of BrightWeb canonical migration:
-- brightweb-platform/supabase/modules/crm-base/migrations/20260311105000_crm_base_tax_identifier_generalization_v1.sql

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS tax_identifier_value text,
  ADD COLUMN IF NOT EXISTS tax_identifier_kind text,
  ADD COLUMN IF NOT EXISTS tax_identifier_country_code text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organizations_tax_identifier_kind_check'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_tax_identifier_kind_check
      CHECK (
        tax_identifier_kind IS NULL
        OR tax_identifier_kind IN ('vat', 'tax', 'registration', 'other')
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organizations_tax_identifier_country_code_check'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_tax_identifier_country_code_check
      CHECK (
        tax_identifier_country_code IS NULL
        OR tax_identifier_country_code ~ '^[A-Z]{2}$'
      );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_organizations_tax_identifier_lookup
  ON public.organizations (tax_identifier_country_code, tax_identifier_kind, tax_identifier_value)
  WHERE tax_identifier_value IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organizations'
      AND column_name = 'nif'
  ) THEN
    UPDATE public.organizations
    SET tax_identifier_country_code = COALESCE(tax_identifier_country_code, 'PT'),
        tax_identifier_kind = COALESCE(tax_identifier_kind, 'vat'),
        tax_identifier_value = COALESCE(tax_identifier_value, NULLIF(trim(nif), ''))
    WHERE NULLIF(trim(nif), '') IS NOT NULL;
  END IF;
END;
$$;
