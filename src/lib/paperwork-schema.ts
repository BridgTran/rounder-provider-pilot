import { z } from "zod";

export const documentTypes = ["transcript", "statement", "referee_1", "referee_2", "residency"] as const;
export const documentTypeSchema = z.enum(documentTypes);
export const maxDocumentBytes = 10 * 1024 * 1024;
export const documentMimeExtensions = {
  "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg",
} as const;
export const documentsSchema = z.object({
  studentId: z.string().uuid(), uploadOpen: z.boolean(), required: z.array(documentTypeSchema),
  documents: z.array(z.object({
    docType: z.string(), fileName: z.string(), status: z.enum(["uploaded", "checked", "rejected"]), note: z.string(),
  })),
});
export const snippetsSchema = z.object({
  communityText: z.string(), nextStudyText: z.string(),
  status: z.enum(["none", "pending", "approved", "rejected"]), editOpen: z.boolean(),
});
export const saveSnippetsSchema = z.object({
  token: z.string().min(64).max(128),
  communityText: z.string().max(300, "Each answer must be 300 characters or fewer"),
  nextStudyText: z.string().max(300, "Each answer must be 300 characters or fewer"),
});

export function validateDocumentFile(file: Pick<File, "size" | "type" | "name">) {
  if (file.size < 1) throw new Error("Choose a non-empty file.");
  if (file.size > maxDocumentBytes) throw new Error("Files must be 10 MB or smaller.");
  if (!Object.hasOwn(documentMimeExtensions, file.type)) throw new Error("Choose a PDF, PNG or JPG file.");
  if (!file.name || file.name.length > 200) throw new Error("File names must be between 1 and 200 characters.");
  return documentMimeExtensions[file.type as keyof typeof documentMimeExtensions];
}

export function requireOpenUploads(uploadOpen: boolean) {
  if (!uploadOpen) throw new Error("Uploads are not open for your application");
}