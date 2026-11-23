import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminListDocuments, adminReviewDocument, adminViewDocument } from "@/lib/admin-paperwork.functions";
import { adminDocumentLabels, checkedDocumentCount, reviewDocumentSchema } from "@/lib/admin-paperwork-schema";

type Document = Awaited<ReturnType<typeof adminListDocuments>>[number];
function DocumentRow({ document, studentId, applicationId }: { document: Document; studentId: string; applicationId: string }) {
  const [note, setNote] = useState(document.admin_note);
  const reviewDocument = useServerFn(adminReviewDocument);
  const viewDocument = useServerFn(adminViewDocument);
  const client = useQueryClient();
  const review = useMutation({
    mutationFn: (status: "checked" | "rejected") => reviewDocument({ data: reviewDocumentSchema.parse({ documentId: document.id, status, note: status === "checked" ? "" : note }) }),
    onSuccess: async ({ status }) => {
      toast.success(status === "checked" ? "Document marked checked" : "Document rejected");
      await Promise.all([
        client.invalidateQueries({ queryKey: ["admin-documents", studentId] }),
        client.invalidateQueries({ queryKey: ["admin-applications"] }),
      ]);
    },
    onError: (error) => toast.error(error.message),
  });
  const view = useMutation({
    mutationFn: async (tab: Window) => {
      try {
        const { url } = await viewDocument({ data: { documentId: document.id } });
        tab.location.replace(url);
      } catch (error) { tab.close(); throw error; }
    },
    onError: (error) => toast.error(error.message),
  });
  const noteId = `document-note-${applicationId}-${document.id}`;
  return <div className="space-y-3 py-4 first:pt-0">
    <div className="flex flex-wrap items-start justify-between gap-2"><h4 className="font-medium">{adminDocumentLabels[document.doc_type] ?? document.doc_type}</h4><Badge variant={document.status === "rejected" ? "destructive" : document.status === "checked" ? "default" : "secondary"} className="capitalize">{document.status}</Badge></div>
    <p className="break-all text-sm">{document.file_name}</p>
    <p className="text-xs text-muted-foreground">Uploaded <time dateTime={document.uploaded_at}>{new Date(document.uploaded_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</time></p>
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={view.isPending} onClick={() => {
        // Open synchronously to avoid popup blocking; sever the opener before navigating to private media.
        const tab = window.open("about:blank", "_blank");
        if (!tab) { toast.error("Allow a new tab to view this document."); return; }
        tab.opener = null;
        view.mutate(tab);
      }}><ExternalLink className="size-4" aria-hidden="true" />{view.isPending ? "Opening…" : "View"}</Button>
      <Button size="sm" variant="outline" disabled={review.isPending || document.status === "checked"} onClick={() => review.mutate("checked")}>Mark checked</Button>
    </div>
    <div className="space-y-2"><Label htmlFor={noteId}>Rejection note (required to reject)</Label>
      <Textarea id={noteId} maxLength={500} rows={2} value={note} disabled={review.isPending} onChange={(event) => setNote(event.target.value)} aria-describedby={`${noteId}-count`} />
      <p id={`${noteId}-count`} className="text-right text-xs tabular-nums text-muted-foreground" aria-live="polite">{note.length} / 500</p>
    </div>
    <Button size="sm" variant="outline" disabled={review.isPending} onClick={() => {
      const result = reviewDocumentSchema.safeParse({ documentId: document.id, status: "rejected", note });
      if (!result.success) { toast.error(result.error.issues[0]?.message ?? "Enter a rejection note."); return; }
      review.mutate("rejected");
    }}>Reject</Button>
  </div>;
}

export function AdminDocumentsPanel({ studentId, applicationId }: { studentId: string; applicationId: string }) {
  const [open, setOpen] = useState(false);
  const listDocuments = useServerFn(adminListDocuments);
  const documents = useQuery({ queryKey: ["admin-documents", studentId], queryFn: () => listDocuments({ data: { studentId } }), enabled: open, retry: false });
  useEffect(() => { if (documents.error) toast.error(documents.error.message); }, [documents.error]);
  return <details className="min-w-0" onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer py-2 font-semibold">Documents{documents.data && <span className="ml-3 text-xs font-normal text-muted-foreground">{checkedDocumentCount(documents.data)} of 5 required documents checked</span>}</summary>
    <div className="max-w-2xl py-3">
      {documents.isPending ? <p className="text-muted-foreground">Loading documents…</p> : documents.error ? <div className="space-y-3"><p role="alert" className="text-destructive">{documents.error.message}</p><Button size="sm" variant="outline" onClick={() => void documents.refetch()}>Retry documents</Button></div> : documents.data.length === 0 ? <p className="text-muted-foreground">No documents uploaded yet.</p> : <div className="divide-y divide-border">{documents.data.map((document) => <DocumentRow key={`${document.id}:${document.status}:${document.admin_note}`} document={document} studentId={studentId} applicationId={applicationId} />)}</div>}
    </div>
  </details>;
}