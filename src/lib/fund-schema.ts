import { z } from "zod";

export const fundRulesSchema = z.object({
  state: z.enum(["any", "ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"]).default("any"),
  postcodes: z.array(z.string().regex(/^\d{4}$/)).max(500).default([]),
  regions: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
  studyLoad: z.enum(["any", "full-time", "part-time"]).default("any"),
  maxHouseholdIncome: z.number().int().nonnegative().nullable().default(null),
  institutions: z.array(z.string().trim().min(1).max(200)).max(100).default([]),
  yearLevels: z.array(z.number().int().min(1).max(6)).default([]),
  residencies: z.array(z.enum(["Citizen", "Permanent Resident", "Student Visa 500"])).default([]),
  firstGeneration: z.enum(["yes", "no", "any"]).default("any"),
  centrelink: z.enum(["yes", "no", "any"]).default("any"),
  numberOfAwards: z.number().int().min(1).nullable().default(null),
  closeDate: z.string().refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)), "Enter a valid close date").default(""),
  clauses: z.record(z.string().max(500)).default({}),
});
export type FundRules = z.infer<typeof fundRulesSchema>;
export const emptyFundRules = (): FundRules => fundRulesSchema.parse({});
export const fundSaveSchema = z.object({
  id: z.string().uuid().optional(),
  expectedVersion: z.number().int().nonnegative().default(0),
  title: z.string().trim().min(1, "Give your fund a title first").max(200),
  orgClass: z.enum(["", "Charitable foundation", "Private trust", "Corporate CSR", "Other"]),
  stipendAud: z.number().int().nonnegative().nullable(),
  discipline: z.enum(["All Disciplines", "Law", "Engineering", "Business", "Medicine", "Arts"]),
  lifeLoad: z.array(z.enum(["High External Workload 20+ hrs", "Primary Caretaker", "Regional/Remote Background"])),
  rules: fundRulesSchema,
  deedPath: z.string().max(500).nullable(),
  activate: z.boolean(),
  confirmed: z.boolean(),
}).superRefine((v, ctx) => {
  if (!v.activate) return;
  if (!v.confirmed) ctx.addIssue({ code: "custom", message: "Confirm these rules reflect your trust deed", path: ["confirmed"] });
  if (!v.rules.numberOfAwards) ctx.addIssue({ code: "custom", message: "Enter the number of awards", path: ["rules", "numberOfAwards"] });
  if (!v.rules.closeDate) ctx.addIssue({ code: "custom", message: "Enter an application close date", path: ["rules", "closeDate"] });
});
export type FundSaveInput = z.infer<typeof fundSaveSchema>;