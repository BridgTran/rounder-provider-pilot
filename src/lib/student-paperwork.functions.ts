import { createServerFn } from "@tanstack/react-start";
import { studentIntakeTokenSchema } from "./invite-schema";
import { documentsSchema, snippetsSchema, saveSnippetsSchema, documentTypeSchema, validateDocumentFile, requireOpenUploads } from "./paperwork-schema";
import { createInvitationClient, registerUploadedDocument } from "./student-paperwork.server";
import type { z } from "zod";

export const studentGetDocuments = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => studentIntakeTokenSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: result, error } = await createInvitationClient().rpc("student_get_documents", { p_token: data.token });
    if (error) throw new Error(error.message);
    return documentsSchema.parse(result);
  });

export const studentGetSnippets = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => studentIntakeTokenSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: result, error } = await createInvitationClient().rpc("student_get_snippets", { p_token: data.token });
    if (error) throw new Error(error.message);
    return snippetsSchema.parse(result);
  });

export const studentSaveSnippets = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof saveSnippetsSchema>) => saveSnippetsSchema.parse(input))
  .handler(async ({ data }) => {
    const { error } = await createInvitationClient().rpc("student_save_snippets", {
      p_token: data.token, p_community: data.communityText, p_next_study: data.nextStudyText,
    });
    if (error) throw new Error(error.message);
    return { saved: true };
  });

export const studentUploadDocument = createServerFn({ method: "POST" })
  .inputValidator((input: FormData) => {
    if (!(input instanceof FormData)) throw new Error("Choose a document to upload.");
    return input;
  })
  .handler(async ({ data }) => {
    const { token } = studentIntakeTokenSchema.parse({ token: data.get("token") });
    const client = createInvitationClient();
    const { data: result, error: accessError } = await client.rpc("student_get_documents", { p_token: token });
    if (accessError) throw new Error(accessError.message);
    const access = documentsSchema.parse(result);
    requireOpenUploads(access.uploadOpen);
    const docType = documentTypeSchema.parse(data.get("docType"));
    if (!access.required.includes(docType)) throw new Error("This document type is not required.");
    const file = data.get("file");
    if (!(file instanceof File)) throw new Error("Choose a document to upload.");
    const ext = validateDocumentFile(file);
    const path = `${access.studentId}/${docType}/${crypto.randomUUID()}.${ext}`;
    // Admin storage is reached only after the invitation RPC authorizes this upload.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bucket = supabaseAdmin.storage.from("student-documents");
    await registerUploadedDocument(path, {
      store: async () => {
        const { error } = await bucket.upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw new Error("Could not store the document. Please try again.");
      },
      register: async () => {
        const { data: previous, error } = await client.rpc("student_register_document", {
          p_token: token, p_doc_type: docType, p_path: path, p_name: file.name, p_mime: file.type, p_size: file.size,
        });
        if (error) throw new Error(error.message);
        return previous;
      },
      remove: async (objectPath) => {
        // Never accept arbitrary paths from the browser or delete another student's object.
        if (!objectPath.startsWith(`${access.studentId}/`) || objectPath.includes("..")) throw new Error("Could not clean up the previous document.");
        const { error } = await bucket.remove([objectPath]);
        if (error) throw new Error("Could not finish document cleanup. Please contact Rounder.");
      },
    });
    return { uploaded: true };
  });