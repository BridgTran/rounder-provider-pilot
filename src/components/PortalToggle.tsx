import { Link, useRouterState, useSearch } from "@tanstack/react-router";

export function PortalToggle() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const studentActive = pathname === "/";
  const corporateActive = pathname.startsWith("/corporate");

  return (
    <nav aria-label="Account view" className="grid w-full grid-cols-2 gap-1 rounded-lg bg-charcoal-foreground/8 p-1 sm:w-auto sm:min-w-[31rem]">
      <Link
        to="/"
        aria-current={studentActive ? "page" : undefined}
        className={`flex min-h-11 items-center justify-center rounded-md px-3 py-2 text-center text-xs font-black transition-colors sm:text-sm ${
          studentActive
            ? "bg-lime text-lime-foreground"
            : "text-charcoal-foreground/70 hover:bg-charcoal-foreground/10 hover:text-charcoal-foreground"
        }`}
      >
        🧑‍🎓 Student View
      </Link>
      <Link
        to="/corporate"
        search={{ track: "graduate-employer" }}
        aria-current={corporateActive ? "page" : undefined}
        className={`flex min-h-11 items-center justify-center rounded-md px-3 py-2 text-center text-xs font-black transition-colors sm:text-sm ${
          corporateActive
            ? "bg-lime text-lime-foreground"
            : "text-charcoal-foreground/70 hover:bg-charcoal-foreground/10 hover:text-charcoal-foreground"
        }`}
      >
        🏢 Employers &amp; Providers Hub
      </Link>
    </nav>
  );
}

export function CampaignToggle() {
  const search = useSearch({ strict: false }) as {
    track?: "graduate-employer" | "scholarship-provider";
  };
  const activeTrack = search.track === "scholarship-provider" ? "scholarship-provider" : "graduate-employer";

  return (
    <div className="border-t border-charcoal-foreground/10 bg-charcoal">
      <nav
        aria-label="Campaign track"
        className="mx-auto grid max-w-3xl grid-cols-2 gap-1 px-3 py-2 sm:px-6"
      >
        <Link
          to="/corporate"
          search={{ track: "graduate-employer" }}
          aria-current={activeTrack === "graduate-employer" ? "page" : undefined}
          className={`min-h-10 px-3 py-2 text-center text-xs font-black transition-colors sm:text-sm ${
            activeTrack === "graduate-employer"
              ? "border-b-2 border-lime text-lime"
              : "text-charcoal-foreground/60 hover:text-charcoal-foreground"
          }`}
        >
          💼 Graduate Employer
        </Link>
        <Link
          to="/corporate"
          search={{ track: "scholarship-provider" }}
          aria-current={activeTrack === "scholarship-provider" ? "page" : undefined}
          className={`min-h-10 px-3 py-2 text-center text-xs font-black transition-colors sm:text-sm ${
            activeTrack === "scholarship-provider"
              ? "border-b-2 border-lime text-lime"
              : "text-charcoal-foreground/60 hover:text-charcoal-foreground"
          }`}
        >
          🏆 Scholarship Provider
        </Link>
      </nav>
    </div>
  );
}
