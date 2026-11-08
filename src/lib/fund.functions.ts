import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fundRulesSchema, fundSaveSchema } from "./fund-schema";

export const saveFund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => fundSaveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("save_scholarship_rules", {
      p_fund_id: data.id ?? "00000000-0000-0000-0000-000000000000", p_expected_version: data.expectedVersion,
      p_input: data, p_activate: data.activate, p_confirmed: data.confirmed,
    });
    if (error) throw new Error(error.message);
    return z.object({ id: z.string(), version: z.number(), status: z.enum(["draft", "active"]) }).parse(result);
  });

export const eligibleStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ rules: fundRulesSchema, discipline: z.string(), lifeLoad: z.array(z.string()) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("eligible_scholarship_students", { p_rules: data.rules, p_discipline: data.discipline, p_life_load: data.lifeLoad });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => r.student_id);
  });

export const fundHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("scholarship_audit").select("id,version,action,created_at,actor_id").eq("fund_id", data.id).order("version", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });