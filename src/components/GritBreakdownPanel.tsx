import { useRef, useState, type MouseEvent } from "react";
import { CircleHelp, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { IrtoResult } from "@/lib/irto";

type GritBreakdownPanelProps = {
  result: IrtoResult;
  theme: "graduate" | "scholarship";
  score?: number;
  compact?: boolean;
  context?: "student" | "corporate";
  /** "stacked" (default) = right-aligned vertical column; "split" = label left, score right */
  layout?: "stacked" | "split";
  /** "light" (default) = charcoal typography for light card surfaces; "dark" = white typography for dark card surfaces */
  tone?: "light" | "dark";
};

function disciplineLabel(degreeTitle: string) {
  const known = [
    "Veterinary Science",
    "Computer Science",
    "General Science",
    "Physiotherapy",
    "Chiropractic",
    "Communications",
    "Engineering",
    "Architecture",
    "Psychology",
    "Dentistry",
    "Medicine",
    "Nursing",
    "Commerce",
    "Economics",
    "Finance",
    "Design",
    "Humanities",
    "Law",
    "Arts",
  ];
  return known.find((name) => degreeTitle.toLowerCase().includes(name.toLowerCase())) ?? degreeTitle;
}

function tierLabel(beta: number) {
  if (beta >= 1.15) return "Tier 1";
  if (beta >= 1.05) return "Tier 2";
  return "Tier 3";
}

function Meter({ label, value, dark }: { label: string; value: number; dark: boolean }) {
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <span className={`text-xs font-bold ${dark ? "text-charcoal-foreground" : "text-charcoal"}`}>
          {label}
        </span>
        <span className={dark ? "text-sm font-black text-lime" : "text-sm font-black text-charcoal"}>
          {value.toFixed(1)}%
        </span>
      </div>
      <progress
        className={`irto-progress mt-2 block h-2.5 w-full overflow-hidden rounded-full ${dark ? "irto-progress-dark" : "irto-progress-light"}`}
        value={Math.min(100, value)}
        max={100}
        aria-label={`${label}: ${value.toFixed(1)} percent`}
      />
    </div>
  );
}

