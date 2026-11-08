/**
 * ROUNDER HQ — server functions for the scholarship-provider pilot.
 *
 * Authenticated provider functions use requireSupabaseAuth (RLS as the
 * provider). Public student-view functions use a publishable client and only
 * touch anonymized data or security-definer RPCs — student PII is gated by
 * the accepted-match RLS policy on student_identities.
 */

import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { StudentProfile, StudyMode, WorkSector } from "./irto";

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
  status: "pending" | "accepted";
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
        supabase.from("matches").select("id, student_id, status, accepted_at"),
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
        status: m.status as "pending" | "accepted",
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

export const topUpCreditsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { amount: number }) => input)
  .handler(async ({ data, context }) => {
    const { data: balance, error } = await context.supabase.rpc("top_up_credits", {
      p_amount: data.amount,
    });
    if (error) throw new Error(error.message);
    return balance as number;
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

export const createScholarshipFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: PublishScholarshipInput) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("scholarships").insert({
      provider_id: context.userId,
      title: data.title,
      org_class: data.orgClass,
      location: data.location,
      stipend_aud: data.stipendAud,
      finalist_requirements: data.finalistRequirements,
      life_load: data.lifeLoad,
      min_empathy: data.minEmpathy,
      min_resilience: data.minResilience,
      discipline: data.discipline,
    });
    if (error) throw new Error(error.message);
  });

/* -------------------------------------------------------- student (public) */

function createPublicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false },
    // Opaque sb_ keys aren't JWTs: send apikey only, never an Authorization bearer.
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/** Anonymized student records for the public student view (no PII). */
export const listPublicStudents = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await createPublicClient()
    .from("students")
    .select("*")
    .order("candidate_code");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapStudentRow);
});

export interface StudentRequest {
  candidateCode: string;
  program: string;
  status: "pending" | "accepted";
  /** Masked org label until accepted, then the provider's organisation name. */
  organisation: string;
}

export const listStudentRequests = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await createPublicClient().rpc("list_student_requests");
  if (error) throw new Error(error.message);
  return (data ?? []).map(
    (r): StudentRequest => ({
      candidateCode: r.candidate_code,
      program: r.program,
      status: r.status as "pending" | "accepted",
      organisation: r.organisation,
    }),
  );
});

export const acceptMatchFn = createServerFn({ method: "POST" })
  .inputValidator((input: { candidateCode: string }) => input)
  .handler(async ({ data }) => {
    const { error } = await createPublicClient().rpc("accept_match", {
      p_candidate_code: data.candidateCode,
    });
    if (error) throw new Error(error.message);
  });
