import "server-only";

type QueryClient = { from: (table: string) => any };
const client = (supabase: unknown) => supabase as QueryClient;
function throwIfError(error: { message?: string } | null | undefined) {
  if (error) throw new Error(error.message || "Marketing database request failed.");
}

export async function isSuppressed(supabase: unknown, email: string): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return true;
  const { data, error } = await client(supabase)
    .from("marketing_suppressions")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();
  throwIfError(error);
  return Boolean(data);
}

export async function emailableContact(
  supabase: unknown,
  contactId: string,
  topicId: string,
): Promise<{ email: string } | null> {
  const subscriptionResult = await client(supabase)
    .from("marketing_subscriptions")
    .select("status")
    .eq("contact_id", contactId)
    .eq("topic_id", topicId)
    .maybeSingle();
  throwIfError(subscriptionResult.error);
  if (subscriptionResult.data?.status !== "subscribed") return null;

  const contactResult = await client(supabase)
    .from("crm_contacts")
    .select("email")
    .eq("id", contactId)
    .maybeSingle();
  throwIfError(contactResult.error);
  const email = contactResult.data?.email;
  if (typeof email !== "string" || !email.trim() || await isSuppressed(supabase, email)) return null;
  return { email: email.trim() };
}


export async function isEmailable(supabase: unknown, contactId: string, topicId: string): Promise<boolean> {
  return Boolean(await emailableContact(supabase, contactId, topicId));
}
