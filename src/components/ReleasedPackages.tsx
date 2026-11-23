import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getReleasedPackage, downloadProviderDocument } from "@/lib/provider-review.functions";
import { releasedForFund } from "@/lib/provider-review-schema";
import { adminDocumentLabels } from "@/lib/admin-paperwork-schema";
import { documentTypes } from "@/lib/paperwork-schema";
import type { CandidateRecord, ProviderMatch } from "@/lib/provider.functions";

function PackageContents({ fundId, studentId }: { fundId: string; studentId: string }) {
  const getPackage = useServerFn(getReleasedPackage);
  const downloadDocument = useServerFn(downloadProviderDocument);
  const result = useQuery({ queryKey: ["released-package", fundId, studentId], queryFn: () => getPackage({ data: { fundId, studentId } }), retry: false });
  useEffect(() => { if (result.error) toast.error(result.error.message); }, [result.error]);
  const download = useMutation({
    mutationFn: async (documentId: string) => { const { url } = await downloadDocument({ data: { documentId } }); window.location.assign(url); },
    onError: (error) => toast.error(error.message),
  });
  if (result.isPending) return <p className="text-sm text-muted-foreground">Loading released package…</p>;
  if (result.error) return <div className="space-y-3"><p role="alert" className="text-sm text-destructive">{result.error.message}</p><Button variant="outline" onClick={() => void result.refetch()}>Retry</Button></div>;
  const pack = result.data;
  const hasStatements = !!(pack.communityText.trim() || pack.nextStudyText.trim());
  const documents = [...pack.documents].sort((a, b) => documentTypes.indexOf(a.docType as typeof documentTypes[number]) - documentTypes.indexOf(b.docType as typeof documentTypes[number]));
  return <div className="space-y-6">
    <section><h3 className="text-lg font-semibold break-words">{pack.legalName}</h3>
      <dl className="mt-3 space-y-2 text-sm"><div><dt className="text-muted-foreground">Email</dt><dd className="break-all"><a href={`mailto:${pack.email}`} className="underline">{pack.email || "Not provided"}</a></dd></div><div><dt className="text-muted-foreground">Phone</dt><dd className="break-words">{pack.phone || "Not provided"}</dd></div><div><dt className="text-muted-foreground">Released</dt><dd>{new Date(pack.releasedAt).toLocaleDateString("en-AU")}</dd></div></dl>
    </section>
    {hasStatements && <section className="border-t border-border pt-4"><h3 className="text-lg font-semibold">In their own words</h3>{pack.communityText.trim() && <div className="mt-3"><h4 className="text-xs font-semibold text-muted-foreground">Community contribution</h4><p className="mt-1 whitespace-pre-wrap break-words text-sm">{pack.communityText}</p></div>}{pack.nextStudyText.trim() && <div className="mt-3"><h4 className="text-xs font-semibold text-muted-foreground">Next study</h4><p className="mt-1 whitespace-pre-wrap break-words text-sm">{pack.nextStudyText}</p></div>}</section>}
    <section className="border-t border-border pt-4"><h3 className="text-lg font-semibold">Documents</h3>{documents.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No checked documents are available.</p> : <ul className="mt-3 divide-y divide-border">{documents.map((document) => <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{adminDocumentLabels[document.docType] ?? document.docType}</p><p className="mt-1 break-all text-xs text-muted-foreground">{document.fileName}</p></div><Button size="sm" variant="outline" disabled={download.isPending} onClick={() => download.mutate(document.id)}><Download className="size-4" aria-hidden="true" />Download</Button></li>)}</ul>}</section>
  </div>;
}

export function ReleasedPackages({ fundId, fundTitle, matches, students }: { fundId: string; fundTitle: string; matches: ProviderMatch[]; students: CandidateRecord[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const released = releasedForFund(matches, fundId);
  return <section className="border-y border-border py-6" aria-labelledby="released-packages-title">
    <h2 id="released-packages-title" className="text-xl font-semibold">Released packages <span className="text-sm text-muted-foreground">· {released.length}</span></h2>
    {released.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No packages released for this fund yet.</p> : <ul className="mt-4 divide-y divide-border">{released.map((match) => <li key={match.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><p className="min-w-0 break-words font-semibold">{match.identity?.legalName || students.find((student) => student.id === match.studentId)?.candidateCode || "Released student"}</p><Button variant="outline" onClick={() => setSelected(match.studentId)}><FolderOpen className="size-4" aria-hidden="true" />Open package</Button></li>)}</ul>}
    <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}><DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto"><DialogHeader><DialogTitle>Released application package</DialogTitle><DialogDescription>{fundTitle}</DialogDescription></DialogHeader>{selected && <PackageContents fundId={fundId} studentId={selected} />}</DialogContent></Dialog>
  </section>;
}