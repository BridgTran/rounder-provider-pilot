import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { adminDocumentSchema, adminStudentSchema, documentLinkSeconds, pendingStatementsFirst, reviewDocumentSchema, reviewStatementsSchema } from "./admin-paperwork-schema";
import type { z } from "zod";

export const adminListSnippets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: allowed, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !allowed) throw new Error("Administrator sign-in required");
    const { data, error } = await context.supabase.rpc("admin_list_snippets");
    if (error) throw new Error(error.message);
    return pendingStatementsFirst(data ?? []);
  });

export const adminReviewSnippets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof reviewStatementsSchema>) => reviewStatementsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !allowed) throw new Error("Administrator sign-in required");
    const { error } = await context.supabase.rpc("admin_review_snippets", {
      p_student_id: data.studentId, p_community: data.communityText, p_next_study: data.nextStudyText, p_approve: data.approve,
    });
    if (error) throw new Error(error.message);
    return { approved: data.approve };
  });

export const adminListDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof adminStudentSchema>) => adminStudentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !allowed) throw new Error("Administrator sign-in required");
    const { data: documents, error } = await context.supabase.rpc("admin_list_documents", { p_student_id: data.studentId });
    if (error) throw new Error(error.message);
    // Private object paths are resolved only by the viewing endpoint, never listed in browser data.
    return (documents ?? []).map(({ id, doc_type, file_name, status, admin_note, uploaded_at }) => ({ id, doc_type, file_name, status, admin_note, uploaded_at }));
  });

export const adminViewDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof adminDocumentSchema>) => adminDocumentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !allowed) throw new Error("Administrator sign-in required");
    const { data: path, error } = await context.supabase.rpc("admin_document_path", { p_document_id: data.documentId });
    if (error) throw new Error(error.message);
    if (!path) throw new Error("This document is no longer available.");
    // The authenticated RPC authorizes the document before privileged storage access.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link, error: signingError } = await supabaseAdmin.storage.from("student-documents").createSignedUrl(path, documentLinkSeconds);
    if (signingError || !link) throw new Error("Could not open this document. Please try again.");
    const serverBase = process.env["SUPABASE_URL"];
    const browserBase = import.meta.env["VITE_SUPABASE_URL"];
    return { url: serverBase && browserBase ? link.signedUrl.replace(serverBase, browserBase) : link.signedUrl };
  });

export const adminReviewDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof reviewDocumentSchema>) => reviewDocumentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !allowed) throw new Error("Administrator sign-in required");
    const { error } = await context.supabase.rpc("admin_review_document", { p_document_id: data.documentId, p_status: data.status, p_note: data.note });
    if (error) throw new Error(error.message);
    return { status: data.status };
  });