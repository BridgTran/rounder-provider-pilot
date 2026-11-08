import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  handleMatchStateTransition,
  useMatchState,
  findMatchByProgram,
  type MatchStatus,
} from "@/lib/match-state";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GritBreakdownPanel } from "@/components/GritBreakdownPanel";
import { candidatePool } from "@/lib/candidate-pool";
import { calculateIrtoScore } from "@/lib/irto";
import { StudentOnboardingWizard } from "@/components/StudentOnboardingWizard";
import { useOnboarding, resetOnboarding } from "@/lib/student-profile-state";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Student View — ROUNDER HQ" },
      {
        name: "description",
        content:
          "Showcase your whole self. Track your Grit / IRTO Score, map invisible skills, and unlock matched Australian opportunities.",
      },
      { property: "og:title", content: "Student View — ROUNDER HQ" },
      {
        property: "og:description",
        content: "You are more than a GPA score. Monetize your real-world complexity.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudentView,
});

const skills = [
  { name: "Client Empathy", stars: 5, source: "25+ hr/wk front-of-house shifts" },
  { name: "Resilience", stars: 5, source: "Family caregiving + full-time study" },
  { name: "Adaptability", stars: 4, source: "Rotating rosters across three jobs" },
];

const visibilityMetrics = [
  {
    label: "Search Impressions",
    value: 42,
    description: "Times your anonymous profile appeared in employer queries.",
  },
  {
    label: "Filter Inclusions",
    value: 7,
    description: "Active B2B queries where your Grit Score matched criteria.",
  },
  {
    label: "Anonymous Shortlists",
    value: 3,
    description: "Times you were saved to an organisation's target report.",
  },
];

interface Opportunity {
  org: string;
  program: string;
  location: string;
  fit: number;
  tags: string[];
  candidateCode: string;
}

const opportunities: Opportunity[] = [
  {
    org: "Fortune 100 Miner",
    program: "Regional Engineering Scholarship",
    location: "Perth / Pilbara, WA",
    fit: 96,
    tags: ["Engineering", "Relocation support", "$25k stipend"],
    candidateCode: "CANDIDATE #AU-31076",
  },
  {
    org: "Big Four Bank",
    program: "Leadership Stream",
    location: "Sydney, NSW",
    fit: 93,
    tags: ["Finance", "Fast-track", "Hybrid"],
    candidateCode: "CANDIDATE #AU-55213",
  },
  {
    org: "Top-Tier Law Firm",
    program: "Commercial Pathways",
    location: "Melbourne, VIC",
    fit: 89,
    tags: ["Law", "Mentoring", "Clerkship"],
    candidateCode: "CANDIDATE #AU-88942",
  },
  {
    org: "National Health Network",
    program: "Future Health Leaders Grant",
    location: "Sydney / Regional NSW",
    fit: 91,
    tags: ["Nursing", "$15k grant", "Mentorship"],
    candidateCode: "CANDIDATE #AU-70415",
  },
  {
    org: "Global Media Group",
    program: "Creative Industries Fellowship",
    location: "Melbourne, VIC / Remote",
    fit: 84,
    tags: ["Media", "Portfolio-based", "Flexible"],
    candidateCode: "CANDIDATE #AU-19638",
  },
  {
    org: "National Infrastructure Co",
    program: "Project Graduate Program",
    location: "Brisbane, QLD",
    fit: 86,
    tags: ["Infrastructure", "Rotational", "On-site"],
    candidateCode: "CANDIDATE #AU-31076",
  },
];

const storySteps = [
  {
    question: "Who relies on you outside of study?",
    options: ["Younger siblings", "A parent or grandparent", "My community", "Just me"],
  },
  {
    question: "How many hours a week do you work while studying?",
    options: ["0–10 hrs", "10–20 hrs", "20–30 hrs", "30+ hrs"],
  },
  {
    question: "What's the hardest thing you've pushed through this year?",
    options: ["Financial pressure", "Caring duties", "Remote study access", "Health setbacks"],
  },
];

