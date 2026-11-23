import { Button } from "@/components/ui/button";
import { applicationStageLabels, isReleasedApplication } from "@/lib/application-schema";
import { fundCandidateRuleResultsFn, type ProviderMatch, type ScholarshipFund } from "@/lib/provider.functions";
import { describeRule } from "@/lib/rule-wording";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, X } from "lucide-react";
import { useEffect, useState } from "react";

export type DrawerCandidate = {
  studentId: string;
  code: string;
  degree: string;
  discipline: string;
  studyLoad: string | number;
  studyMode: string;
  rawGpa: number;
};

const loadLabel = (v: string | number) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return `${n >= 75 ? "Full-time" : "Part-time"} (${n}% load)`;
};
const modeLabel = (v: string) => ({ Internal: "On campus", Online: "Online", Hybrid: "Mixed on campus and online" } as Record<string, string>)[v] ?? v;

const Row = ({ met, children }: { met: boolean; children: React.ReactNode }) => (
  <li className="flex items-start gap-2 text-sm">
    {met ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-lime-700" aria-label="Met" /> : <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-label="Not met" />}
    <span className={met ? "text-foreground" : "text-muted-foreground"}>{children}</span>
  </li>
);

export function CaseStudyDrawer({
  candidate,
  fund,
  canShortlist,
  application,
  onClose,
  onShortlist,
}: {
  candidate: DrawerCandidate | null;
  fund: ScholarshipFund | null;
  canShortlist: boolean;
  application: ProviderMatch | null;
  onClose: () => void;
  onShortlist: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showRequired, setShowRequired] = useState(false);

  useEffect(() => {
    if (candidate) requestAnimationFrame(() => setOpen(true));
    else { setOpen(false); setShowRequired(false); }
  }, [candidate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rulesQuery = useQuery({
    queryKey: ["fund-candidate-rules", fund?.id, fund?.version, candidate?.studentId],
    queryFn: () => fundCandidateRuleResultsFn({ data: { fundId: fund?.id ?? "", studentId: candidate?.studentId ?? "" } }),
    enabled: !!fund && !!candidate,
  });

  if (!candidate) return null;
  const identity = application && isReleasedApplication(application.stage) ? application.identity : null;
  const results = rulesQuery.data ?? [];
  const required = results.filter((r) => !r.preferred);
  const preferred = results.filter((r) => r.preferred);
  const word = (key: string) => (fund ? describeRule(key, fund.rules, fund.discipline) : key);
  const requiredMet = required.filter((r) => r.met).length;
  const completionRule = required.find((r) => r.ruleKey === "completionYear" && r.met);
  const completionYear = completionRule && fund?.rules.completionYear ? String(fund.rules.completionYear) : "Not shared";

  return (
    <div className="fixed inset-0 z-50">
      <div className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
      <aside
        className={`absolute right-0 top-0 flex h-full w-full max-w-xl flex-col overflow-y-auto bg-background shadow-2xl transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
        role="dialog"
        aria-label={`Anonymous application summary for ${candidate.code}`}
      >
        <div className="panel-dark sticky top-0 z-10 flex items-center justify-between gap-3 rounded-none p-5">
          <div>
            <p className="font-mono text-sm font-black tracking-wider text-lime">{candidate.code}</p>
            <p className="mt-1 text-xs text-charcoal-foreground/70">Anonymous application summary{fund ? ` · ${fund.title}` : ""}</p>
          </div>
          <Button onClick={onClose} aria-label="Close summary" className="rounded-full border border-charcoal-foreground/30 px-3 py-1.5 text-xs font-bold text-charcoal-foreground transition hover:bg-charcoal-foreground/10">
            ✕ Close
          </Button>
        </div>

        <div className="space-y-6 p-5 sm:p-6">
          {!fund ? (
            <p className="text-sm text-muted-foreground">Select an active fund to see how this candidate meets its criteria.</p>
          ) : rulesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading criteria…</p>
          ) : rulesQuery.isError ? (
            <p className="text-sm text-destructive">{rulesQuery.error.message}</p>
          ) : (
            <>
              <section>
                <h3 className="text-lg">Required criteria</h3>
                <button type="button" onClick={() => setShowRequired((v) => !v)} aria-expanded={showRequired} className="mt-2 flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 text-left text-sm font-semibold">
                  <span className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-lime-700" />
                    {requiredMet === required.length ? `Meets all ${required.length} required criteria` : `Meets ${requiredMet} of ${required.length} required criteria`}
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${showRequired ? "rotate-180" : ""}`} />
                </button>
                {showRequired && <ul className="mt-2 space-y-1.5 px-3">{required.map((r) => <Row key={r.ruleKey} met={r.met}>{word(r.ruleKey)}</Row>)}</ul>}
              </section>

              <section>
                <h3 className="text-lg">Preferred criteria</h3>
                {preferred.length ? (
                  <>
                    <ul className="mt-2 space-y-1.5">{preferred.map((r) => <Row key={r.ruleKey} met={r.met}>{word(r.ruleKey)}</Row>)}</ul>
                    <p className="mt-2 text-xs font-bold text-muted-foreground">{preferred.filter((r) => r.met).length} of {preferred.length} preferences met</p>
                  </>
                ) : <p className="mt-2 text-sm text-muted-foreground">This fund has no preferred criteria.</p>}
              </section>
            </>
          )}

          <section>
            <h3 className="text-lg">Study profile</h3>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div><dt className="text-xs text-muted-foreground">Degree</dt><dd className="font-semibold">{candidate.degree}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Discipline</dt><dd className="font-semibold">{candidate.discipline}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Study load</dt><dd className="font-semibold">{loadLabel(candidate.studyLoad)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Study mode</dt><dd className="font-semibold">{modeLabel(candidate.studyMode)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Expected completion year</dt><dd className="font-semibold">{completionYear}</dd></div>
            </dl>
          </section>

          <section>
            <h3 className="text-lg">Academic result</h3>
            <p className="mt-2 text-sm"><span className="text-xs text-muted-foreground">GPA / WAM as entered: </span><span className="font-semibold">{candidate.rawGpa}</span></p>
          </section>

          <p className="rounded-xl bg-secondary/60 p-3 text-xs text-secondary-foreground">University, name and contact details are withheld until Rounder releases the checked application.</p>

          {identity && <section className="border-t border-border pt-4"><h3 className="text-lg">Released contact details</h3><dl className="mt-3 space-y-2 text-sm"><div><dt className="text-muted-foreground">Legal name</dt><dd className="break-words">{identity.legalName}</dd></div><div><dt className="text-muted-foreground">Email</dt><dd className="break-all">{identity.email}</dd></div><div><dt className="text-muted-foreground">Phone</dt><dd className="break-words">{identity.phone}</dd></div></dl></section>}
          <Button
            onClick={() => onShortlist(candidate.code)}
            disabled={!!application || !canShortlist}
            className={`h-auto min-h-12 w-full whitespace-normal rounded-full px-4 py-3.5 text-sm font-black transition ${
              application ? "border-2 border-lime bg-lime/20 text-charcoal" : "bg-lime text-lime-foreground hover:brightness-105 disabled:opacity-50"
            }`}
          >
            {application ? applicationStageLabels[application.stage] : "SHORTLIST CANDIDATE"}
          </Button>
        </div>
      </aside>
    </div>
  );
}
