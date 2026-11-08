import { Link, useRouterState } from "@tanstack/react-router";
import { CampaignToggle, PortalToggle } from "./PortalToggle";

export function SiteHeader() {
  const isCorporate = useRouterState({
    select: (state) => state.location.pathname.startsWith("/corporate"),
  });

  return (
    <header className="sticky top-0 z-50 border-b border-charcoal-foreground/10 bg-charcoal text-charcoal-foreground shadow-lg">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center justify-center gap-2 sm:justify-start">
          <span className="grid h-8 w-8 place-items-center rounded-md border border-lime bg-lime/10 text-sm font-black text-lime">
            R
          </span>
          <span className="font-display text-lg font-black sm:text-xl">
            ROUNDER HQ
          </span>
        </Link>
        <PortalToggle />
      </div>
      {isCorporate && <CampaignToggle />}
    </header>
  );
}