function Gauge({ value }: { value: number }) {
  const r = 84;
  const c = 2 * Math.PI * r;
  const filled = (value / 100) * c * 0.75;
  return (
    <svg viewBox="0 0 200 200" className="h-56 w-56 sm:h-64 sm:w-64" role="img" aria-label={`Grit score ${value} percent`}>
      <circle
        cx="100"
        cy="100"
        r={r}
        fill="none"
        strokeWidth="16"
        className="stroke-charcoal-foreground/15"
        strokeDasharray={`${c * 0.75} ${c}`}
        strokeLinecap="round"
        transform="rotate(135 100 100)"
      />
      <circle
        cx="100"
        cy="100"
        r={r}
        fill="none"
        strokeWidth="16"
        className="stroke-lime"
        strokeDasharray={`${filled} ${c}`}
        strokeLinecap="round"
        transform="rotate(135 100 100)"
      />
      <text x="100" y="98" textAnchor="middle" className="fill-charcoal-foreground font-display text-4xl font-black">
        {value}%
      </text>
      <text x="100" y="122" textAnchor="middle" className="fill-lime text-[11px] font-bold tracking-widest">
        GRIT / IRTO SCORE
      </text>
    </svg>
  );
}

function ProvisionalCapacityRing({ value }: { value: number }) {
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, value) / 100) * circumference;

  return (
    <div className="relative grid h-48 w-48 shrink-0 place-items-center" role="img" aria-label={`Provisional ranking capacity ${value.toFixed(1)} percent`}>
      <svg viewBox="0 0 176 176" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
        <circle
          cx="88"
          cy="88"
          r={radius}
          fill="none"
          strokeWidth="12"
          className="stroke-charcoal/10"
        />
        <circle
          cx="88"
          cy="88"
          r={radius}
          fill="none"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="stroke-lime transition-[stroke-dashoffset] duration-500 ease-out motion-reduce:transition-none"
        />
      </svg>
      <div className="relative text-center">
        <p className="font-display text-4xl font-black text-charcoal">{value.toFixed(1)}%</p>
        <p className="mx-auto mt-1 max-w-28 text-[9px] font-black uppercase leading-tight text-charcoal/60">
          Provisional Ranking Capacity
        </p>
      </div>
    </div>
  );
}

function GritBoosterSimulator() {
  const [workHours, setWorkHours] = useState(0);
  const [carerHours, setCarerHours] = useState(0);
  const baseScore = 88;
  const simulatedHours = workHours + carerHours;
  const provisionalScore = Math.min(100, Math.round((baseScore + simulatedHours * 0.65) * 10) / 10);

  const controls = [
    {
      id: "work-hours",
      label: "Simulate Weekly Work Hours",
      value: workHours,
      setValue: setWorkHours,
    },
    {
      id: "carer-hours",
      label: "Simulate Carer/External Load",
      value: carerHours,
      setValue: setCarerHours,
    },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-charcoal/15 bg-card">
      <div className="border-b border-charcoal/10 px-5 py-5 sm:px-7">
        <h2 className="text-xl text-charcoal sm:text-2xl">🎛️ Grit Booster Simulator</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Test how verified work and caring commitments could influence your contextual ranking.
        </p>
      </div>
      <div className="grid items-center gap-7 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-12">
        <div className="min-w-0 space-y-7">
          {controls.map((control) => (
            <div key={control.id}>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <label htmlFor={control.id} className="min-w-0 text-sm font-bold text-charcoal">
                  {control.label}
                </label>
                <output htmlFor={control.id} className="shrink-0 rounded-full border border-charcoal/15 bg-secondary px-2.5 py-1 text-xs font-black text-charcoal">
                  {control.value} hrs
                </output>
              </div>
              <input
                id={control.id}
                type="range"
                min={0}
                max={40}
                step={1}
                value={control.value}
                onChange={(event) => control.setValue(Number(event.target.value))}
                className="mt-3 h-2 w-full cursor-pointer accent-lime"
              />
              <div className="mt-1 flex justify-between text-[10px] font-semibold text-muted-foreground">
                <span>0 hours</span>
                <span>40 hours</span>
              </div>
            </div>
          ))}

          <div className="rounded-lg border border-charcoal/10 bg-secondary/70 px-4 py-3">
            <p className="text-xs font-bold text-charcoal">
              88.0 baseline + {simulatedHours} contextual hours × 0.65 = {provisionalScore.toFixed(1)}%
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Simulator only. Your live score changes after supporting context is verified.
            </p>
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <ProvisionalCapacityRing value={provisionalScore} />
        </div>
      </div>
    </section>
  );
}

