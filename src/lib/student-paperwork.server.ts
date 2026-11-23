import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export function createInvitationClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const url = process.env["SUPABASE_URL"];
  if (!key || !url) throw new Error("Invitation service is unavailable.");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
      headers.set("apikey", key);
      return fetch(input, { ...init, headers });
    } },
  });
}

// Keep registration transactional from the caller's perspective: unregistered
// uploads are removed on failure; previous objects are removed only after success.
export async function registerUploadedDocument(
  path: string,
  operations: { store: () => Promise<void>; register: () => Promise<string | null>; remove: (path: string) => Promise<void> },
) {
  await operations.store();
  let previous: string | null;
  try { previous = await operations.register(); }
  catch (error) {
    try { await operations.remove(path); }
    catch { console.error("Could not remove an unregistered student document."); }
    throw error;
  }
  if (previous && previous !== path) await operations.remove(previous);
}