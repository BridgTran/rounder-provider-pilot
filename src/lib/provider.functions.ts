/**
 * ROUNDER HQ — server functions for the scholarship-provider pilot.
 *
 * Authenticated provider functions use requireSupabaseAuth (RLS as the
 * provider). Public student-view functions use a publishable client and only
 * touch anonymized data or security-definer RPCs — student PII is gated by
 * the accepted-match RLS policy on student_identities.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { StudentProfile, StudyMode, WorkSector } from "./irto";
import { fundRulesSchema, emptyFundRules, type FundRules } from "./fund-schema";

/* ------------------------------------------------------------- row mapping */

export interface CandidateRecord extends StudentProfile {
  degree: string;
  year: string;
  uni: string;
  endorsement: string;
  endorser: string;
  traits: string[];
  program: string;
  orgMask: string;
}

type StudentRow = Database["public"]["Tables"]["students"]["Row"];

export function mapStudentRow(row: StudentRow): CandidateRecord {
  return {
    id: row.id,
    candidateCode: row.candidate_code,
    degreeTitle: row.degree_title,
    degree: row.degree,
    discipline: row.discipline,
    year: row.year_label,
    uni: row.uni,
    rawGpa: Number(row.raw_gpa),
    weeklyHours: Number(row.weekly_hours),
    workSector: row.work_sector as WorkSector,
    visaStatus: row.visa_status,
    yearLevel: row.year_level,
    studyMode: row.study_mode as StudyMode,
    studyLoad: row.study_load,
    birthYear: row.birth_year,
    equityTags: row.equity_tags,
    verifiedEquity: {
      centrelinkConcession: row.verified_centrelink,
      lowSesPostcode: row.verified_low_ses,
    },
    softSkills: {
      clientEmpathy: row.client_empathy,
      pressureResilience: row.pressure_resilience,
      crisisManagement: row.crisis_management,
      adaptability: row.adaptability,
    },
    endorsement: row.endorsement,
    endorser: row.endorser,
    traits: row.traits,
    program: row.program,
    orgMask: row.org_mask,
  };
}

/* ------------------------------------------------------- provider (authed) */

export const listStudents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("students")
      .select("*")
      .order("candidate_code");
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapStudentRow);
  });

export interface ScholarshipFund {
  rules: FundRules;
  status: "draft" | "active";
  version: number;
  deedPath: string | null;
  id: string;
  title: string;
  orgClass: string;
  location: string;
  stipendAud: number | null;
  finalistRequirements: string[];
  lifeLoad: string[];
  minEmpathy: number;
  minResilience: number;
  discipline: string;
  createdAt: string;
}

export interface StudentIdentity {
  legalName: string;
  phone: string;
  email: string;
  transcriptUrl: string;
}

export interface ProviderMatch {
  id: string;
  studentId: string;
  status: "pending" | "accepted" | "declined";
  acceptedAt: string | null;
  /** Present only after the student accepted (RLS-gated). */
  identity: StudentIdentity | null;
}

export interface ProviderDashboard {
  organisationName: string;
  contactPerson: string;
  credits: number;
  scholarships: ScholarshipFund[];
  matches: ProviderMatch[];
}

export const getProviderDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProviderDashboard> => {
    const { supabase, userId } = context;
    const [profileRes, creditsRes, scholarshipsRes, matchesRes, identitiesRes] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("organisation_name, contact_person")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("provider_credits")
          .select("balance")
          .eq("provider_id", userId)
          .maybeSingle(),
        supabase
          .from("scholarships")
          .select("*")
          .eq("provider_id", userId)
          .order("created_at", { ascending: false }),
        supabase.from("matches").select("id, student_id, status, accepted_at, declined_at"),
        // RLS returns identities only for students with an accepted match.
        supabase.from("student_identities").select("*"),
      ]);

    const identityByStudent = new Map(
      (identitiesRes.data ?? []).map((i) => [
        i.student_id,
        {
          legalName: i.legal_name,
          phone: i.phone,
          email: i.email,
          transcriptUrl: i.transcript_url,
        } satisfies StudentIdentity,
      ]),
    );

    return {
      organisationName: profileRes.data?.organisation_name ?? "",
      contactPerson: profileRes.data?.contact_person ?? "",
      credits: creditsRes.data?.balance ?? 0,
      scholarships: (scholarshipsRes.data ?? []).map((s) => ({
        rules: fundRulesSchema.safeParse(s.rules).success ? fundRulesSchema.parse(s.rules) : emptyFundRules(),
        status: s.status === "active" ? "active" : "draft",
        version: s.rule_version,
        deedPath: s.deed_path,
        id: s.id,
        title: s.title,
        orgClass: s.org_class,
        location: s.location,
        stipendAud: s.stipend_aud,
        finalistRequirements: s.finalist_requirements,
        lifeLoad: s.life_load,
        minEmpathy: s.min_empathy,
        minResilience: s.min_resilience,
        discipline: s.discipline,
        createdAt: s.created_at,
      })),
      matches: (matchesRes.data ?? []).map((m) => ({
        id: m.id,
        studentId: m.student_id,
        status: m.declined_at ? "declined" : m.status as "pending" | "accepted",
        acceptedAt: m.accepted_at,
        identity: identityByStudent.get(m.student_id) ?? null,
      })),
    };
  });

export const requestMatchFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { studentId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: match, error } = await context.supabase.rpc("request_match", {
      p_student_id: data.studentId,
    });
    if (error) throw new Error(error.message);
    return match;
  });


export interface PublishScholarshipInput {
  title: string;
  orgClass: string;
  location: string;
  stipendAud: number | null;
  finalistRequirements: string[];
  lifeLoad: string[];
  minEmpathy: number;
  minResilience: number;
  discipline: string;
}

