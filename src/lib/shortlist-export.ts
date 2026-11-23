import type { FundRules } from "./fund-schema";
import { describeRule } from "./rule-wording";

export type ExportCandidate = { id: string; candidateCode: string; degree: string; discipline: string; studyLoad: number; studyMode: string; rawGpa: number };
export type ExportRuleResult = { student_id: string; rule_key: string; preferred: boolean; met: boolean };
export type ExportNote = { student_id: string; considered: boolean; note: string };
export type ShortlistTable = { headers: string[]; rows: (string | number)[][] };

export function buildShortlistTable(candidates: ExportCandidate[], results: ExportRuleResult[], notes: ExportNote[], fund: { rules: FundRules; discipline: string }, starredOnly: boolean): ShortlistTable {
  const preferredKeys = [...new Set(results.filter((result) => result.preferred).map((result) => result.rule_key))].sort();
  const headers = ["Rank", "Candidate code", "Preferences met", ...preferredKeys.map((key) => describeRule(key, fund.rules, fund.discipline)), "Degree", "Discipline", "Study load", "Study mode", "Expected completion year", "GPA/WAM", "Considered", "Private note"];
  const rows = candidates.flatMap((candidate, index) => {
    const note = notes.find((item) => item.student_id === candidate.id);
    if (starredOnly && !note?.considered) return [];
    const rules = results.filter((result) => result.student_id === candidate.id);
    const preferences = rules.filter((result) => result.preferred);
    const completion = rules.find((result) => result.rule_key === "completionYear" && result.met);
    return [[index + 1, candidate.candidateCode, `${preferences.filter((result) => result.met).length} of ${preferences.length}`, ...preferredKeys.map((key) => rules.some((result) => result.rule_key === key && result.met) ? "Yes" : "No"), candidate.degree, candidate.discipline, `${candidate.studyLoad >= 75 ? "Full-time" : "Part-time"} (${candidate.studyLoad}% load)`, ({ Internal: "On campus", Online: "Online", Hybrid: "Mixed on campus and online" } as Record<string, string>)[candidate.studyMode] ?? candidate.studyMode, completion && fund.rules.completionYear ? fund.rules.completionYear : "Not shared", candidate.rawGpa, note?.considered ? "Yes" : "No", note?.note ?? ""]];
  });
  return { headers, rows };
}

export function shortlistCsv(table: ShortlistTable): string {
  const cell = (value: string | number) => {
    const text = String(value);
    // Prevent spreadsheet formulas in editable notes and other text fields.
    const safe = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return "\uFEFF" + [table.headers, ...table.rows].map((row) => row.map(cell).join(",")).join("\r\n");
}