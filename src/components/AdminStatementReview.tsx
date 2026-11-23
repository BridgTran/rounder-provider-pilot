import { useState } from "react";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminListSnippets, adminReviewSnippets } from "@/lib/admin-paperwork.functions";
import { reviewStatementsSchema } from "@/lib/admin-paperwork-schema";

export const adminStatementsOptions = queryOptions({ queryKey: ["admin-statements"], queryFn: () => adminListSnippets() });
type Statement = Awaited<ReturnType<typeof adminListSnippets>>[number];

function StatementCard({ statement }: { statement: Statement }) {
  const [communityText, setCommunityText] = useState(statement.status === "approved" ? statement.approved_community_text : statement.community_text);
  const [nextStudyText, setNextStudyText] = useState(statement.status === "approved" ? statement.approved_next_study_text : statement.next_study_text);
  const reviewStatements = useServerFn(adminReviewSnippets);
  const client = useQueryClient();
  const review = useMutation({
    mutationFn: (approve: boolean) => reviewStatements({ data: reviewStatementsSchema.parse({ studentId: statement.student_id, communityText, nextStudyText, approve }) }),
    onSuccess: async ({ approved }) => {
      toast.success(approved ? "Statements approved" : "Statements rejected");
      await client.invalidateQueries({ queryKey: adminStatementsOptions.queryKey });
    },
    onError: (error) => toast.error(error.message),
  });
  const communityId = `review-community-${statement.student_id}`;
  const nextStudyId = `review-next-study-${statement.student_id}`;
  return <article className="rounded-lg border border-border p-4 sm:p-5" aria-label={`Statements for ${statement.candidate_code}`}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="break-all font-semibold">{statement.candidate_code}</h3><Badge variant={statement.status === "rejected" ? "destructive" : statement.status === "approved" ? "default" : "secondary"} className="capitalize">{statement.status}</Badge></div>
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <div className="min-w-0 space-y-2"><Label htmlFor={communityId}>Community contribution</Label>
        <Textarea id={communityId} rows={4} maxLength={300} value={communityText} disabled={review.isPending} onChange={(event) => setCommunityText(event.target.value)} aria-describedby={`${communityId}-count`} />
        <p id={`${communityId}-count`} className="text-right text-xs tabular-nums text-muted-foreground" aria-live="polite">{communityText.length} / 300</p>
      </div>
      <div className="min-w-0 space-y-2"><Label htmlFor={nextStudyId}>Next study</Label>
        <Textarea id={nextStudyId} rows={4} maxLength={300} value={nextStudyText} disabled={review.isPending} onChange={(event) => setNextStudyText(event.target.value)} aria-describedby={`${nextStudyId}-count`} />
        <p id={`${nextStudyId}-count`} className="text-right text-xs tabular-nums text-muted-foreground" aria-live="polite">{nextStudyText.length} / 300</p>
      </div>
    </div>
    <div className="mt-4 flex flex-wrap gap-2"><Button disabled={review.isPending} onClick={() => review.mutate(true)}>Approve with these edits</Button><Button variant="outline" disabled={review.isPending} onClick={() => review.mutate(false)}>Reject</Button></div>
  </article>;
}

export function AdminStatementReview() {
  const { data: statements } = useSuspenseQuery(adminStatementsOptions);
  const pending = statements.filter((statement) => statement.status === "pending").length;
  return <section className="mt-10 border-t border-border pt-6" aria-labelledby="statement-review-heading">
    <div className="flex flex-wrap items-center gap-3"><h2 id="statement-review-heading" className="text-xl font-semibold">Student statements to review</h2><Badge variant="secondary" aria-label={`${pending} pending statements`}>{pending} pending</Badge></div>
    <p className="mt-3 text-sm text-muted-foreground">Remove names of people or organisations, the student's university, contact details and anything else that could identify them before approving. Providers only see the version you approve, and only after release.</p>
    {statements.length === 0 ? <p className="mt-4 text-muted-foreground">No student statements yet.</p> : <div className="mt-5 space-y-4">{statements.map((statement) => <StatementCard key={`${statement.student_id}:${statement.status}:${statement.community_text}:${statement.next_study_text}:${statement.approved_community_text}:${statement.approved_next_study_text}`} statement={statement} />)}</div>}
  </section>;
}