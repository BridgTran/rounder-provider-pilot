import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { studentGetDocuments, studentGetSnippets, studentSaveSnippets, studentUploadDocument } from "@/lib/student-paperwork.functions";
import { validateDocumentFile, type snippetsSchema, type documentTypes } from "@/lib/paperwork-schema";
import type { z } from "zod";

const documentLabels: Record<typeof documentTypes[number], string> = {
  transcript: "Academic transcript", statement: "Personal statement", referee_1: "Referee letter 1",
  referee_2: "Referee letter 2", residency: "Proof of residency",
};
const snippetLabels = {
  none: "", pending: "Waiting for Rounder's review", approved: "Approved",
  rejected: "Rounder couldn't approve this. Please edit and resubmit.",
};
const documentStatusLabels = { uploaded: "Waiting for Rounder to check", checked: "Checked", rejected: "Needs replacing" };

function StatementForm({ token, statements }: { token: string; statements: z.infer<typeof snippetsSchema> }) {
  const [communityText, setCommunityText] = useState(statements.communityText);
  const [nextStudyText, setNextStudyText] = useState(statements.nextStudyText);
  const saveStatements = useServerFn(studentSaveSnippets);
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: () => saveStatements({ data: { token, communityText, nextStudyText } }),
    onSuccess: async () => {
      toast.success("Saved. Rounder will review it.");
      await client.invalidateQueries({ queryKey: ["student-snippets", token] });
    },
    onError: (error) => toast.error(error.message),
  });
  return <form className="mt-5 space-y-5" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
    {snippetLabels[statements.status] && <p role="status" className={statements.status === "rejected" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{snippetLabels[statements.status]}</p>}
    <div className="space-y-2"><Label htmlFor="community-statement">Briefly describe your community contribution</Label>
      <Textarea id="community-statement" value={communityText} maxLength={300} readOnly={!statements.editOpen} disabled={save.isPending} rows={4} onChange={(event) => setCommunityText(event.target.value)} aria-describedby="community-count" />
      <p id="community-count" className="text-right text-xs tabular-nums text-muted-foreground" aria-live="polite">{communityText.length} / 300</p>
    </div>
    <div className="space-y-2"><Label htmlFor="next-study-statement">What do you plan to study next year, and why?</Label>
      <Textarea id="next-study-statement" value={nextStudyText} maxLength={300} readOnly={!statements.editOpen} disabled={save.isPending} rows={4} onChange={(event) => setNextStudyText(event.target.value)} aria-describedby="next-study-count" />
      <p id="next-study-count" className="text-right text-xs tabular-nums text-muted-foreground" aria-live="polite">{nextStudyText.length} / 300</p>
    </div>
    <p className="text-xs text-muted-foreground">Editing sends this back to Rounder for review.</p>
    {statements.editOpen && <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save statements"}</Button>}
  </form>;
}

export function StudentPaperwork({ token }: { token: string }) {
  const client = useQueryClient();
  const getDocuments = useServerFn(studentGetDocuments);
  const getStatements = useServerFn(studentGetSnippets);
  const uploadDocument = useServerFn(studentUploadDocument);
  const documents = useQuery({ queryKey: ["student-documents", token], queryFn: () => getDocuments({ data: { token } }), retry: false });
  const snippets = useQuery({ queryKey: ["student-snippets", token], queryFn: () => getStatements({ data: { token } }), enabled: documents.data?.uploadOpen === true, retry: false });
  useEffect(() => { if (documents.error) toast.error(documents.error.message); }, [documents.error]);
  useEffect(() => { if (snippets.error) toast.error(snippets.error.message); }, [snippets.error]);
  const upload = useMutation({
    mutationFn: ({ file, docType }: { file: File; docType: typeof documentTypes[number] }) => {
      validateDocumentFile(file);
      const data = new FormData(); data.set("token", token); data.set("docType", docType); data.set("file", file);
      return uploadDocument({ data });
    },
    onSuccess: async () => {
      toast.success("Document uploaded. Rounder will check it.");
      await client.invalidateQueries({ queryKey: ["student-documents", token] });
    }, onError: (error) => toast.error(error.message),
  });
  const paperwork = documents.data;
  return <section className="mt-10 border-t border-border pt-6" aria-labelledby="paperwork-heading">
    <h2 id="paperwork-heading" className="text-xl">Your paperwork</h2>
    {documents.isPending ? <p className="mt-4 text-sm text-muted-foreground">Loading paperwork…</p> : documents.error ?
      <div className="mt-4 space-y-3"><p role="alert" className="text-sm text-destructive">{documents.error.message}</p><Button variant="outline" onClick={() => void documents.refetch()}>Retry</Button></div> : !paperwork?.uploadOpen ?
      <p className="mt-4 text-sm text-muted-foreground">If you are shortlisted, Rounder will ask you for some paperwork here.</p> : <div className="mt-5 space-y-6">
        <article className="rounded-lg border border-border p-5">
          <h3 className="text-lg">In your own words</h3>
          <p className="mt-3 text-sm text-muted-foreground">Rounder reviews this and may edit it to remove names or anything that could identify you. Scholarship providers only see it once Rounder has checked your paperwork and your application is released to them. Please don't include names of people, your university or contact details.</p>
          {snippets.data ? <StatementForm token={token} statements={snippets.data} key={`${snippets.data.communityText}:${snippets.data.nextStudyText}`} /> : snippets.error ? <div className="mt-4 space-y-3"><p role="alert" className="text-sm text-destructive">{snippets.error.message}</p><Button variant="outline" onClick={() => void snippets.refetch()}>Retry statements</Button></div> : <p className="mt-4 text-sm text-muted-foreground">Loading statements…</p>}
        </article>
        <article className="rounded-lg border border-border p-5">
          <h3 className="text-lg">Your documents</h3>
          <p className="mt-2 text-xs text-muted-foreground">PDF, PNG or JPG · 10 MB maximum per file</p>
          <div className="mt-4 divide-y divide-border">{paperwork.required.map((docType) => {
            const document = paperwork.documents.find((item) => item.docType === docType);
            const pending = upload.isPending && upload.variables?.docType === docType;
            return <div key={docType} className="space-y-3 py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-2"><Label htmlFor={`document-${docType}`}>{documentLabels[docType]}</Label>{document && <Badge variant={document.status === "rejected" ? "destructive" : document.status === "checked" ? "default" : "secondary"}>{documentStatusLabels[document.status]}</Badge>}</div>
              {document && <p className="break-all text-sm">{document.fileName}</p>}
              {document?.status === "rejected" && document.note && <p className="break-words text-sm text-destructive">{document.note}</p>}
              <Input id={`document-${docType}`} type="file" accept="application/pdf,image/png,image/jpeg" disabled={upload.isPending} className="h-auto min-h-10 min-w-0 py-2" onChange={(event) => {
                const file = event.target.files?.[0]; event.target.value = "";
                if (file) upload.mutate({ file, docType });
              }} />
              {pending && <p role="status" className="text-xs text-muted-foreground">Uploading…</p>}
            </div>;
          })}</div>
        </article>
      </div>}
  </section>;
}