import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fundCandidateSchema, fundNotesSchema, mergeCandidateNote, providerDocumentSchema, providerDownloadSeconds, releasedPackageSchema, saveCandidateNoteSchema } from "./provider-review-schema";
import type { z } from "zod";

export const listCandidateNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof fundNotesSchema>) => fundNotesSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: notes, error } = await context.supabase.from("candidate_notes").select("student_id,considered,note").eq("fund_id", data.fundId);
    if (error) throw new Error(error.message);
    return notes ?? [];
  });

export const getFundRuleResultsAll = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof fundNotesSchema>) => fundNotesSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: results, error } = await context.supabase.rpc("fund_rule_results_all", { p_fund_id: data.fundId });
    if (error) throw new Error(error.message);
    return results ?? [];
  });

export const saveCandidateNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof saveCandidateNoteSchema>) => saveCandidateNoteSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Read current persisted values so star-only and note-only saves preserve the other field.
    const { data: existing, error: readError } = await context.supabase.from("candidate_notes").select("considered,note").eq("fund_id", data.fundId).eq("student_id", data.studentId).maybeSingle();
    if (readError) throw new Error(readError.message);
    const note = mergeCandidateNote(existing, {
      ...(data.considered !== undefined ? { considered: data.considered } : {}),
      ...(data.note !== undefined ? { note: data.note } : {}),
    });
    const { error } = await context.supabase.rpc("save_candidate_note", { p_fund_id: data.fundId, p_student_id: data.studentId, p_considered: note.considered, p_note: note.note });
    if (error) throw new Error(error.message);
    return note;
  });

export const getReleasedPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof fundCandidateSchema>) => fundCandidateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("provider_released_package", { p_fund_id: data.fundId, p_student_id: data.studentId });
    if (error) throw new Error(error.message);
    return releasedPackageSchema.parse(result);
  });

export const downloadProviderDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof providerDocumentSchema>) => providerDocumentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: path, error } = await context.supabase.rpc("provider_document_path", { p_document_id: data.documentId });
    if (error) throw new Error(error.message);
    if (!path) throw new Error("Document not available");
    // Only the session-authorized RPC can choose a path for privileged storage signing.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link, error: signingError } = await supabaseAdmin.storage.from("student-documents").createSignedUrl(path, providerDownloadSeconds, { download: true });
    if (signingError || !link) throw new Error("Could not download this document. Please try again.");
    const serverBase = process.env["SUPABASE_URL"];
    const browserBase = import.meta.env["VITE_SUPABASE_URL"];
    // Return a signed capability only (never a raw path); the caller performs the redirect.
    return { url: serverBase && browserBase ? link.signedUrl.replace(serverBase, browserBase) : link.signedUrl };
  });