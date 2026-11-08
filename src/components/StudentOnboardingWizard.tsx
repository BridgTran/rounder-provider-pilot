import { useState } from "react";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { calculateIrtoScore, type StudentProfile, type StudyMode, type WorkSector } from "@/lib/irto";
import { setOnboarding } from "@/lib/student-profile-state";
import { cn } from "@/lib/utils";

const STAGES = ["Academic", "Life Load", "Grit Check", "Equity"] as const;
const LOADS = [25, 50, 75, 100] as const;
const MODES: StudyMode[] = ["Internal", "Online", "Hybrid"];
const FRONTLINE = ["Hospitality", "Retail", "Hospital / Clinical Care", "Primary Family Caregiving"];

const ANSWERS = [
  { label: "I stay on task, re-prioritise the queue, and keep the team moving until the issue is fixed.", perseverance: 5, interest: 4 },
  { label: "I lift morale, split the work into small wins, and escalate the error through the right channel.", perseverance: 4, interest: 5 },
  { label: "I handle my own tasks well and wait for a supervisor to sort out the system error.", perseverance: 3, interest: 2 },
  { label: "I find it overwhelming and step back until the pressure drops.", perseverance: 1, interest: 1 },
];

const EQUITY = [
  { key: "firstGen", label: "First-Generation University Student" },
  { key: "regional", label: "Regional / Remote Postcode Resident" },
  { key: "centrelink", label: "Hold Verifiable Centrelink Concession Status" },
] as const;

type EquityKey = (typeof EQUITY)[number]["key"];

const pill = (active: boolean) =>
  cn(
    "rounded-full border px-4 py-2 text-sm font-bold transition",
    active
      ? "border-charcoal bg-charcoal text-charcoal-foreground"
      : "border-charcoal/15 bg-card text-charcoal hover:border-charcoal/40",
  );