export function GritBreakdownPanel({
  result,
  theme,
  score,
  compact = false,
  context = "corporate",
  layout = "stacked",
  tone = "light",
}: GritBreakdownPanelProps) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dark = theme === "graduate";
  const onDark = tone === "dark";
  const displayedScore = score ?? result.gritMatchFit;
  const student = result.student;
  const hourOffset = student.weeklyHours * 0.65;
  const split = layout === "split";

  // Tracks whether the panel was pinned by an explicit click, so a hover-opened
  // panel doesn't snap shut when the user clicks the icon to inspect it.
  const pinned = useRef(false);
  // Suppresses the focus-open that fires when Escape/outside dismissal returns
  // focus to the trigger — otherwise the panel would instantly reopen.
  const suppressFocus = useRef(false);
  const touchDown = useRef(false);

  const keepOpen = () => {
    // On touch, the tap's synthesised hover would open the panel and the
    // trigger's click toggle would immediately close it — skip hover-open.
    if (touchDown.current) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };

  const closeSoon = () => {
    // Touch taps also synthesise a stray mouseleave after the click; never
    // hover-close from a touch interaction. A click-pinned panel ignores
    // hover-leave entirely until it is closed deliberately.
    if (touchDown.current || pinned.current) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => handleOpenChange(false), 140);
  };

  const handleFocus = () => {
    if (suppressFocus.current) {
      suppressFocus.current = false;
      return;
    }
    keepOpen();
  };

  const handlePinClick = (e: MouseEvent) => {
    // Radix's trigger toggle runs after this handler unless defaultPrevented —
    // we own the open state and toggle it ourselves.
    e.preventDefault();
    if (open && !pinned.current) {
      pinned.current = true; // hover had opened it; the click just pins it
      return;
    }
    pinned.current = !open;
    setOpen(!open);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      pinned.current = false;
      suppressFocus.current = true;
    }
    setOpen(next);
  };

  const helpTrigger = (
    <PopoverTrigger asChild>
      <Button
        type="button"
        variant="ghost"
        aria-label={`Open ${displayedScore}% Eligibility Fit breakdown`}
        aria-expanded={open}
        onMouseEnter={keepOpen}
        onMouseLeave={closeSoon}
        onFocus={handleFocus}
        onPointerDown={(e) => {
          touchDown.current = e.pointerType === "touch";
        }}
        onClick={handlePinClick}
        className={`h-5 w-5 shrink-0 rounded-full border-0 p-0 shadow-none hover:bg-transparent ${
          onDark ? "text-white/60 hover:text-white" : "text-charcoal/55 hover:text-charcoal"
        }`}
      >
        <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
    </PopoverTrigger>
  );

  const scorePill = (
    <span
      className={`font-display font-black ${onDark ? "text-white" : "text-charcoal"} ${compact ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"}`}
    >
      {displayedScore}%
    </span>
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      {split ? (
        <span className="flex w-full flex-row items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className={`whitespace-nowrap text-[10px] font-black uppercase tracking-wide ${onDark ? "text-white/75" : "text-charcoal/70"}`}>
              Eligibility Fit
            </span>
            {helpTrigger}
          </span>
          <span className="flex min-w-max flex-col items-end text-right leading-none">
            {scorePill}
          </span>
        </span>
      ) : (
        <span className="inline-flex min-w-max flex-col items-end text-right leading-none">
          <span className="flex items-center justify-end gap-1.5">
            <span className={`text-[10px] font-black uppercase ${onDark ? "text-white/75" : "text-charcoal/70"}`}>
              Eligibility Fit
            </span>
            {helpTrigger}
          </span>
          <span className="mt-1">{scorePill}</span>
        </span>
      )}

      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={10}
        collisionPadding={12}
        onMouseEnter={keepOpen}
        onMouseLeave={closeSoon}
        className={`grit-breakdown-panel max-h-[min(76vh,680px)] w-[min(34rem,calc(100vw-1.5rem))] overflow-y-auto rounded-lg border-2 p-0 shadow-2xl ${
          dark
            ? "border-lime/55 bg-charcoal text-charcoal-foreground"
            : "border-charcoal/25 bg-background text-charcoal"
        }`}
      >
        <header className={`border-b p-5 ${dark ? "border-charcoal-foreground/15" : "border-charcoal/15"}`}>
          <p className={dark ? "eyebrow text-lime" : "eyebrow text-charcoal"}>Rounder Matrix Engine</p>
          <h2 className={`mt-2 text-lg sm:text-xl ${dark ? "text-charcoal-foreground" : "text-charcoal"}`}>
            📊 Algorithmic IRTO Breakdown
          </h2>
          <p className={`mt-1 text-xs ${dark ? "text-charcoal-foreground/65" : "text-muted-foreground"}`}>
            Context-first capability mapping powered by the Rounder Matrix Engine.
          </p>
        </header>

        <div className="space-y-5 p-5">
          <section>
            <h3 className={`text-sm font-black ${dark ? "text-charcoal-foreground" : "text-charcoal"}`}>
              📐 The Academic Capacity Formula
            </h3>
            <dl className={`mt-3 divide-y rounded-md border px-4 ${dark ? "divide-charcoal-foreground/10 border-charcoal-foreground/15 bg-charcoal-foreground/5" : "divide-charcoal/10 border-charcoal/15 bg-card"}`}>
              <div className="grid gap-1 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <dt className={`text-xs font-bold ${dark ? "text-charcoal-foreground/65" : "text-muted-foreground"}`}>Raw GPA Tracked (My eQuals):</dt>
                <dd className="font-mono text-sm font-black">{student.rawGpa.toFixed(2)}%</dd>
              </div>
              <div className="grid gap-1 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <dt className={`text-xs font-bold ${dark ? "text-charcoal-foreground/65" : "text-muted-foreground"}`}>Discipline Density Multiplier:</dt>
                <dd className="font-mono text-sm font-black">x {result.beta.toFixed(2)} {tierLabel(result.beta)}: {disciplineLabel(student.degreeTitle)}</dd>
              </div>
              <div className="grid gap-1 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <dt className={`text-xs font-bold ${dark ? "text-charcoal-foreground/65" : "text-muted-foreground"}`}>Time-Poverty Hour Offset:</dt>
                <dd className="font-mono text-sm font-black">+ {hourOffset.toFixed(2)} [{student.weeklyHours} Hours Shift x 0.65]</dd>
              </div>
            </dl>
            <div className={`mt-3 rounded-md border-2 p-4 ${dark ? "border-lime/50 bg-charcoal-foreground/5" : "border-charcoal bg-card"}`}>
              <div className="flex items-end justify-between gap-3">
                <span className="text-[11px] font-black">★ ADJUSTED CAPABILITY SCORE</span>
                <span className={dark ? "font-display text-2xl font-black text-lime" : "font-display text-2xl font-black text-charcoal"}>{result.adjustedGpa.toFixed(1)}%</span>
              </div>
              <progress
                className={`irto-progress mt-3 block h-4 w-full overflow-hidden rounded-full ${dark ? "irto-progress-dark" : "irto-progress-light"}`}
                value={result.adjustedGpa}
                max={100}
                aria-label={`Adjusted Capability Score: ${result.adjustedGpa.toFixed(1)} percent`}
              />
            </div>
          </section>

          {/* Vector B, deferred until post-pilot: the Soft-Skill Proximity Matrix is hidden
              because pilot matching uses structured eligibility criteria only. Do not delete. */}
          <section hidden className={`border-t pt-5 ${dark ? "border-charcoal-foreground/15" : "border-charcoal/15"}`}>
            <h3 className={`text-sm font-black ${dark ? "text-charcoal-foreground" : "text-charcoal"}`}>🧠 Soft-Skill Proximity Matrix</h3>
            <div className="mt-4 space-y-4">
              <Meter label="Client Empathy Pipeline" value={result.softSkills.clientEmpathy} dark={dark} />
              <Meter label="Pressure Resilience Core" value={result.softSkills.pressureResilience} dark={dark} />
            </div>
            {result.frontlineBoost && (
              <p className={`mt-4 rounded-md border border-lime bg-lime/15 px-3 py-2 text-[11px] font-black ${dark ? "text-lime" : "text-lime-foreground"}`}>
                ⚡ (+1.5 Environment Modifier Applied: Active Frontline Workplace)
              </p>
            )}
          </section>

          <section className={`border-t pt-5 ${dark ? "border-charcoal-foreground/15" : "border-charcoal/15"}`}>
            <h3 className={`text-sm font-black ${dark ? "text-charcoal-foreground" : "text-charcoal"}`}>⚡ Equity Cohort Adaptability Overlap</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {student.verifiedEquity?.centrelinkConcession && (
                <span className={`rounded-full border px-3 py-1.5 text-[11px] font-black ${dark ? "border-lime/60 bg-lime/10 text-lime" : "border-charcoal/20 bg-secondary text-charcoal"}`}>
                  ✓ VERIFIED Centrelink Concession
                </span>
              )}
              {student.verifiedEquity?.lowSesPostcode && (
                <span className={`rounded-full border px-3 py-1.5 text-[11px] font-black ${dark ? "border-lime/60 bg-lime/10 text-lime" : "border-charcoal/20 bg-secondary text-charcoal"}`}>
                  ✓ VERIFIED LOW SES POSTCODE (ABS SEIFA)
                </span>
              )}
              {!student.verifiedEquity?.centrelinkConcession && !student.verifiedEquity?.lowSesPostcode && (
                <span className={`text-xs font-semibold ${dark ? "text-charcoal-foreground/55" : "text-muted-foreground"}`}>
                  {context === "student"
                    ? "✨ Your core academic and workload parameters are actively driving this calculation loop."
                    : "No verified equity indicators applied to this result."}
                </span>
              )}
            </div>
          </section>
        </div>

        <footer className={`flex items-start gap-3 border-t p-4 ${dark ? "border-lime/40 bg-lime/10" : "border-charcoal bg-charcoal text-charcoal-foreground"}`}>
          <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-lime" aria-hidden="true" />
          <p className="text-[11px] font-black leading-relaxed">
            {context === "student"
              ? "IDENTITY PROXY SHIELD: ACTIVE COMPLIANCE — You clear 100% of the mandatory institutional hard gates."
              : "IDENTITY PROXY SHIELD: ACTIVE COMPLIANCE — This candidate clears 100% of your mandatory institutional hard gates."}
          </p>
        </footer>
      </PopoverContent>
    </Popover>
  );
}