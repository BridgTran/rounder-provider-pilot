import { describe, expect, it } from "vitest";
import { emptyFundRules } from "./fund-schema";
import { buildShortlistTable, shortlistCsv } from "./shortlist-export";

const candidates = [{ id: "b", candidateCode: "#B", degree: "Bachelor", discipline: "Health", studyLoad: 100, studyMode: "Internal", rawGpa: 85, legalName: "SECRET NAME", email: "secret@example.invalid", phone: "SECRET PHONE", communityText: "SECRET STATEMENT" }, { id: "a", candidateCode: "#A", degree: "Bachelor", discipline: "Science", studyLoad: 50, studyMode: "Online", rawGpa: 75 }];
const results = [{ student_id: "b", rule_key: "studyMode", preferred: true, met: true }, { student_id: "a", rule_key: "studyMode", preferred: true, met: false }, { student_id: "b", rule_key: "completionYear", preferred: false, met: true }];
const fund = { rules: { ...emptyFundRules(), completionYear: 2026, studyMode: "on-campus" as const }, discipline: "All Disciplines" };
describe("anonymous shortlist exports", () => {
  it("never exports identity or statement fields from candidates", () => {
    const csv = shortlistCsv(buildShortlistTable(candidates, results, [], fund, false));
    expect(csv).toContain('#B');
    for (const secret of ["SECRET NAME", "secret@example.invalid", "SECRET PHONE", "SECRET STATEMENT"]) expect(csv).not.toContain(secret);
  });
  it("keeps ranking and filters starred candidates without reranking", () => {
    const table = buildShortlistTable(candidates, results, [{ student_id: "a", considered: true, note: "Private" }], fund, true);
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0]?.slice(0, 4)).toEqual([2, "#A", "0 of 1", "No"]);
  });
  it("includes readable preferred rules, Yes/No results and the year only when supported", () => {
    const table = buildShortlistTable(candidates, results, [], fund, false);
    expect(table.headers[3]).toBe("Studies on campus");
    expect(table.rows[0]?.slice(0, 4)).toEqual([1, "#B", "1 of 1", "Yes"]);
    expect(table.rows[0]?.[8]).toBe(2026);
    expect(table.rows[1]?.[8]).toBe("Not shared");
  });
  it("includes private notes and escapes CSV quotes, newlines and formulas", () => {
    expect(shortlistCsv({ headers: ["Private note"], rows: [['=SUM(1,2)'], ['A "quote"\nline']] })).toContain('"\'=SUM(1,2)"');
    expect(shortlistCsv({ headers: ["Private note"], rows: [['A "quote"\nline']] })).toContain('"A ""quote""\nline"');
  });
});