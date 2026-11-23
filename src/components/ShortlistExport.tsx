import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileDown, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getFundRuleResultsAll, listCandidateNotes } from "@/lib/provider-review.functions";
import { buildShortlistTable, shortlistCsv, type ExportCandidate } from "@/lib/shortlist-export";
import type { ScholarshipFund } from "@/lib/provider.functions";

export function ShortlistExport({ fund, candidates }: { fund: ScholarshipFund; candidates: ExportCandidate[] }) {
  const [open, setOpen] = useState(false);
  const [onlyStarred, setOnlyStarred] = useState(false);
  const [printHost, setPrintHost] = useState<HTMLElement | null>(null);
  const [date, setDate] = useState("");
  const getRules = useServerFn(getFundRuleResultsAll);
  const getNotes = useServerFn(listCandidateNotes);
  useEffect(() => { setPrintHost(document.body); }, []);
  const data = useQuery({
    queryKey: ["shortlist-export", fund.id, fund.version],
    queryFn: async () => { const [results, notes] = await Promise.all([getRules({ data: { fundId: fund.id } }), getNotes({ data: { fundId: fund.id } })]); return { results, notes }; },
    enabled: open, staleTime: 0, retry: false,
  });
  useEffect(() => { if (data.error) toast.error(data.error.message); }, [data.error]);
  const table = buildShortlistTable(candidates, data.data?.results ?? [], data.data?.notes ?? [], fund, onlyStarred);
  const ready = !!data.data && !data.isFetching && !data.error;
  return <>
    <Button variant="outline" onClick={() => { setOnlyStarred(false); setDate(new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })); setOpen(true); }}><FileDown className="size-4" aria-hidden="true" />Export shortlist</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="w-[calc(100%-2rem)]"><DialogHeader><DialogTitle>Export shortlist</DialogTitle><DialogDescription>{fund.title}</DialogDescription></DialogHeader>
      <label className="flex items-center gap-3 text-sm"><Checkbox checked={onlyStarred} onCheckedChange={(checked) => setOnlyStarred(checked === true)} />Only candidates I've starred</label>
      <p className="text-sm text-muted-foreground">{data.isFetching ? "Preparing shortlist…" : `${table.rows.length} candidates`}</p>
      {data.error && <div className="space-y-3"><p role="alert" className="text-sm text-destructive">{data.error.message}</p><Button variant="outline" onClick={() => void data.refetch()}>Retry</Button></div>}
      <div className="flex flex-wrap gap-3"><Button disabled={!ready} onClick={() => {
        const blob = new Blob([shortlistCsv(table)], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a"); link.href = url; link.download = `${fund.title.replace(/[^a-zA-Z0-9_-]+/g, "-")}-shortlist.csv`;
        document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
      }}><Download className="size-4" aria-hidden="true" />Download CSV</Button>
      <Button variant="outline" disabled={!ready || !printHost} onClick={() => window.print()}><Printer className="size-4" aria-hidden="true" />Print / save as PDF</Button></div>
      <p className="text-xs text-muted-foreground">Choose “Save as PDF” in your browser's print dialog.</p>
    </DialogContent></Dialog>
    {open && ready && printHost && createPortal(<div className="shortlist-print"><header><h1>{fund.title}</h1><p>{date}</p></header><table><thead><tr>{table.headers.map((header, i) => <th key={i}>{header}</th>)}</tr></thead><tbody>{table.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody></table>{table.rows.length === 0 && <p>No candidates in this selection.</p>}</div>, printHost)}
  </>;
}