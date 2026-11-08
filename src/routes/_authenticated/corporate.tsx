import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, FileText } from "lucide-react";
import { CaseStudyDrawer } from "@/components/CaseStudyDrawer";
import { CreateOpportunityModal } from "@/components/CreateOpportunityModal";
import { GritBreakdownPanel } from "@/components/GritBreakdownPanel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  createScholarshipFn,
  getProviderDashboard,
  listStudents,
  requestMatchFn,
  topUpCreditsFn,
  type CandidateRecord,
  type PublishScholarshipInput,
  type ScholarshipFund,
} from "@/lib/provider.functions";
import { rankCandidates, type FilterCriteria, type StudyMode } from "@/lib/irto";

type DrawerCandidate = {
  code: string;
  degree: string;
  year: string;
  grit: number;
  uni: string;
  endorsement: string;
  endorser: string;
  traits: string[];
};

type FeedStatus = "passive" | "active" | "revealed";

export const Route = createFileRoute("/_authenticated/corporate")({
  validateSearch: (search: Record<string, unknown>) => ({
    track:
      search["track"] === "scholarship-provider" || search["track"] === "scholarship"
        ? ("scholarship-provider" as const)
        : ("graduate-employer" as const),
  }),
  head: () => ({
    meta: [
      { title: "Employers & Providers Hub — ROUNDER HQ" },
      {
        name: "description",
        content:
          "Filter anonymized Australian candidates by grit, life context and competencies — unlock matches with Match Credits.",
      },
      { property: "og:title", content: "Employers & Providers Hub — ROUNDER HQ" },
      {
        property: "og:description",
        content: "Context-matched graduate hiring for Australian employers and scholarship donors.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CorporateHub,
});

const lifeLoadOptions = [
  "High External Workload 20+ hrs",
  "Primary Caretaker",
  "First-Gen Student",
  "Regional/Remote Background",
  "Low-SES Postcode",
];

const disciplines = ["Law", "Engineering", "Business", "Medicine", "Arts"];
const visaOptions = ["Any Status", "Citizen", "Permanent Resident", "Student Visa 500"];
const yearOptions = ["Any Year", "1", "2", "3", "4"];
const studyModeOptions: StudyMode[] = ["Internal", "Online", "Hybrid"];
const studyLoadOptions = [25, 50, 75, 100] as const;

function FilterSlider({
  label,
  value,
  onChange,
  suffix = "%+",
  editorial = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  editorial?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className={`text-xs font-bold ${editorial ? "text-charcoal" : "text-charcoal-foreground"}`}>
          {label}
        </label>
        <span className="rounded-full bg-lime px-2 py-0.5 text-xs font-black text-lime-foreground">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-lime"
        aria-label={label}
      />
    </div>
  );
}

function GateSelect({
  label,
  value,
  onChange,
  options,
  editorial = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  editorial?: boolean;
}) {
  return (
    <label className="block">
      <span className={`text-xs font-bold ${editorial ? "text-charcoal" : "text-charcoal-foreground"}`}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-xs font-semibold ${
          editorial
            ? "border-charcoal/20 bg-card text-charcoal"
            : "border-charcoal-foreground/20 bg-charcoal text-charcoal-foreground"
        }`}
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

function MultiSelectGate<T extends string | number>({
  label,
  options,
  selected,
  onToggle,
  formatOption = String,
  editorial = false,
}: {
  label: string;
  options: readonly T[];
  selected: Set<T>;
  onToggle: (option: T) => void;
  formatOption?: (option: T) => string;
  editorial?: boolean;
}) {
  return (
    <fieldset>
      <legend className={`text-xs font-bold ${editorial ? "text-charcoal" : "text-charcoal-foreground"}`}>
        {label}
      </legend>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {options.map((option) => {
          const checked = selected.has(option);
          return (
            <label
              key={option}
              className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-xs font-bold transition-colors ${
                checked
                  ? "border-lime bg-lime text-lime-foreground"
                  : editorial
                    ? "border-charcoal/20 bg-secondary text-charcoal hover:border-lime"
                    : "border-charcoal-foreground/20 bg-charcoal-foreground/5 text-charcoal-foreground hover:border-lime"
              }`}
            >
              <Checkbox
                checked={checked}
                onCheckedChange={() => onToggle(option)}
                aria-label={`${label}: ${formatOption(option)}`}
              />
              <span>{formatOption(option)}</span>
            </label>
          );
        })}
      </div>
      <p className={`mt-1.5 text-[11px] font-semibold ${editorial ? "text-muted-foreground" : "text-charcoal-foreground/60"}`}>
        {selected.size ? `${selected.size} selected` : "Any accepted"}
      </p>
    </fieldset>
  );
}

