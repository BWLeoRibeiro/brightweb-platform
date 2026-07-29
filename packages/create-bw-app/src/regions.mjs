// Supabase: https://supabase.com/docs/guides/platform/regions
// Vercel: https://vercel.com/docs/regions
// Verified 2026-07-29. Keep this list explicit; unknown regions must remain unpinned.
export const SUPABASE_TO_VERCEL_REGION = Object.freeze({
  americas: "iad1",
  emea: "fra1",
  apac: "sin1",
  "us-west-1": "sfo1",
  "us-west-2": "pdx1",
  "us-east-1": "iad1",
  "us-east-2": "cle1",
  "ca-central-1": "yul1",
  "eu-west-1": "dub1",
  "eu-west-2": "lhr1",
  "eu-west-3": "cdg1",
  "eu-central-1": "fra1",
  "eu-central-2": "fra1",
  "eu-north-1": "arn1",
  "ap-south-1": "bom1",
  "ap-southeast-1": "sin1",
  "ap-northeast-1": "hnd1",
  "ap-northeast-2": "icn1",
  "ap-southeast-2": "syd1",
  "sa-east-1": "gru1",
});

export function normalizeSupabaseRegion(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return normalized || null;
}

export function nearestVercelRegion(supabaseRegion) {
  const normalized = normalizeSupabaseRegion(supabaseRegion);
  return normalized ? SUPABASE_TO_VERCEL_REGION[normalized] ?? null : null;
}

export function createVercelConfig(supabaseRegion) {
  const vercelRegion = nearestVercelRegion(supabaseRegion);
  return {
    config: vercelRegion
      ? {
          $schema: "https://openapi.vercel.sh/vercel.json",
          regions: [vercelRegion],
        }
      : {
          $schema: "https://openapi.vercel.sh/vercel.json",
        },
    supabaseRegion: normalizeSupabaseRegion(supabaseRegion),
    vercelRegion,
  };
}

export function regionSetupNote(supabaseRegion) {
  const normalized = normalizeSupabaseRegion(supabaseRegion);
  const vercelRegion = nearestVercelRegion(normalized);
  if (vercelRegion) {
    return `Supabase region \`${normalized}\` maps to Vercel Functions region \`${vercelRegion}\` in \`vercel.json\`.`;
  }
  return "<!-- vercel.json region placeholder: once the Supabase region is known, set SUPABASE_PROJECT_REGION and add the nearest verified Vercel region as `\"regions\": [\"<region>\"]`. -->";
}
