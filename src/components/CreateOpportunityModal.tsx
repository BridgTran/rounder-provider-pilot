import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";
import type { PublishScholarshipInput } from "@/lib/provider.functions";
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
    onPublish?: (input: PublishScholarshipInput) => Promise<void>;
}
export function CreateOpportunityModal({ open, onOpenChange, onPublish, }: CreateOpportunityModalProps) {
    const [title, setTitle] = useState("");
    const [lifeLoad, setLifeLoad] = useState<Set<string>>(new Set());
    const [empathy, setEmpathy] = useState(70);
    const [resilience, setResilience] = useState(75);
    const [discipline, setDiscipline] = useState("All Disciplines");
    const [orgClass, setOrgClass] = useState("");
    const [location, setLocation] = useState("");
    const [stipend, setStipend] = useState("");
    const [requirements, setRequirements] = useState<Set<string>>(new Set());
    const [publishing, setPublishing] = useState(false);
    const toggleLifeLoad = (id: string) => {
        const next = new Set(lifeLoad);
        next.has(id) ? next.delete(id) : next.add(id);
        setLifeLoad(next);
    };
    const toggleRequirement = (id: string) => {
        const next = new Set(requirements);
        next.has(id) ? next.delete(id) : next.add(id);
        setRequirements(next);
    };
    const handlePublish = async () => {
        if (!title.trim()) {
            toast.error("Give your fund a title first.");
            return;
        }
        const input: PublishScholarshipInput = {
            title: title.trim(),
            orgClass: orgClass.trim(),
            location: location.trim(),
            stipendAud: stipend ? Number(stipend) : null,
            finalistRequirements: finalistRequirements
                .filter((r) => requirements.has(r.id))
                .map((r) => r.label),
            lifeLoad: lifeLoadOptions.filter((o) => lifeLoad.has(o.id)).map((o) => o.tag),
            minEmpathy: empathy,
            minResilience: resilience,
            discipline,
        };
        if (onPublish) {
            setPublishing(true);
            try {
                await onPublish(input);
                onOpenChange(false);
                setTitle("");
            }
            catch {
                /* the caller toasts the error */
            }
            finally {
                setPublishing(false);
            }
            return;
        }
        toast.success("Scholarship fund live. Pre-vetted all-rounders instantly mapped to your finalist report.", { duration: 5000 });
        onOpenChange(false);
    };
    return (<Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-charcoal/10 bg-card p-0">
        <DialogHeader className="panel-dark rounded-none rounded-t-lg p-6 text-left">
          <DialogTitle className="text-xl text-charcoal-foreground">
            {"🏆 Configure New Scholarship Fund"}
          </DialogTitle>
          <DialogDescription className="text-charcoal-foreground/70">
            {"Build a context-matched fund that recognises potential relative to opportunity."}
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
                <Input id="fund-title" placeholder="e.g. Regional Engineering Scholarship" value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-xl border-border bg-secondary/40 py-2.5 text-sm font-semibold text-secondary-foreground"/>
              </div>

              <div>
                <p className="eyebrow text-charcoal">Life Load Matrices</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {lifeLoadOptions.map((opt) => (<label key={opt.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-secondary/40 px-3 py-3 hover:border-lime/40">
                      <Checkbox checked={lifeLoad.has(opt.id)} onCheckedChange={() => toggleLifeLoad(opt.id)} id={opt.id}/>
                      <span className="text-xs font-semibold text-secondary-foreground">
                        {opt.label}
                      </span>
                    </label>))}
                </div>
              </div>

              <div className="space-y-5">
                <p className="eyebrow text-charcoal">Required Qualitative Skills</p>
                <RangeSlider label="Client Empathy" value={empathy} onChange={setEmpathy}/>
                <RangeSlider label="Pressure Resilience" value={resilience} onChange={setResilience}/>
              </div>

              <div>
                <p className="eyebrow text-charcoal">Academic Discipline Focus</p>
                <Select value={discipline} onValueChange={setDiscipline}>
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
                  Organization Classification
                </Label>
                <Input id="org-class" placeholder="e.g. Fortune 100 Miner" value={orgClass} onChange={(e) => setOrgClass(e.target.value)} className="rounded-xl border-border bg-secondary/40 py-2.5 text-sm font-semibold text-secondary-foreground"/>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location" className="text-xs font-bold text-charcoal">
                  Location
                </Label>
                <Input id="location" placeholder="e.g. Perth / Pilbara, WA" value={location} onChange={(e) => setLocation(e.target.value)} className="rounded-xl border-border bg-secondary/40 py-2.5 text-sm font-semibold text-secondary-foreground"/>
              </div>

              <div className="space-y-2">
                <Label htmlFor="stipend" className="text-xs font-bold text-charcoal">
                  Funding Stipend Value ($ AUD)
                </Label>
                <Input id="stipend" type="number" placeholder="e.g. 25000" value={stipend} onChange={(e) => setStipend(e.target.value)} className="rounded-xl border-border bg-secondary/40 py-2.5 text-sm font-semibold text-secondary-foreground"/>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-dashed border-lime/40 bg-lime/5 p-4">
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
        </div>

        <div className="sticky bottom-0 border-t border-border bg-card p-6">
          <button onClick={() => void handlePublish()} disabled={publishing} className="w-full rounded-2xl bg-lime px-6 py-4 text-sm font-black text-lime-foreground shadow-lg shadow-lime/25 transition hover:brightness-105 disabled:opacity-50">
            {publishing
            ? "Publishing…"
            :
                "🔥 PUBLISH SCHOLARSHIP FUND"}
          </button>
        </div>
      </DialogContent>
    </Dialog>);
}
