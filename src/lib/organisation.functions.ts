import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequestUrl } from "@tanstack/react-start/server";

export const inviteTeamMember = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ email: z.string().email() }).parse(input))
  .handler(async ({ data, context }) => {
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2,"0")).join("");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2,"0")).join("");
    const { error } = await context.supabase.rpc("create_organisation_invite", { p_email: data.email, p_hash: hash });
    if (error) throw new Error(error.message);
    // The owner-scoped RPC authorizes the invitation before any auth email is sent.
    // Auth magic links use the default sender and verify the recipient's identity.
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) throw new Error("Invitation saved, but email sending is unavailable. Please try again.");
    const authClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: emailError } = await authClient.auth.signInWithOtp({
      email: data.email,
      options: { shouldCreateUser: true, emailRedirectTo: getRequestUrl().origin },
    });
    if (emailError) throw new Error("Invitation saved, but the sign-in email could not be sent. Please try again later.");
    return { sent: true };
  });
export const joinOrganisation = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("accept_organisation_invite", { p_token: data.token });
    if (error) throw new Error(error.message);
    return { joined: true };
  });