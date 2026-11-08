import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Scholarship Provider Workspace — ROUNDER HQ" },
    { name: "description", content: "Your private scholarship provider workspace on ROUNDER HQ." },
    { property: "og:title", content: "Scholarship Provider Workspace — ROUNDER HQ" },
    { property: "og:description", content: "Scholarship funds, contextual candidate discovery and consent-based unlocks." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: ProviderEntry,
});
function ProviderEntry() {
  const navigate = useNavigate();
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) void navigate({ to: "/corporate", replace: true });
      else void navigate({ to: "/auth", search: { redirect: undefined }, replace: true });
    });
  }, [navigate]);
  return <div className="mx-auto max-w-5xl px-4 py-12"><h1 className="text-3xl">Scholarship Provider Workspace</h1><p className="mt-4 text-muted-foreground" role="status">Opening your workspace…</p></div>;
}
