import { z } from "zod";
import { documentTypes } from "./paperwork-schema";

export const adminStudentSchema = z.object({ studentId: z.string().uuid() });
export const adminDocumentSchema = z.object({ documentId: z.string().uuid() });
export const reviewStatementsSchema = adminStudentSchema.extend({
  communityText: z.string().max(300, "Each answer must be 300 characters or fewer"),
  nextStudyText: z.string().max(300, "Each answer must be 300 characters or fewer"),
  approve: z.boolean(),
});
export const reviewDocumentSchema = z.discriminatedUnion("status", [
  adminDocumentSchema.extend({ status: z.literal("checked"), note: z.string().max(500).default("") }),
  adminDocumentSchema.extend({ status: z.literal("rejected"), note: z.string().trim().min(1, "Enter a reason for rejecting this document.").max(500, "Notes must be 500 characters or fewer.") }),
]);
export const documentLinkSeconds = 60;
export const adminDocumentLabels: Record<string, string> = {
  transcript: "Academic transcript", statement: "Personal statement", referee_1: "Referee letter 1",
  referee_2: "Referee letter 2", residency: "Proof of residency",
};
export function checkedDocumentCount(documents: { doc_type: string; status: string }[]) {
  return documentTypes.filter((type) => documents.some((document) => document.doc_type === type && document.status === "checked")).length;
}
export function pendingStatementsFirst<T extends { status: string }>(statements: T[]): T[] {
  return [...statements].sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending"));
}