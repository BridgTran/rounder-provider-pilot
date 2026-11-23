import { describe, expect, it } from "vitest";
import { filterConsidered, mergeCandidateNote, providerDownloadSeconds, releasedForFund, saveCandidateNoteSchema } from "./provider-review-schema";

describe("provider review rules", () => {
  it("preserves the existing note when toggling only the star", () => {
    expect(mergeCandidateNote({ considered: false, note: "Keep this private note" }, { considered: true })).toEqual({ considered: true, note: "Keep this private note" });
  });
  it("preserves the star when saving only a note", () => {
    expect(mergeCandidateNote({ considered: true, note: "Old" }, { note: "New" })).toEqual({ considered: true, note: "New" });
  });
  it("allows 1000 characters but rejects 1001", () => {
    const input = { fundId: "11111111-1111-4111-8111-111111111111", studentId: "22222222-2222-4222-8222-222222222222" };
    expect(saveCandidateNoteSchema.safeParse({ ...input, note: "a".repeat(1000) }).success).toBe(true);
    expect(saveCandidateNoteSchema.safeParse({ ...input, note: "a".repeat(1001) }).success).toBe(false);
  });
  it("filters considered candidates without changing ranking order", () => {
    const candidates = ["b", "a", "c"].map((id) => ({ student: { id } }));
    expect(filterConsidered(candidates, new Set(["c", "b"]), true).map((c) => c.student.id)).toEqual(["b", "c"]);
    expect(filterConsidered(candidates, new Set(), false)).toEqual(candidates);
  });
  it("lists released applications for the selected fund only", () => {
    const applications = [{ fundId: "f", stage: "accepted" }, { fundId: "f", stage: "released" }, { fundId: "other", stage: "released" }];
    expect(releasedForFund(applications, "f")).toEqual([{ fundId: "f", stage: "released" }]);
  });
  it("expires document download links after 60 seconds", () => { expect(providerDownloadSeconds).toBe(60); });
});