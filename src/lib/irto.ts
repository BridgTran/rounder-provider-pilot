/**
 * ROUNDER HQ — "Impact Relative to Opportunity" (IRTO) matching engine.
 *
 * Pure, offline, dependency-free scoring. Given a Student Profile and an
 * organisation's Filter Criteria it produces:
 *   1. a discipline-scaled Adjusted Capability Score (time-poverty adjusted),
 *   2. frontline-sector soft-skill boosts,
 *   3. mandatory hard-gate pass/fail,
 *   4. a 0-100% "Grit Match Fit" via distance matching.
 */

/* ------------------------------------------------------------------ types */

export type StudyMode = "Internal" | "Online" | "Hybrid";

export type WorkSector =
  | "Hospitality"
  | "Retail"
  | "Hospital / Clinical Care"
  | "Administration"
  | "Tutoring"
  | "Trades"
  | "Other";

export interface SoftSkills {
  clientEmpathy: number; // 0-100
  pressureResilience: number; // 0-100
  crisisManagement: number; // 0-100
  adaptability: number; // 0-100
}

export interface StudentProfile {
  id: string;
  /** Anonymized corporate-feed tracking code. */
  candidateCode: string;
  /** Full degree title as printed on the My eQuals transcript. */
  degreeTitle: string;
  /** Broad discipline bucket used by hard gates. */
  discipline: string;
  /** Raw My eQuals GPA expressed out of 100. */
  rawGpa: number;
  /** Total external commitment hours per week (work + care). */
  weeklyHours: number;
  workSector: WorkSector;
  visaStatus: string; // e.g. "Citizen", "Permanent Resident", "Student Visa 500"
  yearLevel: number; // 1-6
  studyMode: StudyMode;
  /** Study load as a percentage of a full-time enrolment (25-100). */
  studyLoad: number;
  birthYear: number;
  /** Equity / life-load markers, e.g. "Low-SES Postcode", "First-Gen Student". */
  equityTags: string[];
  /** Independently verified equity signals shown only when confirmed. */
  verifiedEquity?: {
    centrelinkConcession: boolean;
    lowSesPostcode: boolean;
  };
  softSkills: SoftSkills;
}

export interface FilterCriteria {
  mandatory?: {
    visaStatuses?: string[];
    disciplines?: string[];
    yearLevels?: number[];
    studyModes?: StudyMode[];
    /** Exact accepted study-load percentages. */
    studyLoads?: number[];
    /** Inclusive [min, max] band, each 25-100. */
    studyLoadRange?: [number, number];
    /** Mature-age boundary: only accept students born on/before this year. */
    bornOnOrBefore?: number;
    /** Only accept students born on/after this year. */
    bornOnOrAfter?: number;
  };
  preferred?: {
    /** Target Adjusted Capability Score, 0-100. */
    adjustedGpa?: number;
    clientEmpathy?: number;
    pressureResilience?: number;
    crisisManagement?: number;
    /** Desired equity markers — proportion matched feeds the fit score. */
    equityTags?: string[];
  };
}

export interface IrtoResult {
  student: StudentProfile;
  beta: number;
  adjustedGpa: number;
  /** Soft skills after frontline-sector multipliers. */
  softSkills: SoftSkills;
  frontlineBoost: boolean;
  passedHardGates: boolean;
  /** Reasons the candidate was discarded, if any. */
  gateFailures: string[];
  /** 0-100 preferred-criteria proximity score. */
  gritMatchFit: number;
}

/* ------------------------------------------------- discipline coefficients */

const TIER_1 = [
  "law",
  "medicine",
  "engineering",
  "nursing",
  "chiropractic",
  "physiotherapy",
  "dentistry",
  "veterinary science",
  "architecture",
];

const TIER_2 = [
  "computer science",
  "commerce",
  "finance",
  "economics",
  "general science",
  "science",
  "psychology",
];

const TIER_3 = ["liberal arts", "arts", "communications", "design", "humanities"];

export const DISCIPLINE_BETA: Record<string, number> = {
  ...Object.fromEntries(TIER_1.map((d) => [d, 1.15])),
  ...Object.fromEntries(TIER_2.map((d) => [d, 1.05])),
  ...Object.fromEntries(TIER_3.map((d) => [d, 1.0])),
};

/** Tier-1 keywords used by the fallback text parser. */
const FALLBACK_TIER_1 = ["clinical", "therapy", "surgery", "paramedic", "midwifery"];
/** Tier-2 keywords used by the fallback text parser. */
const FALLBACK_TIER_2 = ["health", "science", "analytics", "data", "statistics"];

/**
 * Resolve the course difficulty coefficient (beta) for a degree title.
 * Exact dictionary hits win; otherwise the title is parsed case-insensitively.
 */
export function getDisciplineBeta(degreeTitle: string): number {
  const title = (degreeTitle ?? "").toLowerCase().trim();
  if (!title) return 1.0;

  if (DISCIPLINE_BETA[title] !== undefined) return DISCIPLINE_BETA[title];

  // Ordered longest-first so "computer science" beats "science".
  const keys = Object.keys(DISCIPLINE_BETA).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const beta = DISCIPLINE_BETA[key];
    if (beta !== undefined && title.includes(key)) return beta;
  }

  if (FALLBACK_TIER_1.some((w) => title.includes(w))) return 1.15;
  if (FALLBACK_TIER_2.some((w) => title.includes(w))) return 1.05;
  return 1.0;
}

/* ------------------------------------------------- baseline IRTO formula */

const HOURS_WEIGHT = 0.65;
const MAX_SCORE = 100;

