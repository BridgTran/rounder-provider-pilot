import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { Save, Check, Upload, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { eligibleStudents, fundHistory, universityList } from "@/lib/fund.functions";
import { emptyFundRules, fundSaveSchema, attestationText, australianStates, degreeLevels, type FundRules, type FundSaveInput } from "@/lib/fund-schema";
import type { ScholarshipFund } from "@/lib/provider.functions";
import { FundCriterion, FundSelect, fundInputClass } from "./FundCriterion";
const lifeLoadOptions = [
    { id: "high-workload", label: "High External Workload (20+ hrs/week)", tag: "High External Workload 20+ hrs" },
    { id: "caretaker", label: "Primary Caretaker Responsibilities", tag: "Primary Caretaker" },
    { id: "regional", label: "Regional / Remote Context", tag: "Regional/Remote Background" },
];
const disciplines = ["All Disciplines", "Law", "Engineering", "Business", "Medicine", "Arts"];
const finalistRequirements = [
    { id: "written-essay", label: "Written Essay" },
    { id: "video-snippet", label: "90-Second Video Snippet" },
    { id: "reference-check", label: "Reference Check" },
    { id: "work-sample", label: "Work Sample / Portfolio" },
    { id: "interview-panel", label: "Interview Panel" },
];
function RangeSlider({ label, value, onChange, }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
}) {
    return (<div>
      <div className="flex items-center justify-between">
        <Label className="text-xs font-bold text-charcoal">{label}</Label>
        <span className="rounded-full bg-lime px-2 py-0.5 text-xs font-black text-lime-foreground">
          {value}%
        </span>
      </div>
      <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 w-full accent-lime" aria-label={label}/>
    </div>);
}
interface CreateOpportunityModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Persist the fund to the provider's account. */
    fund?: ScholarshipFund | undefined;
    onPublish: (input: FundSaveInput) => Promise<void>;
}
export function CreateOpportunityModal({ open, onOpenChange, onPublish, fund, }: CreateOpportunityModalProps) {
    const [title, setTitle] = useState(fund?.title ?? "");
    const [lifeLoad, setLifeLoad] = useState<Set<string>>(new Set(lifeLoadOptions.filter((o) => fund?.lifeLoad.includes(o.tag)).map((o) => o.id)));
    const [empathy, setEmpathy] = useState(70);
    const [resilience, setResilience] = useState(75);
    const [discipline, setDiscipline] = useState(fund?.discipline ?? "All Disciplines");
    const [orgClass, setOrgClass] = useState(fund?.orgClass ?? "");
    const [rules, setRules] = useState<FundRules>(fund?.rules ?? emptyFundRules());
    const [postcodes, setPostcodes] = useState(rules.postcodes.join(", "));
    const [regions, setRegions] = useState(rules.regions.join(", "));
    const universities = useQuery({ queryKey: ["universities"], queryFn: () => universityList(), enabled: open });
    const [viewVersion, setViewVersion] = useState<string | null>(null);
    const [confirmed, setConfirmed] = useState(false);
    const [deedPath, setDeedPath] = useState<string | null>(fund?.deedPath ?? null);
    const [uploading, setUploading] = useState(false);
    const list = (v: string) => v.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
    const currentRules = { ...rules, postcodes: list(postcodes), regions: list(regions) };
    const selectedLifeLoad = lifeLoadOptions.filter((o) => lifeLoad.has(o.id)).map((o) => o.tag);
    const eligibility = useQuery({ queryKey: ["fund-eligibility", currentRules, discipline, selectedLifeLoad], queryFn: () => eligibleStudents({ data: { rules: currentRules, discipline, lifeLoad: selectedLifeLoad } }), enabled: open && currentRules.postcodes.every((p) => /^\d{4}$/.test(p)) });
    const history = useQuery({ queryKey: ["fund-history", fund?.id], queryFn: () => fundHistory({ data: { id: fund?.id ?? "" } }), enabled: !!fund?.id });
    const updateRule = <K extends keyof FundRules,>(key: K, value: FundRules[K]) => { setRules((r) => ({ ...r, [key]: value })); setConfirmed(false); };
    const clause = (name: string, label: string, children: React.ReactNode, eligibilityRule = true) => <FundCriterion strength={rules.strengths[name] ?? "Required"} onStrength={eligibilityRule ? (v) => updateRule("strengths", { ...rules.strengths, [name]: v }) : undefined} name={name} label={label} clause={rules.clauses[name]} onClause={(v) => updateRule("clauses", { ...rules.clauses, [name]: v })}>{children}</FundCriterion>;
    const options = (values: string[]) => values.map((value) => ({ value, label: value }));
    const uploadDeed = async (file: File) => {
      if (file.size > 10 * 1024 * 1024 || !file.name.toLowerCase().endsWith(".pdf") || file.type !== "application/pdf" || !new TextDecoder().decode(await file.slice(0, 5).arrayBuffer()).startsWith("%PDF-")) { toast.error("Choose a PDF up to 10 MB."); return; }
      setUploading(true);
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) throw new Error("Sign in to upload a deed.");
        const path = `${data.user.id}/${crypto.randomUUID()}.pdf`;
        const result = await supabase.storage.from("trust-deeds").upload(path, file, { contentType: "application/pdf", upsert: false });
        if (result.error) throw result.error;
        setDeedPath(path); setConfirmed(false); toast.success("Private deed uploaded");
      } catch (error) { toast.error(error instanceof Error ? error.message : "Upload failed"); }
      finally { setUploading(false); }
    };
    const [stipend, setStipend] = useState(fund?.maximumAwardValue?.toString() ?? "");
    const [requirements, setRequirements] = useState<Set<string>>(new Set());
    const [publishing, setPublishing] = useState(false);
    const toggleLifeLoad = (id: string) => {
        const next = new Set(lifeLoad);
        next.has(id) ? next.delete(id) : next.add(id);
        setLifeLoad(next);
        setConfirmed(false);
    };
    const toggleRequirement = (id: string) => {
        const next = new Set(requirements);
        next.has(id) ? next.delete(id) : next.add(id);
        setRequirements(next);
    };
    const handlePublish = async (activate: boolean) => {
      const parsed = fundSaveSchema.safeParse({ id: fund?.id, expectedVersion: fund?.version ?? 0, title, orgClass, maximumAwardValue: stipend ? Number(stipend) : null, discipline, lifeLoad: selectedLifeLoad, rules: currentRules, deedPath, activate, confirmed });
      if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Check the fund rules"); return; }
      setPublishing(true);
      try { await onPublish(parsed.data); onOpenChange(false); }
      catch { /* caller displays failure */ }
      finally { setPublishing(false); }
    };
    return (<Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-charcoal/10 bg-card p-0">
        <DialogHeader className="panel-dark rounded-none rounded-t-lg p-6 text-left">
          <DialogTitle className="text-xl text-charcoal-foreground">
            {"🏆 Configure New Scholarship Fund"}
          </DialogTitle>
          <DialogDescription className="text-charcoal-foreground/70">
            {"Build a fund matched on structured eligibility criteria."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-8 p-6">
          {/* Step 1 */}
          <section>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-charcoal text-xs font-black text-charcoal-foreground">
                1
              </span>
              <h3 className="text-lg">Define Your Target Profile</h3>
            </div>

            <div className="mt-5 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="fund-title" className="text-xs font-bold text-charcoal">
                  {"Fund Title"}
                </Label>
                <Input id="fund-title" placeholder="e.g. Regional Engineering Scholarship" value={title} onChange={(e) => { setTitle(e.target.value); setConfirmed(false); }} className="rounded-xl border-border bg-secondary/40 py-2.5 text-sm font-semibold text-secondary-foreground"/>
              </div>

              <div>
                <div className="grid items-center gap-3 sm:grid-cols-2"><p className="eyebrow text-charcoal">Life Load Matrices</p><Input aria-label="Life Load deed clause reference" placeholder="Deed clause reference (optional)" value={rules.clauses['lifeLoad'] ?? ""} onChange={(e) => updateRule("clauses", { ...rules.clauses, lifeLoad: e.target.value })} className={fundInputClass} /></div>
                <div className="mt-3"><FundSelect id="lifeLoad-strength" label="Life Load strength" value={rules.strengths["lifeLoad"] ?? "Required"} onChange={(v) => updateRule("strengths", { ...rules.strengths, lifeLoad: v as "Required" | "Preferred" })} options={[{value:"Required",label:"Required"},{value:"Preferred",label:"Preferred"}]} /></div><div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {lifeLoadOptions.map((opt) => (<label key={opt.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-secondary/40 px-3 py-3 hover:border-lime/40">
                      <Checkbox checked={lifeLoad.has(opt.id)} onCheckedChange={() => toggleLifeLoad(opt.id)} id={opt.id}/>
                      <span className="text-xs font-semibold text-secondary-foreground">
                        {opt.label}
                      </span>
                    </label>))}
                </div>
              </div>

              {/* Vector B, deferred until post-pilot: the Required Qualitative Skills sliders are
                  hidden and excluded from validation, fund creation and matching/eligibility logic.
                  Pilot matching uses structured eligibility criteria only. Do not delete. */}
              <div hidden className="space-y-5">
                <p className="eyebrow text-charcoal">Required Qualitative Skills</p>
                <RangeSlider label="Client Empathy" value={empathy} onChange={setEmpathy}/>
                <RangeSlider label="Pressure Resilience" value={resilience} onChange={setResilience}/>
              </div>

              <div>
                <div className="grid items-center gap-3 sm:grid-cols-2"><p className="eyebrow text-charcoal">Academic Discipline Focus</p><Input aria-label="Discipline deed clause reference" placeholder="Deed clause reference (optional)" value={rules.clauses['discipline'] ?? ""} onChange={(e) => updateRule("clauses", { ...rules.clauses, discipline: e.target.value })} className={fundInputClass} /></div>
                <div className="mt-3"><FundSelect id="discipline-strength" label="Discipline strength" value={rules.strengths["discipline"] ?? "Required"} onChange={(v) => updateRule("strengths", { ...rules.strengths, discipline: v as "Required" | "Preferred" })} options={[{value:"Required",label:"Required"},{value:"Preferred",label:"Preferred"}]} /></div><Select value={discipline} onValueChange={(v) => { setDiscipline(v); setConfirmed(false); }}>
                  <SelectTrigger className="mt-3 w-full rounded-xl border-border bg-secondary/40 py-2.5 text-sm font-semibold text-secondary-foreground">
                    <SelectValue placeholder="Select discipline"/>
                  </SelectTrigger>
                  <SelectContent>
                    {disciplines.map((d) => (<SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Step 2 */}
          <section>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-charcoal text-xs font-black text-charcoal-foreground">
                2
              </span>
              <h3 className="text-lg">Define the Financial Incentive</h3>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="org-class" className="text-xs font-bold text-charcoal">
                  Organisation Classification
                </Label>
                <FundSelect id="org-class" label="Organisation Classification" value={orgClass || "unset"} onChange={(v) => { setOrgClass(v === "unset" ? "" : v); setConfirmed(false); }} options={[{value:"unset",label:"Select classification"}, ...options(["Charitable foundation", "Private trust", "Corporate CSR", "Other"])]} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="stipend" className="text-xs font-bold text-charcoal">
                  Maximum award value ($ AUD)
                </Label>
                <Input aria-label="Maximum award value deed clause reference" placeholder="Deed clause reference (optional)" value={rules.clauses['maximumAwardValue'] ?? ""} onChange={(e) => updateRule("clauses", { ...rules.clauses, maximumAwardValue: e.target.value })} className={fundInputClass} />
                <Input id="stipend" type="number" placeholder="e.g. 25000" value={stipend} onChange={(e) => { setStipend(e.target.value); setConfirmed(false); }} className="rounded-xl border-border bg-secondary/40 py-2.5 text-sm font-semibold text-secondary-foreground"/>
              </div>
            </div>

            <div hidden className="mt-6 rounded-2xl border border-dashed border-lime/40 bg-lime/5 p-4">
              <p className="text-sm font-bold text-charcoal">Hidden Finalist Requirements</p>
              <p className="text-xs text-muted-foreground">
                Toggle the screening layers finalists must complete.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {finalistRequirements.map((req) => (<div key={req.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5">
                    <Label htmlFor={req.id} className="cursor-pointer text-xs font-semibold text-secondary-foreground">
                      {req.label}
                    </Label>
                    <Switch id={req.id} checked={requirements.has(req.id)} onCheckedChange={() => toggleRequirement(req.id)} aria-label={req.label}/>
                  </div>))}
              </div>
            </div>
          </section>
          <section>
            <div className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-charcoal text-xs font-black text-charcoal-foreground">3</span><h3 className="text-lg">Eligibility &amp; Trust Deed</h3></div>
            <div className="mt-5 space-y-5">
              {clause("gender", "Gender", <FundSelect id="gender" label="Gender" value={rules.gender} onChange={(v) => updateRule("gender", v as FundRules["gender"])} options={options(["any", "female", "male", "non-binary"])} />)}
              {clause("degreeLevel", "Degree level", <FundSelect id="degreeLevel" label="Degree level" value={rules.degreeLevel} onChange={(v) => updateRule("degreeLevel", v as FundRules["degreeLevel"])} options={options(["any", ...degreeLevels])} />)}
              {clause("firstUndergraduateDegree", "First undergraduate degree", <FundSelect id="firstUndergraduateDegree" label="First undergraduate degree" value={rules.firstUndergraduateDegree} onChange={(v) => updateRule("firstUndergraduateDegree", v as "any"|"yes"|"no")} options={options(["any","yes","no"])} />)}
              {clause("yearsCompleted", "Minimum years of study completed", <Input id="yearsCompleted" type="number" min="0" max="20" step="0.5" value={rules.yearsCompleted ?? ""} onChange={(e) => updateRule("yearsCompleted", e.target.value ? Number(e.target.value) : null)} className={fundInputClass} />)}
              {clause("minimumAcademicAverage", "Minimum academic average (%)", <Input id="minimumAcademicAverage" type="number" min="0" max="100" step="0.1" value={rules.minimumAcademicAverage ?? ""} onChange={(e) => updateRule("minimumAcademicAverage", e.target.value ? Number(e.target.value) : null)} className={fundInputClass} />)}
              {clause("studyMode", "Study mode", <FundSelect id="studyMode" label="Study mode" value={rules.studyMode} onChange={(v) => updateRule("studyMode", v as FundRules["studyMode"])} options={options(["any","on-campus","online"])} />)}
              {clause("campusStates", "Campus state", <div id="campusStates" className="grid grid-cols-4 gap-2">{australianStates.map((state) => <label key={state} className="flex items-center gap-2 text-xs"><Checkbox aria-label={`Campus ${state}`} checked={rules.campusStates.includes(state)} onCheckedChange={() => updateRule("campusStates", rules.campusStates.includes(state) ? rules.campusStates.filter((x) => x !== state) : [...rules.campusStates,state])} />{state}</label>)}</div>)}
              {clause("state", "State", <FundSelect id="state" label="State" value={rules.state} onChange={(v) => updateRule("state", v as FundRules["state"])} options={[{value:"any",label:"Any state"}, ...options(["ACT","NSW","NT","QLD","SA","TAS","VIC","WA"])]} />)}
              {clause("postcodes", "Allowed postcodes", <Input id="postcodes" placeholder="e.g. 2000, 2150" value={postcodes} onChange={(e) => { setPostcodes(e.target.value); setConfirmed(false); }} className={fundInputClass} />)}
              {clause("regions", "Allowed regions", <Input id="regions" placeholder="e.g. Pilbara, Hunter" value={regions} onChange={(e) => { setRegions(e.target.value); setConfirmed(false); }} className={fundInputClass} />)}
              {clause("studyLoad", "Study load", <FundSelect id="studyLoad" label="Study load" value={rules.studyLoad} onChange={(v) => updateRule("studyLoad", v as FundRules["studyLoad"])} options={[{value:"any",label:"Any"},{value:"full-time",label:"Full-time"},{value:"part-time",label:"Part-time"}]} />)}
              {clause("maxHouseholdIncome", "Max household income band", <FundSelect id="maxHouseholdIncome" label="Max household income band" value={rules.maxHouseholdIncome?.toString() ?? "any"} onChange={(v) => updateRule("maxHouseholdIncome", v === "any" ? null : Number(v))} options={[{value:"any",label:"Any income"}, ...[30000,50000,75000,100000,150000].map((v) => ({value:String(v),label:`Up to $${v.toLocaleString()} / year`}))]} />)}
              {clause("institutions", "Institutions", <div id="institutions" className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-border p-3">{universities.data?.map((name) => <label key={name} className="flex items-start gap-2 text-xs"><Checkbox aria-label={name} checked={rules.institutions.includes(name)} onCheckedChange={() => updateRule("institutions", rules.institutions.includes(name) ? rules.institutions.filter((x) => x !== name) : [...rules.institutions, name])} />{name}</label>)}</div>)}
              {clause("yearLevels", "Year level", <div id="yearLevels" className="flex flex-wrap gap-3">{[1,2,3,4,5,6].map((v) => <label key={v} className="flex items-center gap-1.5 text-xs"><Checkbox aria-label={`Year ${v}`} checked={rules.yearLevels.includes(v)} onCheckedChange={() => updateRule("yearLevels", rules.yearLevels.includes(v) ? rules.yearLevels.filter((x) => x !== v) : [...rules.yearLevels,v])} />Year {v}</label>)}</div>)}
              {clause("residencies", "Citizenship / residency", <div id="residencies" className="space-y-2">{["Citizen","Permanent Resident","Student Visa 500"].map((v) => <label key={v} className="flex items-center gap-2 text-xs"><Checkbox aria-label={v} checked={rules.residencies.includes(v as FundRules["residencies"][number])} onCheckedChange={() => updateRule("residencies", rules.residencies.includes(v as FundRules["residencies"][number]) ? rules.residencies.filter((x) => x !== v) : [...rules.residencies,v as FundRules["residencies"][number]])} />{v}</label>)}</div>)}
              {([ ["firstGeneration", "First-generation"], ["centrelink", "Centrelink concession"] ] as const).map(([key,label]) => <div key={key}>{clause(key, label, <FundSelect id={key} label={label} value={rules[key]} onChange={(v) => updateRule(key, v as "yes"|"no"|"any")} options={[{value:"any",label:"Any"},{value:"yes",label:"Yes"},{value:"no",label:"No"}]} />)}</div>)}
              {clause("numberOfAwards", "Number of awards", <Input id="numberOfAwards" type="number" min="1" value={rules.numberOfAwards ?? ""} onChange={(e) => updateRule("numberOfAwards", e.target.value ? Number(e.target.value) : null)} className={fundInputClass} />, false)}
              {clause("closeDate", "Application close date", <Input id="closeDate" type="date" value={rules.closeDate} onChange={(e) => updateRule("closeDate", e.target.value)} className={fundInputClass} />, false)}
              <div className="space-y-2"><Label htmlFor="deed">Private trust deed PDF (optional)</Label><Input id="deed" type="file" accept="application/pdf,.pdf" disabled={uploading || publishing} onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadDeed(file); }} className="min-w-0 text-xs" />{deedPath && <div className="flex items-center gap-2 text-xs text-muted-foreground"><FileText className="h-4 w-4" />Private deed attached<Button size="sm" variant="ghost" onClick={() => void supabase.storage.from("trust-deeds").createSignedUrl(deedPath, 60).then(({data,error}) => { if(error) toast.error(error.message); else if(data) window.open(data.signedUrl,"_blank","noopener,noreferrer"); })}>View PDF</Button></div>}{uploading && <p role="status" className="text-xs text-muted-foreground"><Upload className="inline h-4 w-4" /> Uploading…</p>}</div>
              {fund && <div><h4 className="text-sm font-bold">Rule history</h4><ul className="mt-2 space-y-2 text-xs text-muted-foreground">{history.data?.map((h) => <li key={h.id}>Version {h.version} · Read-only<Button variant="ghost" size="sm" onClick={() => setViewVersion(viewVersion === h.id ? null : h.id)}>View version {h.version}</Button>{viewVersion === h.id && <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded border border-border p-3">{JSON.stringify(h.snapshot,null,2)}</pre>} · {new Date(h.created_at).toLocaleString()}</li>)}</ul></div>}
            </div>
          </section>
        </div>

        <div className="sticky bottom-0 border-t border-border bg-card p-6">
          <p role="status" aria-live="polite" className="mb-3 text-sm font-bold text-charcoal">{!currentRules.postcodes.every((p) => /^\d{4}$/.test(p)) ? "Enter four-digit postcodes" : eligibility.isError ? "Eligibility count unavailable" : eligibility.isFetching ? "Checking eligibility…" : `${eligibility.data?.length ?? 0} currently eligible student${eligibility.data?.length === 1 ? "" : "s"}`}</p>
          <p className="mb-3 text-xs text-muted-foreground">Missing details do not satisfy Required rules. Blank lists accept any.</p>
          <label className="mb-4 flex items-start gap-3 text-xs font-semibold text-charcoal"><Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} aria-label={attestationText(title)} /><span>{attestationText(title)}</span></label>
          <div className="grid grid-cols-2 gap-3"><Button variant="outline" onClick={() => void handlePublish(false)} disabled={publishing || uploading || (!!fund && !confirmed)}><Save />{publishing ? "Saving…" : fund?.status === "active" ? "Save changes" : "Save draft"}</Button><Button onClick={() => void handlePublish(true)} disabled={publishing || uploading || !confirmed} className="bg-lime font-black text-lime-foreground hover:bg-lime/90"><Check />Activate fund</Button></div>
        </div>
      </DialogContent>
    </Dialog>);
}
