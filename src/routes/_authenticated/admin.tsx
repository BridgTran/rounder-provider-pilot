import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getAdminOverview } from "@/lib/invite.functions";

const adminOptions = queryOptions({ queryKey: ["admin-overview"], queryFn: () => getAdminOverview() });
export const Route = createFileRoute("/_authenticated/admin")({
  loader: ({ context }) => context.queryClient.ensureQueryData(adminOptions),
  head: () => ({ meta: [
    { title: "Administration — ROUNDER HQ" }, { name: "description", content: "Restricted ROUNDER HQ scholarship pilot administration." },
    { property: "og:title", content: "Administration — ROUNDER HQ" }, { property: "og:description", content: "Restricted scholarship pilot administration." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" },
  ] }), component: AdminPage,
});
function AdminPage() {
  const { data } = useSuspenseQuery(adminOptions);
  return <div className="mx-auto max-w-5xl px-4 py-10"><h1 className="text-3xl">{data.allowed ? "Administration" : "Access restricted"}</h1>
    {data.allowed ? <dl className="mt-8 grid grid-cols-3 gap-4">{[[data.providers, "Providers"], [data.students, "Students"], [data.requests, "Unlock requests"]].map(([value, label]) => <div key={label} className="border-t border-border pt-4"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-2 text-3xl font-bold">{value}</dd></div>)}</dl> : <p className="mt-4 text-muted-foreground">This page is available to administrators only.</p>}
  </div>;
}