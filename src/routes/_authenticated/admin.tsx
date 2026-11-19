import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { adminAdvanceApplication, adminIssueInvites, adminListApplications, getAdminOverview } from "@/lib/invite.functions";
import { adminApplicationActions, adminInviteCountSchema, type AdminApplicationTarget } from "@/lib/application-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const adminOptions = queryOptions({ queryKey: ["admin-overview"], queryFn: () => getAdminOverview() });
const applicationsOptions = queryOptions({ queryKey: ["admin-applications"], queryFn: () => adminListApplications() });
export const Route = createFileRoute("/_authenticated/admin")({
  loader: async ({ context }) => {
    const overview = await context.queryClient.ensureQueryData(adminOptions);
    if (overview.allowed) await context.queryClient.ensureQueryData(applicationsOptions);
  },
  head: () => ({ meta: [
    { title: "Administration — ROUNDER HQ" }, { name: "description", content: "Restricted ROUNDER HQ scholarship pilot administration." },
    { property: "og:title", content: "Administration — ROUNDER HQ" }, { property: "og:description", content: "Restricted scholarship pilot administration." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" },
  ] }), component: AdminPage,
});
function AdminPage() {
  const { data } = useSuspenseQuery(adminOptions);
  return <div className="mx-auto max-w-5xl px-4 py-10"><h1 className="text-3xl">{data.allowed ? "Administration" : "Access restricted"}</h1>
    {data.allowed ? <><dl className="mt-8 grid grid-cols-3 gap-4">{[[data.providers, "Providers"], [data.students, "Students"], [data.requests, "Applications"]].map(([value, label]) => <div key={label} className="border-t border-border pt-4"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-2 text-3xl font-bold">{value}</dd></div>)}</dl><AdminControls /></> : <p className="mt-4 text-muted-foreground">This page is available to administrators only.</p>}
  </div>;
}

function AdminControls() {
  const queryClient = useQueryClient();
  const { data: applications } = useSuspenseQuery(applicationsOptions);
  const [count, setCount] = useState("1");
  const [links, setLinks] = useState("");
  const onError = (error: Error) => toast.error(error.message);
  const invites = useMutation({
    mutationFn: (value: number) => adminIssueInvites({ data: { count: value } }),
    onSuccess: ({ tokens }) => setLinks(tokens.map((token) => `${window.location.origin}/invite/${token}`).join("\n")),
    onError,
  });
  const advance = useMutation({
    mutationFn: (data: { matchId: string; to: AdminApplicationTarget }) => adminAdvanceApplication({ data }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: applicationsOptions.queryKey }),
        queryClient.invalidateQueries({ queryKey: adminOptions.queryKey }),
      ]);
    },
    onError,
  });
  return <>
    <section className="mt-10 border-t border-border pt-6">
      <h2 className="text-xl font-semibold">Student invitations</h2>
      <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(event) => {
        event.preventDefault();
        const parsed = adminInviteCountSchema.safeParse({ count: Number(count) });
        if (!parsed.success) { toast.error("Enter a whole number from 1 to 200."); return; }
        invites.mutate(parsed.data.count);
      }}>
        <div><label htmlFor="invite-count" className="mb-2 block text-sm text-muted-foreground">Number of invitations</label>
          <Input id="invite-count" type="number" min={1} max={200} step={1} required value={count} onChange={(event) => setCount(event.target.value)} className="w-40" />
        </div>
        <Button type="submit" disabled={invites.isPending}>{invites.isPending ? "Generating…" : "Generate links"}</Button>
      </form>
      <p className="mt-3 text-sm text-muted-foreground">Links are shown once and expire after 30 days.</p>
      {links && <div className="mt-4"><label htmlFor="invitation-links" className="mb-2 block text-sm text-muted-foreground">Student invitation links</label>
        <Textarea id="invitation-links" readOnly value={links} rows={Math.min(10, links.split("\n").length + 1)} className="font-mono text-sm" spellCheck={false} />
      </div>}
    </section>
    <section className="mt-10 border-t border-border pt-6">
      <h2 className="text-xl font-semibold">Applications</h2>
      {applications.length === 0 ? <p className="mt-4 text-muted-foreground">No applications yet.</p> : <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted-foreground"><tr>{["Student", "Fund", "Email", "Stage", "Release consent", "Next step"].map((heading) => <th key={heading} scope="col" className="px-3 py-3 font-medium">{heading}</th>)}</tr></thead>
          <tbody>{applications.map((application) => <tr key={application.id} className="border-b border-border align-top">
            <td className="px-3 py-4">{application.legalName || application.candidateCode || "Anonymous student"}</td>
            <td className="px-3 py-4">{application.fundTitle || "—"}</td>
            <td className="break-all px-3 py-4">{application.email || "—"}</td>
            <td className="px-3 py-4 capitalize">{application.stage}</td>
            <td className="px-3 py-4">{application.hasReleaseConsent ? "Recorded" : "Not recorded"}</td>
            <td className="px-3 py-4"><div className="flex min-w-40 flex-wrap gap-2">{adminApplicationActions[application.stage].map((action) => <Button key={action.to} size="sm" variant="outline" disabled={advance.isPending} onClick={() => advance.mutate({ matchId: application.id, to: action.to })}>{action.label}</Button>)}</div></td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
  </>;
}