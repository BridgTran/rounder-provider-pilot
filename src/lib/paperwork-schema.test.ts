import { describe, it, expect } from "vitest";
import { maxDocumentBytes, validateDocumentFile, saveSnippetsSchema, requireOpenUploads } from "./paperwork-schema";
import { registerUploadedDocument } from "./student-paperwork.server";

describe("paperwork limits", () => {
  it("allows exactly 10 MB and refuses one byte more", () => {
    expect(maxDocumentBytes).toBe(10485760);
    expect(validateDocumentFile({ name: "transcript.pdf", type: "application/pdf", size: 10485760 })).toBe("pdf");
    expect(() => validateDocumentFile({ name: "transcript.pdf", type: "application/pdf", size: 10485761 })).toThrow("10 MB");
  });
  it("allows only PDF, PNG and JPEG", () => {
    for (const [type, ext] of [["application/pdf", "pdf"], ["image/png", "png"], ["image/jpeg", "jpg"]]) {
      expect(validateDocumentFile({ name: "file", type: type ?? "", size: 1 })).toBe(ext);
    }
    expect(() => validateDocumentFile({ name: "file.txt", type: "text/plain", size: 1 })).toThrow("PDF, PNG or JPG");
    expect(() => validateDocumentFile({ name: "file", type: "toString", size: 1 })).toThrow("PDF, PNG or JPG");
    expect(() => validateDocumentFile({ name: "file.pdf", type: "application/pdf", size: 0 })).toThrow("non-empty");
  });
  it("only allows upload when the invitation RPC says uploadOpen is true", () => {
    expect(() => requireOpenUploads(false)).toThrow("Uploads are not open");
    expect(() => requireOpenUploads(true)).not.toThrow();
  });
  it("limits each statement independently to 300 characters", () => {
    const input = { token: "a".repeat(64), communityText: "a".repeat(300), nextStudyText: "b".repeat(300) };
    expect(saveSnippetsSchema.safeParse(input).success).toBe(true);
    expect(saveSnippetsSchema.safeParse({ ...input, communityText: "a".repeat(301) }).success).toBe(false);
    expect(saveSnippetsSchema.safeParse({ ...input, nextStudyText: "b".repeat(301) }).success).toBe(false);
  });
});

describe("private upload replacement", () => {
  it("deletes the previous file only after successful registration", async () => {
    const calls: string[] = [];
    await registerUploadedDocument("new", {
      store: async () => { calls.push("store"); }, register: async () => { calls.push("register"); return "old"; },
      remove: async (path) => { calls.push(`remove:${path}`); },
    });
    expect(calls).toEqual(["store", "register", "remove:old"]);
  });
  it("deletes the new object on registration failure and preserves the server error", async () => {
    const removed: string[] = [];
    await expect(registerUploadedDocument("new", {
      store: async () => {}, register: async () => { throw new Error("Uploads are not open"); },
      remove: async (path) => { removed.push(path); },
    })).rejects.toThrow("Uploads are not open");
    expect(removed).toEqual(["new"]);
  });
  it("does not register or remove anything if storage fails", async () => {
    const calls: string[] = [];
    await expect(registerUploadedDocument("new", {
      store: async () => { throw new Error("storage failure"); }, register: async () => { calls.push("register"); return null; },
      remove: async (path) => { calls.push(path); },
    })).rejects.toThrow("storage failure");
    expect(calls).toEqual([]);
  });
});