/** AdjustedGPA = (RawGPA * beta) + (WeeklyHours * 0.65), capped at 100. */
export function calculateAdjustedGpa(rawGpa: number, weeklyHours: number, beta: number): number {
  const raw = rawGpa * beta + weeklyHours * HOURS_WEIGHT;
  return Math.min(MAX_SCORE, Math.round(raw * 10) / 10);
}

/* --------------------------------------------- frontline sector multiplier */

const FRONTLINE_SECTORS: WorkSector[] = ["Hospitality", "Retail", "Hospital / Clinical Care"];
const FRONTLINE_BOOST = 1.5;

function applyFrontlineBoost(skills: SoftSkills, sector: WorkSector) {
  const boosted = FRONTLINE_SECTORS.includes(sector);
  if (!boosted) return { skills, boosted };
  return {
    boosted,
    skills: {
      ...skills,
      pressureResilience: Math.min(100, skills.pressureResilience + FRONTLINE_BOOST),
      crisisManagement: Math.min(100, skills.crisisManagement + FRONTLINE_BOOST),
    },
  };
}

/* ------------------------------------------------------ hard gate matrix */

function evaluateHardGates(student: StudentProfile, filter: FilterCriteria): string[] {
  const m = filter.mandatory;
  const failures: string[] = [];
  if (!m) return failures;

  if (m.visaStatuses?.length && !m.visaStatuses.includes(student.visaStatus)) {
    failures.push("Visa / citizenship status");
  }
  if (m.disciplines?.length && !m.disciplines.includes(student.discipline)) {
    failures.push("Discipline");
  }
  if (m.yearLevels?.length && !m.yearLevels.includes(student.yearLevel)) {
    failures.push("Year level");
  }
  if (m.studyModes?.length && !m.studyModes.includes(student.studyMode)) {
    failures.push("Study mode");
  }
  if (m.studyLoads?.length && !m.studyLoads.includes(student.studyLoad)) {
    failures.push("Study load");
  }
  if (m.studyLoadRange) {
    const [min, max] = m.studyLoadRange;
    if (student.studyLoad < min || student.studyLoad > max) failures.push("Study load");
  }
  if (m.bornOnOrBefore !== undefined && student.birthYear > m.bornOnOrBefore) {
    failures.push("Mature age boundary");
  }
  if (m.bornOnOrAfter !== undefined && student.birthYear < m.bornOnOrAfter) {
    failures.push("Age boundary");
  }
  return failures;
}

/* ------------------------------------------- preferred criteria funnel */

/** 1 when identical, decaying linearly to 0 across the full 0-100 range. */
function proximity(actual: number, target: number): number {
  // Exceeding the target is never penalised.
  if (actual >= target) return 1;
  return Math.max(0, 1 - (target - actual) / 100);
}

function calculateGritMatchFit(
  student: StudentProfile,
  skills: SoftSkills,
  adjustedGpa: number,
  filter: FilterCriteria,
): number {
  const p = filter.preferred;
  if (!p) return Math.round(adjustedGpa);

  const parts: Array<{ weight: number; value: number }> = [];

  if (p.adjustedGpa !== undefined) {
    parts.push({ weight: 3, value: proximity(adjustedGpa, p.adjustedGpa) });
  }
  if (p.clientEmpathy !== undefined) {
    parts.push({ weight: 2, value: proximity(skills.clientEmpathy, p.clientEmpathy) });
  }
  if (p.pressureResilience !== undefined) {
    parts.push({ weight: 2, value: proximity(skills.pressureResilience, p.pressureResilience) });
  }
  if (p.crisisManagement !== undefined) {
    parts.push({ weight: 1, value: proximity(skills.crisisManagement, p.crisisManagement) });
  }
  if (p.equityTags?.length) {
    const hits = p.equityTags.filter((t) => student.equityTags.includes(t)).length;
    parts.push({ weight: 2, value: hits / p.equityTags.length });
  }

  if (!parts.length) return Math.round(adjustedGpa);

  const totalWeight = parts.reduce((s, x) => s + x.weight, 0);
  const weighted = parts.reduce((s, x) => s + x.weight * x.value, 0);
  return Math.round((weighted / totalWeight) * 100);
}

/* ------------------------------------------------------------ public API */

/**
 * Score a single student against an organisation's criteria.
 * Hard gates are evaluated first; failing candidates still return a result
 * object so callers can explain the rejection, but `passedHardGates` is false.
 */
export function calculateIrtoScore(
  student: StudentProfile,
  filter: FilterCriteria = {},
): IrtoResult {
  const beta = getDisciplineBeta(student.degreeTitle);
  const adjustedGpa = calculateAdjustedGpa(student.rawGpa, student.weeklyHours, beta);
  const { skills, boosted } = applyFrontlineBoost(student.softSkills, student.workSector);
  const gateFailures = evaluateHardGates(student, filter);
  const passedHardGates = gateFailures.length === 0;

  return {
    student,
    beta,
    adjustedGpa,
    softSkills: skills,
    frontlineBoost: boosted,
    passedHardGates,
    gateFailures,
    gritMatchFit: passedHardGates
      ? calculateGritMatchFit(student, skills, adjustedGpa, filter)
      : 0,
  };
}

/**
 * Run the two-tier matching matrix across a cohort: discard hard-gate
 * failures, then sort survivors by Grit Match Fit descending.
 */
export function rankCandidates(
  students: StudentProfile[],
  filter: FilterCriteria = {},
): IrtoResult[] {
  return students
    .map((s) => calculateIrtoScore(s, filter))
    .filter((r) => r.passedHardGates)
    .sort((a, b) => b.gritMatchFit - a.gritMatchFit || b.adjustedGpa - a.adjustedGpa);
}
