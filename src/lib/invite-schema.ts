import { z } from "zod";
import { australianStates, degreeLevels } from "./fund-schema";

export const intakeSchema = z.object({
  gender: z.enum(["", "female", "male", "non-binary"]).default(""),
  degreeLevel: z.enum(["", ...degreeLevels]).default(""),
  firstUndergraduateDegree: z.enum(["", "yes", "no"]).default(""),
  yearsCompleted: z.number().min(0).max(20).nullable().default(null),
  campusState: z.enum(["", ...australianStates]).default(""),
  institution: z.string().max(200).default(""),
  state: z.enum(["", ...australianStates]).default(""),
  postcode: z.string().regex(/^(\d{4})?$/).default(""),
  region: z.string().max(100).default(""),
  householdIncome: z.number().int().nonnegative().nullable().default(null),
  firstGeneration: z.enum(["", "yes", "no"]).default(""),
  centrelink: z.enum(["", "yes", "no"]).default(""),
  legalName: z.string().trim().min(1).max(150),
  email: z.string().email().max(254),
  phone: z.string().max(40),
  degree: z.string().trim().min(1).max(200),
  discipline: z.enum(["Law", "Engineering", "Business", "Medicine", "Arts"]),
  rawGpa: z.number().min(0).max(100),
  weeklyHours: z.number().min(0).max(168),
  workSector: z.enum(["Hospitality", "Retail", "Hospital / Clinical Care", "Administration", "Tutoring", "Trades", "Other"]),
  visaStatus: z.enum(["Citizen", "Permanent Resident", "Student Visa 500"]),
  yearLevel: z.number().int().min(1).max(6),
  studyMode: z.enum(["Internal", "Online", "Hybrid"]),
  studyLoad: z.union([z.literal(25), z.literal(50), z.literal(75), z.literal(100)]),
  birthYear: z.number().int().min(1900).max(new Date().getUTCFullYear()),
  equityTags: z.array(z.enum(["High External Workload 20+ hrs", "Primary Caretaker", "First-Gen Student", "Regional/Remote Background", "Low-SES Postcode"])).max(5),
});
export type IntakeInput = z.infer<typeof intakeSchema>;
export const inviteActionSchema = z.discriminatedUnion("action", [
  z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), action: z.enum(["read", "consent", "delete"]) }),
  z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), action: z.literal("intake"), payload: intakeSchema }),
  z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), action: z.literal("respond"), payload: z.object({ matchId: z.string().uuid(), decision: z.enum(["accept", "decline"]) }) }),
]);