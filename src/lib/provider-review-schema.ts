import { z } from "zod";

export const fundCandidateSchema = z.object({ fundId: z.string().uuid(), studentId: z.string().uuid() });
export const fundNotesSchema = z.object({ fundId: z.string().uuid() });
export const saveCandidateNoteSchema = fundCandidateSchema.extend({
  considered: z.boolean().optional(), note: z.string().max(1000, "Notes must be 1000 characters or fewer.").optional(),
});
export const providerDocumentSchema = z.object({ documentId: z.string().uuid() });
export const providerDownloadSeconds = 60;
export const releasedPackageSchema = z.object({
  legalName: z.string(), email: z.string(), phone: z.string(),
  communityText: z.string().default(""), nextStudyText: z.string().default(""), releasedAt: z.string(),
  documents: z.array(z.object({ id: z.string().uuid(), docType: z.string(), fileName: z.string(), mimeType: z.string() })),
});
export function mergeCandidateNote(existing: { considered: boolean; note: string } | null, input: { considered?: boolean; note?: string }) {
  return { considered: input.considered ?? existing?.considered ?? false, note: input.note ?? existing?.note ?? "" };
}
export function filterConsidered<T extends { student: { id: string } }>(candidates: T[], consideredIds: ReadonlySet<string>, only: boolean) {
  return only ? candidates.filter((candidate) => consideredIds.has(candidate.student.id)) : candidates;
}
export function releasedForFund<T extends { fundId: string | null; stage: string }>(applications: T[], fundId: string) {
  return applications.filter((application) => application.fundId === fundId && application.stage === "released");
}