import { describe, expect, it } from "vitest";
import { compareByPreferencesThenCode } from "./candidate-order";

const candidates = [
  { id: "s1", candidateCode: "#AU-11111" },
  { id: "s2", candidateCode: "#AU-22222" },
  { id: "s3", candidateCode: "#AU-33333" },
  { id: "s4", candidateCode: "#AU-44444" },
];

describe("fund feed ordering", () => {
  it("lists candidates meeting more Preferred rules first", () => {
    const preferencesMet = new Map([
      ["s1", 1],
      ["s2", 3],
      ["s3", 2],
      ["s4", 0],
    ]);
    const ordered = [...candidates].sort((a, b) => compareByPreferencesThenCode(a, b, preferencesMet));
    expect(ordered.map((c) => c.candidateCode)).toEqual(["#AU-22222", "#AU-33333", "#AU-11111", "#AU-44444"]);
  });

  it("breaks ties on candidate code, not on insertion order", () => {
    const preferencesMet = new Map([
      ["s1", 2],
      ["s2", 2],
      ["s3", 2],
      ["s4", 2],
    ]);
    const ordered = [...candidates].reverse().sort((a, b) => compareByPreferencesThenCode(a, b, preferencesMet));
    expect(ordered.map((c) => c.candidateCode)).toEqual(["#AU-11111", "#AU-22222", "#AU-33333", "#AU-44444"]);
  });

  it("treats a missing count as zero preferences met", () => {
    const preferencesMet = new Map([["s1", 1]]);
    const ordered = [...candidates].sort((a, b) => compareByPreferencesThenCode(a, b, preferencesMet));
    expect(ordered[0]?.candidateCode).toBe("#AU-11111");
    expect(ordered.map((c) => c.candidateCode).slice(1)).toEqual(["#AU-22222", "#AU-33333", "#AU-44444"]);
  });
});