export function StudentOnboardingWizard() {
  const [stage, setStage] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const [academic, setAcademic] = useState<null | { degree: string; year: number; gpa: number }>(null);
  const [load, setLoad] = useState<number>(100);
  const [mode, setMode] = useState<StudyMode>("Internal");
  const [hours, setHours] = useState(20);
  const [frontline, setFrontline] = useState<Set<string>>(new Set());
  const [grit, setGrit] = useState<number | null>(null);
  const [equity, setEquity] = useState<Record<EquityKey, boolean>>({ firstGen: false, regional: false, centrelink: false });
  const [processing, setProcessing] = useState(false);

  const connect = () => {
    setConnecting(true);
    setTimeout(() => {
      setAcademic({ degree: "Bachelor of Chiropractic", year: 3, gpa: 74 });
      setConnecting(false);
    }, 1200);
  };

  const canNext = stage === 0 ? !!academic : stage === 2 ? grit !== null : true;

  const toggleFrontline = (s: string) =>
    setFrontline((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });

  const submit = () => {
    if (!academic) return;
    setProcessing(true);
    const answer = ANSWERS[grit ?? 0]!;
    const gritBase = 50 + (answer.perseverance + answer.interest) * 4;
    const sector: WorkSector = (["Hospital / Clinical Care", "Hospitality", "Retail"].find((s) => frontline.has(s)) as WorkSector) ?? "Other";
    const tags = [
      equity.firstGen && "First-Gen Student",
      equity.regional && "Regional / Remote",
      equity.centrelink && "Centrelink Concession",
      frontline.has("Primary Family Caregiving") && "Caretaker",
    ].filter(Boolean) as string[];
    const profile: StudentProfile = {
      id: "me",
      candidateCode: "CANDIDATE #AU-YOU",
      degreeTitle: academic.degree,
      discipline: "Medicine",
      rawGpa: academic.gpa,
      weeklyHours: hours,
      workSector: sector,
      visaStatus: "Citizen",
      yearLevel: academic.year,
      studyMode: mode,
      studyLoad: load,
      birthYear: 2003,
      equityTags: tags,
      verifiedEquity: { centrelinkConcession: equity.centrelink, lowSesPostcode: equity.regional },
      softSkills: {
        clientEmpathy: Math.min(100, gritBase + (frontline.size ? 6 : 0)),
        pressureResilience: Math.min(100, gritBase + hours * 0.3),
        crisisManagement: Math.min(100, gritBase),
        adaptability: Math.min(100, gritBase + 4),
      },
    };
    const result = calculateIrtoScore(profile);
    setTimeout(() => {
      setOnboarding({ completed: true, result, gritAnswers: [grit ?? 0] });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 1800);
  };

  if (processing) {
    return (
      <section className="panel-dark mx-auto flex max-w-2xl flex-col items-center gap-4 p-10 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-lime" />
        <p className="eyebrow text-lime">Rounder Matrix Engine</p>
        <h2 className="text-2xl text-charcoal-foreground">Running calculateIrtoScore…</h2>
        <p className="text-sm text-charcoal-foreground/70">
          Applying discipline density, time-poverty offsets and frontline modifiers. Launching your Live Match Radar.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-charcoal/15 bg-card shadow-sm" aria-label="Student onboarding">
      {/* Progress */}
      <ol className="grid grid-cols-4 border-b border-charcoal/10">
        {STAGES.map((s, i) => (
          <li key={s} className="px-2 py-4 text-center">
            <div className={cn("mx-auto mb-2 h-1.5 rounded-full transition-colors duration-500", i <= stage ? "bg-lime" : "bg-charcoal/10")} />
            <span className={cn("text-[11px] font-black uppercase tracking-wide", i === stage ? "text-charcoal" : "text-charcoal/45")}>
              {i + 1}. {s}
            </span>
          </li>
        ))}
      </ol>

      <div key={stage} className="animate-in fade-in slide-in-from-right-4 space-y-6 p-6 duration-300 sm:p-8">
        {stage === 0 && (
          <>
            <Header eyebrow="Stage 1" title="Academic Verification" />
            <div className="flex flex-col items-center gap-4 text-center">
              <button
                type="button"
                onClick={connect}
                disabled={connecting || !!academic}
                className="inline-flex items-center gap-2 rounded-xl bg-charcoal px-6 py-4 text-base font-black text-charcoal-foreground transition hover:opacity-90 disabled:opacity-80"
              >
                {connecting ? <Loader2 className="h-5 w-5 animate-spin" /> : academic ? <Check className="h-5 w-5 text-lime" /> : "📄"}
                {academic ? "My eQuals Connected" : connecting ? "Connecting securely…" : "Connect Securely via My eQuals"}
              </button>
              <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
                Rounder connects directly with your official university credentials proxy to securely ingest your verified GPA and discipline structure while locking 100% of your personal identity parameters behind our Proxy Shield.
              </p>
              {academic && (
                <dl className="w-full rounded-xl border border-charcoal/10 bg-secondary/60 p-4 text-left text-sm">
                  <Row k="Degree" v={`${academic.degree} - ${academic.year}rd Year`} />
                  <Row k="Verified GPA" v={`${academic.gpa.toFixed(2)}%`} />
                  <Row k="Identity" v="Masked · Proxy Shield active" />
                </dl>
              )}
            </div>
          </>
        )}

        {stage === 1 && (
          <>
            <Header eyebrow="Stage 2" title="Life Load Ledger" />
            <Field label="Current Study Load">
              <div className="grid grid-cols-4 gap-2">
                {LOADS.map((l) => (
                  <button key={l} type="button" onClick={() => setLoad(l)} className={pill(load === l)}>{l}%</button>
                ))}
              </div>
            </Field>
            <Field label="Study Mode">
              <div className="flex flex-wrap gap-2">
                {MODES.map((m) => (
                  <button key={m} type="button" onClick={() => setMode(m)} className={pill(mode === m)}>{m}</button>
                ))}
              </div>
            </Field>
            <Field label={`Weekly External Work Commitment Hours — ${hours >= 40 ? "40+" : hours} hrs`}>
              <input type="range" min={0} max={40} value={hours} onChange={(e) => setHours(Number(e.target.value))} className="w-full accent-lime" aria-label="Weekly external work hours" />
            </Field>
            <Field label="Frontline Workplace Intensity Categories">
              <div className="grid gap-2 sm:grid-cols-2">
                {FRONTLINE.map((f) => {
                  const on = frontline.has(f);
                  return (
                    <label key={f} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 text-sm font-bold transition", on ? "border-lime bg-lime/15 text-charcoal" : "border-charcoal/10 text-charcoal hover:border-charcoal/30")}>
                      <input type="checkbox" checked={on} onChange={() => toggleFrontline(f)} className="h-4 w-4 accent-lime" />
                      {f}
                    </label>
                  );
                })}
              </div>
            </Field>
          </>
        )}

        {stage === 2 && (
          <>
            <Header eyebrow="Stage 3 · Adaptive Scenario Sandbox" title="Scenario 1 of 5: The High-Pressure Roster Constraint" />
            <p className="rounded-xl bg-secondary/60 p-4 text-sm leading-relaxed text-charcoal">
              Your team is running heavily understaffed during an intense peak shift. A critical system error occurs, and your team's energy drops instantly. How do you handle the pressure?
            </p>
            <div className="space-y-2">
              {ANSWERS.map((a, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setGrit(i);
                    setTimeout(() => setStage(3), 350);
                  }}
                  className={cn("w-full rounded-xl border-2 px-4 py-3 text-left text-sm font-semibold transition", grit === i ? "border-lime bg-lime/15 text-charcoal" : "border-charcoal/10 text-charcoal hover:border-charcoal/30")}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </>
        )}

        {stage === 3 && (
          <>
            <Header eyebrow="Stage 4" title="Equity Context Flags" />
            <div className="divide-y divide-charcoal/10 rounded-xl border border-charcoal/10">
              {EQUITY.map((e) => (
                <label key={e.key} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-4 text-sm font-bold text-charcoal">
                  {e.label}
                  <Switch checked={equity[e.key]} onCheckedChange={(v) => setEquity((p) => ({ ...p, [e.key]: v }))} />
                </label>
              ))}
            </div>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4" /> Flags are verified privately and never shown with your identity.
            </p>
          </>
        )}

        <div className="flex items-center justify-between border-t border-charcoal/10 pt-5">
          <button type="button" onClick={() => setStage((s) => s - 1)} disabled={stage === 0} className="rounded-lg px-4 py-2 text-sm font-bold text-charcoal/60 transition hover:text-charcoal disabled:invisible">
            ← Back
          </button>
          {stage < 3 ? (
            <button type="button" onClick={() => setStage((s) => s + 1)} disabled={!canNext} className="rounded-lg bg-charcoal px-5 py-2.5 text-sm font-black text-charcoal-foreground transition hover:opacity-90 disabled:opacity-40">
              Next →
            </button>
          ) : (
            <button type="button" onClick={submit} className="rounded-lg bg-lime px-5 py-2.5 text-sm font-black text-charcoal shadow-lg shadow-lime/30 transition hover:opacity-90">
              🔥 Calculate My Grit Score
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function Header({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="eyebrow text-muted-foreground">{eyebrow}</p>
      <h2 className="mt-2 text-xl text-charcoal sm:text-2xl">{title}</h2>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <p className="text-xs font-black uppercase text-charcoal/70">{label}</p>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 py-1">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-bold text-charcoal">{v}</dd>
    </div>
  );
}
