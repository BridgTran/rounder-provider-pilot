import { describe, expect, it } from "vitest";
import { checkedDocumentCount, documentLinkSeconds, pendingStatementsFirst, reviewDocumentSchema, reviewStatementsSchema } from "./admin-paperwork-schema";

const studentId = "11111111-1111-4111-8111-111111111111";
const documentId = "22222222-2222-4222-8222-222222222222";
describe("admin paperwork review", () => {
  it("limits both edited statements to 300 characters", () => {
    const input = { studentId, communityText: "a".repeat(300), nextStudyText: "b".repeat(300), approve: true };
    expect(reviewStatementsSchema.safeParse(input).success).toBe(true);
    expect(reviewStatementsSchema.safeParse({ ...input, communityText: "a".repeat(301) }).success).toBe(false);
    expect(reviewStatementsSchema.safeParse({ ...input, nextStudyText: "b".repeat(301) }).success).toBe(false);
  });
  it("requires a nonblank rejection note of at most 500 characters", () => {
    const input = { documentId, status: "rejected", note: "a".repeat(500) };
    expect(reviewDocumentSchema.safeParse(input).success).toBe(true);
    expect(reviewDocumentSchema.safeParse({ ...input, note: "a".repeat(501) }).success).toBe(false);
    expect(reviewDocumentSchema.safeParse({ ...input, note: "   " }).success).toBe(false);
    expect(reviewDocumentSchema.safeParse({ documentId, status: "checked", note: "" }).success).toBe(true);
  });
  it("counts the five distinct required document types only when checked", () => {
    const documents = ["transcript", "statement", "referee_1", "referee_2", "residency"].map((doc_type) => ({ doc_type, status: "checked" }));
    expect(checkedDocumentCount(documents)).toBe(5);
    expect(checkedDocumentCount([...documents, documents[0] ?? { doc_type: "transcript", status: "checked" }])).toBe(5);
    expect(checkedDocumentCount(documents.map((d) => d.doc_type === "residency" ? { ...d, status: "rejected" } : d))).toBe(4);
    expect(checkedDocumentCount([{ doc_type: "other", status: "checked" }])).toBe(0);
  });
  it("places pending statements before approved or rejected statements", () => {
    expect(pendingStatementsFirst([{ id: "approved", status: "approved" }, { id: "pending", status: "pending" }, { id: "rejected", status: "rejected" }]).map((s) => s.id)).toEqual(["pending", "approved", "rejected"]);
  });
  it("expires signed document links after 60 seconds", () => {
    expect(documentLinkSeconds).toBe(60);
  });
});