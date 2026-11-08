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
import { createScholarshipFn, getProviderDashboard, listStudents, requestMatchFn, type CandidateRecord, type PublishScholarshipInput, type ScholarshipFund, } from "@/lib/provider.functions";
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
    head: () => ({
        meta: [
            { title: "Scholarship Provider Dashboard — ROUNDER HQ" },
            {
                name: "description",
                content: "Filter anonymized Australian candidates by grit, life context and competencies — unlock matches with Match Credits.",
            },
            { property: "og:title", content: "Scholarship Provider Dashboard — ROUNDER HQ" },
            {
                property: "og:description",
                content: "Private scholarship candidate discovery and consent-based contact requests.",
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
function FilterSlider({ label, value, onChange, suffix = "%+", editorial = false, }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    suffix?: string;
    editorial?: boolean;
}) {
    return (<div>
      <div className="flex items-center justify-between">
        <label className={`text-xs font-bold ${editorial ? "text-charcoal" : "text-charcoal-foreground"}`}>
          {label}
        </label>
        <span className="rounded-full bg-lime px-2 py-0.5 text-xs font-black text-lime-foreground">
          {value}
          {suffix}
        </span>
      </div>
      <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 w-full accent-lime" aria-label={label}/>
    </div>);
}
function GateSelect({ label, value, onChange, options, editorial = false, }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: string[];
    editorial?: boolean;
}) {
    return (<label className="block">
      <span className={`text-xs font-bold ${editorial ? "text-charcoal" : "text-charcoal-foreground"}`}>
        {label}
      </span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-xs font-semibold ${editorial
            ? "border-charcoal/20 bg-card text-charcoal"
            : "border-charcoal-foreground/20 bg-charcoal text-charcoal-foreground"}`}>
        {options.map((o) => (<option key={o}>{o}</option>))}
      </select>
    </label>);
}
function MultiSelectGate<T extends string | number>({ label, options, selected, onToggle, formatOption = String, editorial = false, }: {
    label: string;
    options: readonly T[];
    selected: Set<T>;
    onToggle: (option: T) => void;
    formatOption?: (option: T) => string;
    editorial?: boolean;
}) {
    return (<fieldset>
      <legend className={`text-xs font-bold ${editorial ? "text-charcoal" : "text-charcoal-foreground"}`}>
        {label}
      </legend>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {options.map((option) => {
            const checked = selected.has(option);
            return (<label key={option} className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-xs font-bold transition-colors ${checked
                    ? "border-lime bg-lime text-lime-foreground"
                    : editorial
                        ? "border-charcoal/20 bg-secondary text-charcoal hover:border-lime"
                        : "border-charcoal-foreground/20 bg-charcoal-foreground/5 text-charcoal-foreground hover:border-lime"}`}>
              <Checkbox checked={checked} onCheckedChange={() => onToggle(option)} aria-label={`${label}: ${formatOption(option)}`}/>
              <span>{formatOption(option)}</span>
            </label>);
        })}
      </div>
      <p className={`mt-1.5 text-[11px] font-semibold ${editorial ? "text-muted-foreground" : "text-charcoal-foreground/60"}`}>
        {selected.size ? `${selected.size} selected` : "Any accepted"}
      </p>
    </fieldset>);
}
function CorporateHub() {
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
    const invalidateAll = () => Promise.all([
        queryClient.invalidateQueries({ queryKey: ["students"] }),
        queryClient.invalidateQueries({ queryKey: ["provider-dashboard"] }),
    ]);
    const requestMutation = useMutation({
        mutationFn: (studentId: string) => requestMatchFn({ data: { studentId } }),
        onSuccess: async () => {
            await invalidateAll();
            toast.success("Handshake pending", {
                description: "The request is available through the student’s private invite. 1 provider credit used.",
            });
        },
        onError: (error) => {
            toast.error("Match request failed", { description: error.message });
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
        setSelectedDisciplines(fund.discipline && fund.discipline !== "All Disciplines" ? new Set([fund.discipline]) : new Set());
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
    return (<div className={"bg-background"}>
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <section className={`border p-5 sm:px-8 sm:py-6 ${"rounded-lg border-charcoal/20 bg-card text-charcoal shadow-sm"}`}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-black sm:text-3xl">
              {"🏆 Scholarship Provider"}
            </h1>
            {dashboard?.organisationName && (<p className={`mt-1 text-sm font-bold ${"text-muted-foreground"}`}>
                {dashboard.organisationName}
                {dashboard.contactPerson ? ` · ${dashboard.contactPerson}` : ""}
              </p>)}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Button onClick={() => setCreateOpen(true)} variant={"default"} className={"bg-charcoal font-black text-charcoal-foreground hover:bg-charcoal/90"}>
            {"Configure New Scholarship Fund"}
          </Button>
          </div>
        </div>

      </section>

      <section aria-labelledby="pipeline-signals-title" className={`border-y py-6 ${"border-charcoal/20"}`}>
          <h2 id="pipeline-signals-title" className={`text-sm font-bold sm:text-base ${"text-charcoal"}`}>
            {"📊 Finalist Signals — Auditable impact metrics across your active candidates."}
          </h2>
          <dl className={`mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border sm:grid-cols-4 ${"border-charcoal/20 bg-charcoal/20"}`}>
            {([
            [String(students.length), "Eligible Profiles"],
            [String(ranked.length), "IRTO Finalists"],
            [String(matches.length), "Match Requests"],
            [String(matches.filter((m) => m.status === "accepted").length), "Accepted Unlocks"],
        ]).map(([value, label]) => (<div key={label} className={"bg-background px-4 py-6"}>
                <dt className={`text-xs font-medium ${"text-muted-foreground"}`}>{label}</dt>
                <dd className={`mt-2 font-display text-3xl font-black ${"text-charcoal"}`}>{value}</dd>
              </div>))}
          </dl>
      </section>

      {true && (<section aria-labelledby="my-funds-title" className="rounded-lg border border-charcoal/20 bg-card p-5 text-charcoal shadow-sm sm:px-8 sm:py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="my-funds-title" className="text-lg font-black sm:text-xl">💰 My Funds</h2>
            <span className="text-xs font-semibold text-muted-foreground">
              {funds.length ? `${funds.length} published` : "No funds published yet"}
            </span>
          </div>
          {funds.length === 0 ? (<p className="mt-3 text-sm text-muted-foreground">
              Publish your first scholarship fund with “Configure New Scholarship Fund” — it will
              appear here and can drive the discovery feed filters.
            </p>) : (<ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {funds.map((fund) => {
                    const active = activeFundId === fund.id;
                    return (<li key={fund.id} className={`rounded-xl border p-4 transition ${active ? "border-lime bg-lime/10 ring-2 ring-lime/50" : "border-charcoal/15 bg-secondary/50"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-charcoal">{fund.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {[fund.orgClass, fund.location, fund.stipendAud != null ? `$${fund.stipendAud.toLocaleString()} AUD` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <Button size="sm" onClick={() => applyFund(fund)} className={active
                            ? "bg-charcoal text-charcoal-foreground hover:bg-charcoal/90"
                            : "bg-lime font-black text-lime-foreground hover:bg-lime/90"}>
                        {active ? "Clear filters" : "Drive feed"}
                      </Button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {fund.discipline !== "All Disciplines" && (<span className="rounded-full bg-charcoal/10 px-2 py-0.5 text-[10px] font-bold text-charcoal">
                          {fund.discipline}
                        </span>)}
                      {fund.lifeLoad.map((tag) => (<span key={tag} className="rounded-full bg-charcoal/10 px-2 py-0.5 text-[10px] font-bold text-charcoal">
                          {tag}
                        </span>))}
                      {fund.finalistRequirements.map((req) => (<span key={req} className="rounded-full bg-lime/25 px-2 py-0.5 text-[10px] font-bold text-charcoal">
                          {req}
                        </span>))}
                    </div>
                  </li>);
                })}
            </ul>)}
        </section>)}

      <div className="grid gap-8 pt-2 lg:grid-cols-4 lg:gap-10">
        {/* Sidebar filters */}
        <aside className={`h-fit rounded-lg border p-6 lg:sticky lg:top-36 ${"border-charcoal/20 bg-card text-charcoal"}`}>
          <h2 className={`text-lg ${"text-charcoal"}`}>⚡ Filter by Grit &amp; Context</h2>
          <p className={`mt-1 text-xs ${"text-muted-foreground"}`}>
            IRTO engine re-ranks the feed on every change.
          </p>

          <div className="mt-5">
            <p className={`eyebrow ${"text-charcoal"}`}>Mandatory Hard Gates</p>
            <div className="mt-3 space-y-3">
              <MultiSelectGate label="Discipline" options={disciplines} selected={selectedDisciplines} onToggle={(value) => toggleSetValue(setSelectedDisciplines, value)} editorial={true}/>
              <GateSelect label="Visa / Citizenship" value={visa} onChange={setVisa} options={visaOptions} editorial={true}/>
              <GateSelect label="Year Level" value={yearLevel} onChange={setYearLevel} options={yearOptions} editorial={true}/>
              <MultiSelectGate label="Study Mode" options={studyModeOptions} selected={selectedStudyModes} onToggle={(value) => toggleSetValue(setSelectedStudyModes, value)} editorial={true}/>
              <MultiSelectGate label="Study Load Focus" options={studyLoadOptions} selected={selectedStudyLoads} onToggle={(value) => toggleSetValue(setSelectedStudyLoads, value)} formatOption={(value) => `${value}%`} editorial={true}/>
            </div>
          </div>

          <div className="mt-6">
            <p className={`eyebrow ${"text-charcoal"}`}>Preferred Life Load Variables</p>
            <div className="mt-3 space-y-2">
              {lifeLoadOptions.map((opt) => (<label key={opt} className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 ${"border border-charcoal/10 bg-secondary"}`}>
                  <input type="checkbox" checked={lifeLoad.has(opt)} onChange={() => toggleLifeLoad(opt)} className="h-4 w-4 accent-lime"/>
                   <span className={`text-xs font-semibold ${"text-charcoal"}`}>{opt}</span>
                </label>))}
            </div>
          </div>

          <div className="mt-6 space-y-5">
            <p className={`eyebrow ${"text-charcoal"}`}>Core Competencies</p>
            <FilterSlider label="Target Adjusted GPA" value={targetGpa} onChange={setTargetGpa} editorial={true}/>
            <FilterSlider label="Client Empathy" value={empathy} onChange={setEmpathy} editorial={true}/>
            <FilterSlider label="Resilience" value={resilience} onChange={setResilience} editorial={true}/>
          </div>
        </aside>

        {/* Candidate feed */}
        <section className="space-y-5 lg:col-span-3">
          <div className="flex flex-wrap items-end justify-between gap-3 pb-2">
            <h2 className={`text-xl font-black sm:text-2xl ${"text-charcoal"}`}>
              {"Scholarship Finalist Discovery"}
            </h2>
            <span className={`flex items-center gap-2 text-xs font-medium ${"text-muted-foreground"}`}>
              <span className="pulse inline-block h-2 w-2 rounded-full bg-lime"/> {ranked.length}{" "}
              matched · ranked by Grit Fit
            </span>
          </div>

          {studentsQuery.isLoading && (<div className="panel-light p-8 text-center">
              <p className="text-sm font-bold text-charcoal">Loading the live candidate registry…</p>
            </div>)}

          {!studentsQuery.isLoading && ranked.length === 0 && (<div className="panel-light p-8 text-center">
              <p className="text-sm font-bold text-charcoal">
                No candidates clear your mandatory hard gates.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Loosen a gate — discipline, visa status, year level, study mode or study load.
              </p>
            </div>)}

          {ranked.map((result) => {
            const c = result.student as CandidateRecord;
            const status = statusOf(c.candidateCode);
            const match = matchFor(c.candidateCode);
            const identity = match?.identity ?? null;
            const revealed = status === "revealed" && identity !== null;
            const unlocked = false;
            return (<article key={c.candidateCode} className={`rounded-lg border p-5 transition duration-500 sm:p-7 ${"border-charcoal/15 bg-card"} ${revealed
                    ? `handshake-flash ring-2 ${"ring-lime"}`
                    : status === "active"
                        ? "ring-2 ring-lime/60"
                        : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className={`font-mono text-base font-black tracking-wider ${"text-charcoal"}`}>
                      {revealed && identity ? `✅ ${identity.legalName}` : c.candidateCode}
                    </p>
                    <p className={`mt-1 text-sm ${"text-muted-foreground"}`}>
                      {c.degree} · {c.year}
                    </p>
                    <p className={`text-xs ${"text-muted-foreground/70"}`}>{c.uni}</p>
                  </div>
                  <div className="flex flex-col items-end text-right">
                    <GritBreakdownPanel result={result} theme={"scholarship"} tone={"light"}/>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {c.traits.map((t) => (<span key={t} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${"bg-secondary text-secondary-foreground"}`}>
                      {t}
                    </span>))}
                  {result.frontlineBoost && (<span className="rounded-full bg-lime/20 px-2.5 py-1 text-xs font-black text-charcoal">
                      ⚡ Frontline pressure boost
                    </span>)}
                </div>

                <blockquote className={`mt-4 rounded-2xl border-l-4 border-lime p-4 ${"bg-secondary/60"}`}>
                  <p className={`text-sm italic ${"text-secondary-foreground"}`}>“{c.endorsement}”</p>
                  <footer className={`mt-2 text-xs font-bold ${"text-muted-foreground"}`}>
                    ✓ Verified — {c.endorser}
                  </footer>
                </blockquote>

                {revealed && identity && (<div className={`mt-4 rounded-2xl border-2 p-4 ${"border-lime bg-lime/10"}`}>
                    <p className={`eyebrow flex items-center gap-2 ${"text-charcoal"}`}>
                      {(<span aria-hidden="true">🔓</span>)}
                      Privacy mask lifted
                    </p>
                    <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                      <div>
                        <dt className={`text-xs font-bold ${"text-charcoal/60"}`}>Legal name</dt>
                        <dd className={`font-black ${"text-charcoal"}`}>{identity.legalName}</dd>
                      </div>
                      <div>
                        <dt className={`text-xs font-bold ${"text-charcoal/60"}`}>Phone</dt>
                        <dd className={`font-semibold ${"text-charcoal"}`}>{identity.phone}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className={`text-xs font-bold ${"text-charcoal/60"}`}>Email</dt>
                        <dd className={`break-all font-semibold ${"text-charcoal"}`}>{identity.email}</dd>
                      </div>
                    </dl>
                    {(<a href={identity.transcriptUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-full bg-charcoal px-4 py-2.5 text-xs font-black text-charcoal-foreground transition hover:brightness-125">
                        📄 View Verified My eQuals Transcript Link
                      </a>)}
                  </div>)}

                <div className="mt-4 flex flex-wrap gap-3">
                  <Button variant="outline" onClick={() => setCaseStudy({
                    code: c.candidateCode,
                    degree: c.degree,
                    year: c.year,
                    grit: result.adjustedGpa,
                    uni: c.uni,
                    endorsement: c.endorsement,
                    endorser: c.endorser,
                    traits: c.traits,
                })} className={`text-xs font-bold ${"border-charcoal/25 text-charcoal hover:bg-charcoal/5"}`}>
                    ⚙️ View Full Anonymous Case Study
                  </Button>
                  <Button onClick={() => requestMatch(c.candidateCode)} disabled={status !== "passive" || requestMutation.isPending} className={`text-xs font-black ${status !== "passive"
                    ?
                        "border-2 border-lime bg-lime/20 text-charcoal"
                    : "bg-lime text-lime-foreground hover:brightness-105"}`}>
                    {revealed
                    ? "🤝 Handshake Complete"
                    : status === "active"
                        ? "🤝 Handshake Pending"
                        : "🪙 REQUEST MATCH & UNLOCK | 1 Credit"}
                  </Button>
                </div>
              </article>);
        })}
        </section>
      </div>

      <CaseStudyDrawer candidate={caseStudy} credits={credits} matched={caseStudy ? statusOf(caseStudy.code) !== "passive" : false} onClose={() => setCaseStudy(null)} onRequestMatch={requestMatch}/>

      <CreateOpportunityModal open={createOpen} onOpenChange={setCreateOpen} onPublish={handlePublish}/>
      </div>
    </div>);
}
