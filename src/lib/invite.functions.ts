import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { inviteActionSchema, studentIntakeTokenSchema, studentIntakeUpdateSchema, storedIntakeSchema, adminIntakeUnlockSchema } from "./invite-schema";
import { applicationStageSchema, adminInviteCountSchema, advanceApplicationSchema } from "./application-schema";

const inviteStateSchema = z.object({
  consented: z.boolean().optional(), submitted: z.boolean().optional(), deleted: z.boolean().optional(),
  requests: z.array(z.object({ id: z.string(), stage: applicationStageSchema.exclude(["shortlisted"]), fundTitle: z.string().nullable(), status: z.enum(["pending", "accepted", "declined"]), organisation: z.string(), contactPerson: z.string().nullable(), email: z.string().nullable() })).default([]),
});

export const studentGetIntake = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof studentIntakeTokenSchema>) => studentIntakeTokenSchema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const client = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      } },
    });
    const { data: result, error } = await client.rpc("student_get_intake", { p_token: data.token });
    if (error) throw new Error(error.message);
    return storedIntakeSchema.parse(result);
  });

export const studentUpdateIntake = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof studentIntakeUpdateSchema>) => studentIntakeUpdateSchema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const client = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      } },
    });
    const { error } = await client.rpc("student_update_intake", { p_token: data.token, p_payload: data.payload });
    if (error) throw new Error(error.message);
    return { updated: true };
  });

export const adminSetIntakeUnlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof adminIntakeUnlockSchema>) => adminIntakeUnlockSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !allowed) throw new Error("Administrator sign-in required");
    const { error } = await context.supabase.rpc("admin_set_intake_unlock", { p_student_id: data.studentId, p_unlocked: data.unlocked });
    if (error) throw new Error(error.message);
    return { studentId: data.studentId, unlocked: data.unlocked };
  });

export const createStudentInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
    const { error } = await context.supabase.rpc("create_student_invite", { p_token_hash: hash });
    if (error) throw new Error("Could not create student invitation.");
    return { token };
  });

export const studentInviteAction = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof inviteActionSchema>) => inviteActionSchema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const client = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      } },
    });
    const { data: result, error } = await client.rpc("student_invite_action", {
      p_token: data.token, p_action: data.action, p_payload: "payload" in data ? data.payload : {},
    });
    if (error) throw new Error("This invitation is invalid, expired, or the action is no longer available.");
    return inviteStateSchema.parse(result);
  });

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: admin, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (error || !admin) return { allowed: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [providers, students, requests] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("students").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("matches").select("id", { count: "exact", head: true }),
    ]);
    if (providers.error || students.error || requests.error) throw new Error("Could not load administration overview.");
    return { allowed: true as const, providers: providers.count ?? 0, students: students.count ?? 0, requests: requests.count ?? 0 };
  });

export const adminIssueInvites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof adminInviteCountSchema>) => adminInviteCountSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !allowed) throw new Error("Administrator sign-in required");
    const tokens = Array.from({ length: data.count }, () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join(""));
    const hashes = await Promise.all(tokens.map(async (token) => {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
      return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
    }));
    const { error } = await context.supabase.rpc("admin_issue_student_invites", { p_token_hashes: hashes });
    if (error) throw new Error(error.message);
    return { tokens };
  });

export const adminListApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: allowed, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !allowed) throw new Error("Administrator sign-in required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("matches")
      .select("id, student_id, stage, stage_updated_at, release_consent_at, scholarships(title), students(candidate_code, student_identities(legal_name, email))")
      .order("stage_updated_at", { ascending: false });
    if (error) throw new Error("Could not load applications");
    const studentIds = [...new Set((data ?? []).map((match) => match.student_id))];
    const unlockedStudents = new Set<string>();
    if (studentIds.length > 0) {
      const { data: invitations, error: invitationsError } = await supabaseAdmin.from("student_invites")
        .select("student_id, intake_unlocked_at").in("student_id", studentIds);
      if (invitationsError) throw new Error("Could not load student editing permissions");
      for (const invitation of invitations ?? []) {
        if (invitation.student_id && invitation.intake_unlocked_at) unlockedStudents.add(invitation.student_id);
      }
    }
    return (data ?? []).map((match) => ({
      id: match.id, student_id: match.student_id, stage: applicationStageSchema.parse(match.stage), stageUpdatedAt: match.stage_updated_at,
      intakeUnlocked: unlockedStudents.has(match.student_id),
      hasReleaseConsent: match.release_consent_at !== null,
      fundTitle: match.scholarships?.title ?? null,
      candidateCode: match.students?.candidate_code ?? null,
      legalName: match.students?.student_identities?.legal_name ?? null,
      email: match.students?.student_identities?.email ?? null,
    }));
  });

export const adminAdvanceApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof advanceApplicationSchema>) => advanceApplicationSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("admin_advance_application", { p_match_id: data.matchId, p_to: data.to });
    if (error) throw new Error(error.message);
    return result;
  });