function Stars({ count }: { count: number }) {
  return (
    <span className="text-lime" aria-label={`${count} out of 5 stars`}>
      {"★".repeat(count)}
      <span className="text-charcoal-foreground/25">{"★".repeat(5 - count)}</span>
    </span>
  );
}

function StoryModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const done = step >= storySteps.length;

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-charcoal/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="panel-dark w-full max-w-md p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {!done ? (
          <>
            <p className="eyebrow text-lime">
              Your Real Story · Step {step + 1} of {storySteps.length}
            </p>
            <h3 className="mt-3 text-xl text-charcoal-foreground sm:text-2xl">
              {storySteps[step]!.question}
            </h3>
            <div className="mt-5 space-y-2">
              {storySteps[step]!.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setSelected(opt)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                    selected === opt
                      ? "border-lime bg-lime/15 text-lime"
                      : "border-charcoal-foreground/20 text-charcoal-foreground/80 hover:border-lime/60"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-between">
              <button
                onClick={onClose}
                className="text-xs font-bold text-charcoal-foreground/50 hover:text-charcoal-foreground"
              >
                Skip for now
              </button>
              <button
                disabled={!selected}
                onClick={() => {
                  setSelected(null);
                  setStep(step + 1);
                }}
                className="rounded-full bg-lime px-5 py-2.5 text-sm font-bold text-lime-foreground transition enabled:hover:brightness-105 disabled:opacity-40"
              >
                {step === storySteps.length - 1 ? "Finish" : "Next"}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-lime text-2xl font-black text-lime-foreground">
              ✓
            </span>
            <h3 className="mt-4 text-xl text-charcoal-foreground sm:text-2xl">
              Your story is being re-scored
            </h3>
            <p className="mt-2 text-sm text-charcoal-foreground/70">
              New context evidence added. Watch your Grit / IRTO Score update within minutes.
            </p>
            <button
              onClick={onClose}
              className="mt-6 rounded-full bg-lime px-6 py-3 text-sm font-bold text-lime-foreground transition hover:brightness-105"
            >
              Back to my dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StudentView() {
  const [storyOpen, setStoryOpen] = useState(false);
  const { matches, systemStatus } = useMatchState();
  const onboarding = useOnboarding();
  const liveScore = onboarding.result ? Math.round(onboarding.result.adjustedGpa) : 88;

  const statusOf = (program: string): MatchStatus =>
    findMatchByProgram(matches, program)?.status ?? "passive";

  const revealedName = (program: string) =>
    findMatchByProgram(matches, program)?.orgLegalName ?? null;

  const handleReveal = (program: string) => {
    const result = handleMatchStateTransition({ type: "STUDENT_ACCEPT_REVEAL", program });
    if (result.ok) toast.success(result.message, { description: result.detail });
    else toast.error(result.message, { description: result.detail });
  };

  const simulateProviderRequest = (program: string) => {
    const match = findMatchByProgram(matches, program);
    if (!match) {
      toast.error("No provider is tracking this opportunity yet.");
      return;
    }
    const result = handleMatchStateTransition({
      type: "ORG_REQUEST_MATCH",
      candidateCode: match.candidateCode,
    });
    if (result.ok) toast(result.message, { description: result.detail });
    else toast.error(result.message, { description: result.detail });
  };


  return (
    <TooltipProvider delayDuration={150}>
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        {/* Headline banner */}
        <section className="panel-dark overflow-hidden p-6 sm:p-10">
          <p className="eyebrow text-lime">Student View</p>
          <h1 className="mt-3 max-w-4xl text-3xl leading-[1.05] sm:text-5xl lg:text-6xl">
            SHOWCASE YOUR WHOLE SELF. <span className="text-lime">BE A ROUNDER.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-charcoal-foreground/70 sm:text-base">
            You are more than a GPA score. Monetize your real-world complexity.
          </p>
        </section>

        {!onboarding.completed ? (
          <StudentOnboardingWizard />
        ) : (
        <>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-lime/50 bg-lime/10 px-5 py-3 text-sm font-bold text-charcoal">
          <span>📡 Live Match Radar active — your verified IRTO score is {liveScore}%.</span>
          <button type="button" onClick={resetOnboarding} className="text-xs font-bold text-charcoal/60 underline hover:text-charcoal">Redo intake</button>
        </div>
        {systemStatus && (
          <div className="flex items-center gap-3 rounded-2xl border-2 border-lime bg-lime/15 px-5 py-3 text-sm font-black text-charcoal">
            <span className="pulse inline-block h-2 w-2 rounded-full bg-lime" />
            {systemStatus}
          </div>
        )}

        <section className="space-y-4" aria-labelledby="visibility-lab-title">
          <div>
            <p className="eyebrow text-muted-foreground">Live anonymous analytics</p>
            <h2 id="visibility-lab-title" className="mt-2 text-xl text-charcoal sm:text-2xl">
              ⚡ YOUR MARKET VISIBILITY LAB
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {visibilityMetrics.map((metric) => (
              <article key={metric.label} className="rounded-xl border border-charcoal/10 bg-secondary/70 p-5">
                <p className="text-xs font-black uppercase text-charcoal/60">{metric.label}</p>
                <p className="mt-3 font-display text-4xl font-black text-charcoal">{metric.value}</p>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{metric.description}</p>
              </article>
            ))}
          </div>
          <GritBoosterSimulator />
        </section>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Left column: gauge + skills */}
          <div className="space-y-6 lg:col-span-2">
            <section className="panel-dark flex flex-col items-center p-6 sm:p-8">
              <Gauge value={liveScore} />
              <p className="mt-4 rounded-full border border-lime/40 bg-lime/10 px-4 py-2 text-center text-xs font-semibold text-lime sm:text-sm">
                Top 12% in Australia (Based on 25+ hr/wk work shifts, Distinction average, and family
                caregiving)
              </p>
            </section>

            <section className="panel-dark p-6 sm:p-8">
              <h2 className="text-xl text-charcoal-foreground sm:text-2xl">Invisible Skills</h2>
              <p className="mt-1 text-xs text-charcoal-foreground/60">
                Qualitative traits derived from your background
              </p>
              <ul className="mt-5 space-y-4">
                {skills.map((s) => (
                  <li
                    key={s.name}
                    className="rounded-2xl bg-charcoal-foreground/8 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-charcoal-foreground">{s.name}</p>
                      <Stars count={s.stars} />
                    </div>
                    <p className="mt-1 text-xs text-charcoal-foreground/55">{s.source}</p>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => setStoryOpen(true)}
                className="mt-6 w-full rounded-full bg-lime px-6 py-3 text-sm font-bold text-lime-foreground transition hover:brightness-105"
              >
                ⚡ Update My Real Story
              </button>
            </section>
          </div>

          {/* Right column: matched opportunities */}
          <section className="panel-light p-6 sm:p-8 lg:col-span-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl sm:text-2xl">Matched Opportunities</h2>
              <span className="eyebrow text-muted-foreground">Anonymous previews</span>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {opportunities.map((o) => {
                const status = statusOf(o.program);
                const legalName = revealedName(o.program);
                const candidate = candidatePool.find((item) => item.candidateCode === o.candidateCode);
                const breakdown = candidate ? calculateIrtoScore(candidate) : null;
                return (
                <article
                  key={o.program}
                  className={`flex flex-col rounded-2xl border p-5 transition duration-500 ${
                    status === "revealed"
                      ? "handshake-flash border-lime bg-lime/5"
                      : status === "active"
                        ? "border-lime bg-card shadow-lg shadow-lime/10"
                        : "border-border bg-card hover:border-lime"
                  }`}
                >
                  {/* Section 1 — identity & tags */}
                  <p className="eyebrow text-muted-foreground">
                    {status === "revealed" && legalName ? (
                      <span className="text-lime-foreground/90">✅ {legalName}</span>
                    ) : (
                      o.org
                    )}
                  </p>
                  <h3 className="mt-2 font-display text-base font-bold sm:text-lg">{o.program}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{o.location}</p>
                  <div className="mt-3 flex flex-row flex-wrap items-center gap-1.5">
                    {o.tags.map((tag) => (
                      <span
                        key={tag}
                        className="whitespace-nowrap rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-secondary-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Section 2 — grit engine panel */}
                  {breakdown && (
                    <div className="mb-5 mt-4 rounded-xl bg-charcoal/[0.04] px-4 py-3">
                      <GritBreakdownPanel
                        result={breakdown}
                        score={o.fit}
                        theme="scholarship"
                        compact
                        context="student"
                        layout="split"
                      />
                    </div>
                  )}
                  {/* Section 3 — actions */}
                  <div className="mt-auto flex flex-col items-center gap-2.5 border-t border-border pt-4">
                    {status === "passive" && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex w-full cursor-help items-center justify-center gap-2 whitespace-nowrap rounded-full bg-charcoal px-3 py-1.5 text-center text-xs font-bold text-charcoal-foreground/60 opacity-70">
                            <span aria-hidden="true">🔒</span>
                            <span>Awaiting Provider Request</span>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="max-w-[16rem] bg-charcoal text-charcoal-foreground"
                        >
                          <p>
                            Your profile is a {o.fit}% match. This provider is currently viewing your
                            anonymized grit metrics. You will be notified the moment they initiate an
                            official match request.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {status === "active" && (
                      <button
                        onClick={() => handleReveal(o.program)}
                        className="w-full animate-pulse rounded-full bg-lime px-3 py-1.5 text-center text-xs font-bold text-lime-foreground shadow-[0_0_16px_rgba(163,230,53,0.55)] transition hover:brightness-110"
                      >
                        🔥 ACCEPT MATCH &amp; REVEAL PROVIDER
                      </button>
                    )}
                    {status === "revealed" && (
                      <span className="w-full rounded-full border border-lime bg-lime/15 px-3 py-1.5 text-center text-xs font-bold text-lime">
                        🤝 Identity Revealed
                      </span>
                    )}
                    {status === "revealed" && legalName && (
                      <div className="w-full self-stretch rounded-xl border border-lime/50 bg-lime/10 p-3 text-left text-xs font-semibold text-charcoal">
                        Provider unmasked: <span className="font-black">{legalName}</span>
                        <p className="mt-1 font-normal text-charcoal/70">
                          Secure P2P communication tunnel established. Your contact details and
                          verified transcript link are now shared with this provider.
                        </p>
                      </div>
                    )}
                    {status === "passive" && (
                      <button
                        onClick={() => simulateProviderRequest(o.program)}
                        className="w-full rounded-lg border border-dashed border-charcoal/25 px-3 py-1.5 text-center text-[10px] font-bold tracking-wide text-charcoal/45 transition hover:border-lime hover:text-lime"
                      >
                        [Demo] Simulate provider match request
                      </button>
                    )}
                  </div>
                </article>
                );
              })}
            </div>
          </section>
        </div>

        </>
        )}
        {/* Sticky live-interest alert */}
        <div className="sticky bottom-4 z-40 ml-auto w-full max-w-sm">
          <div className="panel-dark border-2 border-lime p-5 shadow-2xl">
            <p className="flex items-center gap-2 text-sm font-black tracking-wide text-lime">
              <span className="pulse inline-block h-2 w-2 rounded-full bg-lime" />
              AN ORGANIZATION IS LOOKING AT YOUR PROFILE NOW
            </p>
            <button
              onClick={() =>
                toast.success("Match accepted! Your profile is now unlocked to this organization.", {
                  description: "They can now see your full story and contact details.",
                })
              }
              className="mt-3 w-full rounded-full bg-lime px-4 py-3 text-sm font-black text-lime-foreground transition hover:brightness-105"
            >
              ACCEPT MATCH &amp; UNLOCK MY PROFILE 🔒
            </button>
          </div>
        </div>

        {storyOpen && <StoryModal onClose={() => setStoryOpen(false)} />}
      </div>
    </TooltipProvider>
  );
}