function CorporateHub() {
  const { track } = Route.useSearch();
  const queryClient = useQueryClient();
  const [caseStudy, setCaseStudy] = useState<DrawerCandidate | null>(null);
  const [lifeLoad, setLifeLoad] = useState<Set<string>>(new Set());
  const [empathy, setEmpathy] = useState(70);
  const [resilience, setResilience] = useState(80);
  const [targetGpa, setTargetGpa] = useState(85);
  const [selectedDisciplines, setSelectedDisciplines] = useState<Set<string>>(new Set());
  const [visa, setVisa] = useState("Any Status");
  const [yearLevel, setYearLevel] = useState("Any Year");
  const [selectedStudyModes, setSelectedStudyModes] = useState<Set<StudyMode>>(new Set());
  const [selectedStudyLoads, setSelectedStudyLoads] = useState<Set<number>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [activeFundId, setActiveFundId] = useState<string | null>(null);
  const scholarship = track === "scholarship-provider";

  const studentsQuery = useQuery({ queryKey: ["students"], queryFn: () => listStudents() });
  const dashboardQuery = useQuery({
    queryKey: ["provider-dashboard"],
    queryFn: () => getProviderDashboard(),
  });

  const students = useMemo(() => studentsQuery.data ?? [], [studentsQuery.data]);
  const dashboard = dashboardQuery.data;
  const credits = dashboard?.credits ?? 0;
  const funds = useMemo(() => dashboard?.scholarships ?? [], [dashboard?.scholarships]);
  const matches = useMemo(() => dashboard?.matches ?? [], [dashboard?.matches]);

  const invalidateAll = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["students"] }),
      queryClient.invalidateQueries({ queryKey: ["provider-dashboard"] }),
    ]);

  const requestMutation = useMutation({
    mutationFn: (studentId: string) => requestMatchFn({ data: { studentId } }),
    onSuccess: async () => {
      await invalidateAll();
      toast.success("Handshake pending", {
        description: "The candidate has been notified. 1 Match Credit used.",
      });
    },
    onError: (error) => {
      toast.error("Match request failed", { description: error.message });
    },
  });

  const topUpMutation = useMutation({
    mutationFn: (amount: number) => topUpCreditsFn({ data: { amount } }),
    onSuccess: async (balance) => {
      await queryClient.invalidateQueries({ queryKey: ["provider-dashboard"] });
      toast.success("Top-up successful", { description: `Balance is now ${balance} Match Credits.` });
    },
    onError: (error) => {
      toast.error("Top-up failed", { description: error.message });
    },
  });

  const publishMutation = useMutation({
    mutationFn: (input: PublishScholarshipInput) => createScholarshipFn({ data: input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["provider-dashboard"] });
      toast.success("Scholarship fund live", {
        description: "Your fund is listed under My Funds and can drive the discovery feed.",
      });
    },
    onError: (error) => {
      toast.error("Publish failed", { description: error.message });
    },
  });

  const toggleLifeLoad = (opt: string) => {
    const next = new Set(lifeLoad);
    next.has(opt) ? next.delete(opt) : next.add(opt);
    setLifeLoad(next);
  };

  const toggleSetValue = <T,>(setter: React.Dispatch<React.SetStateAction<Set<T>>>, value: T) => {
    setter((current) => {
      const next = new Set(current);
      next.has(value) ? next.delete(value) : next.add(value);
      return next;
    });
  };

  /** Push a published fund's criteria into the discovery feed filters. */
  const applyFund = (fund: ScholarshipFund) => {
    if (activeFundId === fund.id) {
      setActiveFundId(null);
      setSelectedDisciplines(new Set());
      setLifeLoad(new Set());
      setEmpathy(70);
      setResilience(80);
      return;
    }
    setActiveFundId(fund.id);
    setSelectedDisciplines(
      fund.discipline && fund.discipline !== "All Disciplines" ? new Set([fund.discipline]) : new Set(),
    );
    setLifeLoad(new Set(fund.lifeLoad));
    setEmpathy(fund.minEmpathy);
    setResilience(fund.minResilience);
  };

  // Every filter widget feeds the IRTO engine; results re-rank instantly.
  const ranked = useMemo(() => {
    const criteria: FilterCriteria = {
      mandatory: {
        ...(selectedDisciplines.size ? { disciplines: Array.from(selectedDisciplines) } : {}),
        ...(visa !== "Any Status" ? { visaStatuses: [visa] } : {}),
        ...(yearLevel !== "Any Year" ? { yearLevels: [Number(yearLevel)] } : {}),
        ...(selectedStudyModes.size ? { studyModes: Array.from(selectedStudyModes) } : {}),
        ...(selectedStudyLoads.size ? { studyLoads: Array.from(selectedStudyLoads) } : {}),
      },
      preferred: {
        adjustedGpa: targetGpa,
        clientEmpathy: empathy,
        pressureResilience: resilience,
        ...(lifeLoad.size ? { equityTags: Array.from(lifeLoad) } : {}),
      },
    };
    return rankCandidates(students, criteria);
  }, [students, selectedDisciplines, visa, yearLevel, selectedStudyModes, selectedStudyLoads, targetGpa, empathy, resilience, lifeLoad]);

  const studentByCode = (code: string) => students.find((s) => s.candidateCode === code);
  const matchFor = (code: string) => {
    const student = studentByCode(code);
    return student ? matches.find((m) => m.studentId === student.id) : undefined;
  };
  const statusOf = (code: string): FeedStatus => {
    const status = matchFor(code)?.status;
    return status === "accepted" ? "revealed" : status === "pending" ? "active" : "passive";
  };

  const requestMatch = (code: string) => {
    const student = studentByCode(code);
    if (!student) {
      toast.error("Candidate not found in the live registry.");
      return;
    }
    requestMutation.mutate(student.id);
  };

  const handlePublish = async (input: PublishScholarshipInput) => {
    await publishMutation.mutateAsync(input);
  };

  return (
    <div className={scholarship ? "bg-background" : "bg-charcoal"}>
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <section
        className={`border p-5 sm:px-8 sm:py-6 ${
          scholarship
            ? "rounded-lg border-charcoal/20 bg-card text-charcoal shadow-sm"
            : "rounded-lg border-charcoal-foreground/15 bg-charcoal text-charcoal-foreground"
        }`}
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-black sm:text-3xl">
              {scholarship ? "🏆 Scholarship Provider" : "💼 Graduate Employer"}
            </h1>
            {dashboard?.organisationName && (
              <p className={`mt-1 text-sm font-bold ${scholarship ? "text-muted-foreground" : "text-charcoal-foreground/60"}`}>
                {dashboard.organisationName}
                {dashboard.contactPerson ? ` · ${dashboard.contactPerson}` : ""}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className={`rounded-md border px-4 py-2 text-sm font-black ${
            scholarship
              ? "border-charcoal/20 bg-secondary text-charcoal"
              : "border-lime/50 bg-lime/10 text-lime"
          }`}>
            {credits} Match Credits
          </span>
          <Button
            onClick={() => topUpMutation.mutate(10)}
            disabled={topUpMutation.isPending}
            className="bg-lime font-black text-lime-foreground hover:bg-lime/90"
          >
            + Top Up
          </Button>
          <Button
            onClick={() => setCreateOpen(true)}
            variant={scholarship ? "default" : "outline"}
            className={
              scholarship
                ? "bg-charcoal font-black text-charcoal-foreground hover:bg-charcoal/90"
                : "border-lime bg-transparent font-black text-lime hover:bg-lime hover:text-lime-foreground"
            }
          >
            {scholarship ? "Configure New Scholarship Fund" : "Post Graduate Intake Slot"}
          </Button>
          </div>
        </div>
        <p className={`mt-4 border-t pt-4 text-sm font-normal ${
          scholarship
            ? "border-charcoal/10 text-muted-foreground"
            : "border-charcoal-foreground/10 text-charcoal-foreground/65"
        }`}>
          One unified profile · Shared anonymous candidate records · Connected token wallet.
        </p>
      </section>

      <section
        aria-labelledby="pipeline-signals-title"
        className={`border-y py-6 ${scholarship ? "border-charcoal/20" : "border-charcoal-foreground/20"}`}
      >
          <h2
            id="pipeline-signals-title"
            className={`text-sm font-bold sm:text-base ${scholarship ? "text-charcoal" : "text-charcoal-foreground"}`}
          >
            {scholarship
              ? "📊 Finalist Signals — Auditable impact metrics across your active candidates."
              : "📊 Pipeline Signals — Auditable impact metrics across your active candidates."}
          </h2>
          <dl className={`mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border sm:grid-cols-4 ${
            scholarship
              ? "border-charcoal/20 bg-charcoal/20"
              : "border-lime/50 bg-lime/50"
          }`}>
            {(scholarship
              ? [
                  [String(students.length), "Eligible Profiles"],
                  [String(ranked.length), "IRTO Finalists"],
                  [String(matches.length), "Match Requests"],
                  [String(credits), "Shared Credits"],
                ]
              : [
                  [String(students.length), "Eligible Profiles"],
                  [String(ranked.length), "Grit Finalists"],
                  [String(matches.length), "Match Requests"],
                  [String(credits), "Shared Credits"],
                ]
            ).map(([value, label]) => (
              <div key={label} className={scholarship ? "bg-background px-4 py-6" : "bg-charcoal px-4 py-6"}>
                <dt className={`text-xs font-medium ${scholarship ? "text-muted-foreground" : "text-charcoal-foreground/65"}`}>{label}</dt>
                <dd className={`mt-2 font-display text-3xl font-black ${scholarship ? "text-charcoal" : "text-lime"}`}>{value}</dd>
              </div>
            ))}
          </dl>
      </section>

      {scholarship && (
        <section aria-labelledby="my-funds-title" className="rounded-lg border border-charcoal/20 bg-card p-5 text-charcoal shadow-sm sm:px-8 sm:py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="my-funds-title" className="text-lg font-black sm:text-xl">💰 My Funds</h2>
            <span className="text-xs font-semibold text-muted-foreground">
              {funds.length ? `${funds.length} published` : "No funds published yet"}
            </span>
          </div>
          {funds.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Publish your first scholarship fund with “Configure New Scholarship Fund” — it will
              appear here and can drive the discovery feed filters.
            </p>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {funds.map((fund) => {
                const active = activeFundId === fund.id;
                return (
                  <li
                    key={fund.id}
                    className={`rounded-xl border p-4 transition ${
                      active ? "border-lime bg-lime/10 ring-2 ring-lime/50" : "border-charcoal/15 bg-secondary/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-charcoal">{fund.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {[fund.orgClass, fund.location, fund.stipendAud != null ? `$${fund.stipendAud.toLocaleString()} AUD` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => applyFund(fund)}
                        className={
                          active
                            ? "bg-charcoal text-charcoal-foreground hover:bg-charcoal/90"
                            : "bg-lime font-black text-lime-foreground hover:bg-lime/90"
                        }
                      >
                        {active ? "Clear filters" : "Drive feed"}
                      </Button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {fund.discipline !== "All Disciplines" && (
                        <span className="rounded-full bg-charcoal/10 px-2 py-0.5 text-[10px] font-bold text-charcoal">
                          {fund.discipline}
                        </span>
                      )}
                      {fund.lifeLoad.map((tag) => (
                        <span key={tag} className="rounded-full bg-charcoal/10 px-2 py-0.5 text-[10px] font-bold text-charcoal">
                          {tag}
                        </span>
                      ))}
                      {fund.finalistRequirements.map((req) => (
                        <span key={req} className="rounded-full bg-lime/25 px-2 py-0.5 text-[10px] font-bold text-charcoal">
                          {req}
                        </span>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <div className="grid gap-8 pt-2 lg:grid-cols-4 lg:gap-10">
        {/* Sidebar filters */}
        <aside className={`h-fit rounded-lg border p-6 lg:sticky lg:top-36 ${
          scholarship
            ? "border-charcoal/20 bg-card text-charcoal"
            : "border-charcoal-foreground/15 bg-charcoal text-charcoal-foreground"
        }`}>
          <h2 className={`text-lg ${scholarship ? "text-charcoal" : "text-charcoal-foreground"}`}>⚡ Filter by Grit &amp; Context</h2>
          <p className={`mt-1 text-xs ${scholarship ? "text-muted-foreground" : "text-charcoal-foreground/60"}`}>
            IRTO engine re-ranks the feed on every change.
          </p>

          <div className="mt-5">
            <p className={`eyebrow ${scholarship ? "text-charcoal" : "text-lime"}`}>Mandatory Hard Gates</p>
            <div className="mt-3 space-y-3">
              <MultiSelectGate
                label="Discipline"
                options={disciplines}
                selected={selectedDisciplines}
                onToggle={(value) => toggleSetValue(setSelectedDisciplines, value)}
                editorial={scholarship}
              />
              <GateSelect
                label="Visa / Citizenship"
                value={visa}
                onChange={setVisa}
                options={visaOptions}
                editorial={scholarship}
              />
              <GateSelect
                label="Year Level"
                value={yearLevel}
                onChange={setYearLevel}
                options={yearOptions}
                editorial={scholarship}
              />
              <MultiSelectGate
                label="Study Mode"
                options={studyModeOptions}
                selected={selectedStudyModes}
                onToggle={(value) => toggleSetValue(setSelectedStudyModes, value)}
                editorial={scholarship}
              />
              <MultiSelectGate
                label="Study Load Focus"
                options={studyLoadOptions}
                selected={selectedStudyLoads}
                onToggle={(value) => toggleSetValue(setSelectedStudyLoads, value)}
                formatOption={(value) => `${value}%`}
                editorial={scholarship}
              />
            </div>
          </div>

          <div className="mt-6">
            <p className={`eyebrow ${scholarship ? "text-charcoal" : "text-lime"}`}>Preferred Life Load Variables</p>
            <div className="mt-3 space-y-2">
              {lifeLoadOptions.map((opt) => (
                <label
                  key={opt}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 ${
                    scholarship ? "border border-charcoal/10 bg-secondary" : "bg-charcoal-foreground/8"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={lifeLoad.has(opt)}
                    onChange={() => toggleLifeLoad(opt)}
                    className="h-4 w-4 accent-lime"
                  />
                   <span className={`text-xs font-semibold ${scholarship ? "text-charcoal" : "text-charcoal-foreground/85"}`}>{opt}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-6 space-y-5">
            <p className={`eyebrow ${scholarship ? "text-charcoal" : "text-lime"}`}>Core Competencies</p>
            <FilterSlider label="Target Adjusted GPA" value={targetGpa} onChange={setTargetGpa} editorial={scholarship} />
            <FilterSlider label="Client Empathy" value={empathy} onChange={setEmpathy} editorial={scholarship} />
            <FilterSlider label="Resilience" value={resilience} onChange={setResilience} editorial={scholarship} />
          </div>
        </aside>

        {/* Candidate feed */}
        <section className="space-y-5 lg:col-span-3">
          <div className="flex flex-wrap items-end justify-between gap-3 pb-2">
            <h2 className={`text-xl font-black sm:text-2xl ${scholarship ? "text-charcoal" : "text-charcoal-foreground"}`}>
              {scholarship ? "Scholarship Finalist Discovery" : "Live Graduate Candidate Feed"}
            </h2>
            <span className={`flex items-center gap-2 text-xs font-medium ${scholarship ? "text-muted-foreground" : "text-charcoal-foreground/60"}`}>
              <span className="pulse inline-block h-2 w-2 rounded-full bg-lime" /> {ranked.length}{" "}
              matched · ranked by Grit Fit
            </span>
          </div>

          {studentsQuery.isLoading && (
            <div className="panel-light p-8 text-center">
              <p className="text-sm font-bold text-charcoal">Loading the live candidate registry…</p>
            </div>
          )}

          {!studentsQuery.isLoading && ranked.length === 0 && (
            <div className="panel-light p-8 text-center">
              <p className="text-sm font-bold text-charcoal">
                No candidates clear your mandatory hard gates.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Loosen a gate — discipline, visa status, year level, study mode or study load.
              </p>
            </div>
          )}

          {ranked.map((result) => {
            const c = result.student as CandidateRecord;
            const status = statusOf(c.candidateCode);
            const match = matchFor(c.candidateCode);
            const identity = match?.identity ?? null;
            const revealed = status === "revealed" && identity !== null;
            const unlocked = revealed && !scholarship;
            return (
              <article
                key={c.candidateCode}
                className={`rounded-lg border p-5 transition duration-500 sm:p-7 ${
                  unlocked
                    ? "border-[#FDFBF7]/30 bg-charcoal"
                    : scholarship
                      ? "border-charcoal/15 bg-card"
                      : "border-charcoal-foreground/10 bg-background"
                } ${
                  revealed
                    ? `handshake-flash ring-2 ${unlocked ? "ring-[#FDFBF7]/30" : "ring-lime"}`
                    : status === "active"
                      ? "ring-2 ring-lime/60"
                      : ""
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className={`font-mono text-base font-black tracking-wider ${unlocked ? "text-white" : "text-charcoal"}`}>
                      {revealed && identity ? `✅ ${identity.legalName}` : c.candidateCode}
                    </p>
                    <p className={`mt-1 text-sm ${unlocked ? "text-white/80" : "text-muted-foreground"}`}>
                      {c.degree} · {c.year}
                    </p>
                    <p className={`text-xs ${unlocked ? "text-white/60" : "text-muted-foreground/70"}`}>{c.uni}</p>
                  </div>
                  <div className="flex flex-col items-end text-right">
                    <GritBreakdownPanel
                      result={result}
                      theme={scholarship ? "scholarship" : "graduate"}
                      tone={unlocked ? "dark" : "light"}
                    />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {c.traits.map((t) => (
                    <span
                      key={t}
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        unlocked ? "bg-white/10 text-white" : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {t}
                    </span>
                  ))}
                  {result.frontlineBoost && (
                    <span className="rounded-full bg-lime/20 px-2.5 py-1 text-xs font-black text-charcoal">
                      ⚡ Frontline pressure boost
                    </span>
                  )}
                </div>

                <blockquote className={`mt-4 rounded-2xl border-l-4 border-lime p-4 ${unlocked ? "bg-white/5" : "bg-secondary/60"}`}>
                  <p className={`text-sm italic ${unlocked ? "text-white/85" : "text-secondary-foreground"}`}>“{c.endorsement}”</p>
                  <footer className={`mt-2 text-xs font-bold ${unlocked ? "text-white/60" : "text-muted-foreground"}`}>
                    ✓ Verified — {c.endorser}
                  </footer>
                </blockquote>

                {revealed && identity && (
                  <div className={`mt-4 rounded-2xl border-2 p-4 ${unlocked ? "border-[#FDFBF7]/30 bg-[#FDFBF7]/[0.04]" : "border-lime bg-lime/10"}`}>
                    <p className={`eyebrow flex items-center gap-2 ${unlocked ? "text-[#FDFBF7]" : "text-charcoal"}`}>
                      {unlocked ? (
                        <Check className="h-4 w-4" strokeWidth={3.5} aria-hidden="true" />
                      ) : (
                        <span aria-hidden="true">🔓</span>
                      )}
                      Privacy mask lifted
                    </p>
                    <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                      <div>
                        <dt className={`text-xs font-bold ${unlocked ? "text-white/60" : "text-charcoal/60"}`}>Legal name</dt>
                        <dd className={`font-black ${unlocked ? "text-white" : "text-charcoal"}`}>{identity.legalName}</dd>
                      </div>
                      <div>
                        <dt className={`text-xs font-bold ${unlocked ? "text-white/60" : "text-charcoal/60"}`}>Phone</dt>
                        <dd className={`font-semibold ${unlocked ? "text-white" : "text-charcoal"}`}>{identity.phone}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className={`text-xs font-bold ${unlocked ? "text-white/60" : "text-charcoal/60"}`}>Email</dt>
                        <dd className={`break-all font-semibold ${unlocked ? "text-white" : "text-charcoal"}`}>{identity.email}</dd>
                      </div>
                    </dl>
                    {unlocked ? (
                      <a
                        href={identity.transcriptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-[#FDFBF7]/60 bg-transparent px-4 py-3 text-xs font-black uppercase tracking-wider text-[#FDFBF7] transition hover:bg-white/5 active:scale-[0.99]"
                      >
                        <FileText className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                        View Verified My eQuals Transcript Link
                      </a>
                    ) : (
                      <a
                        href={identity.transcriptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-2 rounded-full bg-charcoal px-4 py-2.5 text-xs font-black text-charcoal-foreground transition hover:brightness-125"
                      >
                        📄 View Verified My eQuals Transcript Link
                      </a>
                    )}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    onClick={() =>
                      setCaseStudy({
                        code: c.candidateCode,
                        degree: c.degree,
                        year: c.year,
                        grit: result.adjustedGpa,
                        uni: c.uni,
                        endorsement: c.endorsement,
                        endorser: c.endorser,
                        traits: c.traits,
                      })
                    }
                    className={`text-xs font-bold ${
                      unlocked
                        ? "border-white/30 bg-transparent text-white hover:bg-white/10"
                        : "border-charcoal/25 text-charcoal hover:bg-charcoal/5"
                    }`}
                  >
                    ⚙️ View Full Anonymous Case Study
                  </Button>
                  <Button
                    onClick={() => requestMatch(c.candidateCode)}
                    disabled={status !== "passive" || requestMutation.isPending}
                    className={`text-xs font-black ${
                      status !== "passive"
                        ? unlocked
                          ? "border-2 border-[#FDFBF7]/40 bg-[#FDFBF7]/10 text-white"
                          : "border-2 border-lime bg-lime/20 text-charcoal"
                        : "bg-lime text-lime-foreground hover:brightness-105"
                    }`}
                  >
                    {revealed
                      ? "🤝 Handshake Complete"
                      : status === "active"
                        ? "🤝 Handshake Pending"
                        : "🪙 REQUEST MATCH & UNLOCK | 1 Credit"}
                  </Button>
                </div>
              </article>
            );
          })}
        </section>
      </div>

      <CaseStudyDrawer
        candidate={caseStudy}
        credits={credits}
        matched={caseStudy ? statusOf(caseStudy.code) !== "passive" : false}
        onClose={() => setCaseStudy(null)}
        onRequestMatch={requestMatch}
      />

      <CreateOpportunityModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        campaign={track}
        onPublish={handlePublish}
      />
      </div>
    </div>
  );
}
