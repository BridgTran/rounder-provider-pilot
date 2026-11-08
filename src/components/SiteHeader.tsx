import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CampaignToggle, PortalToggle } from "./PortalToggle";

export function SiteHeader() {
  const isCorporate = useRouterState({
    select: (state) => state.location.pathname.startsWith("/corporate"),
  });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session?.user));
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <header className="sticky top-0 z-50 border-b border-charcoal-foreground/10 bg-charcoal text-charcoal-foreground shadow-lg">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex items-center justify-center gap-3 sm:justify-start">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-md border border-lime bg-lime/10 text-sm font-black text-lime">
              R
            </span>
            <span className="font-display text-lg font-black sm:text-xl">
              ROUNDER HQ
            </span>
          </Link>
          {signedIn ? (
            <button
              onClick={() => void handleSignOut()}
              className="rounded-md border border-charcoal-foreground/20 px-3 py-1.5 text-xs font-black text-charcoal-foreground/80 transition hover:border-lime hover:text-lime"
            >
              Sign out
            </button>
          ) : (
            <Link
              to="/auth"
              className="rounded-md border border-lime/50 bg-lime/10 px-3 py-1.5 text-xs font-black text-lime transition hover:bg-lime hover:text-lime-foreground"
            >
              Provider Sign In
            </Link>
          )}
        </div>
        <PortalToggle />
      </div>
      {isCorporate && <CampaignToggle />}
    </header>
  );
}
