import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { studentInviteAction } from "@/lib/invite.functions";
import { collectEquityContext, intakeSchema } from "@/lib/invite-schema";
import { australianStates, studentLevels, disciplines } from "@/lib/fund-schema";
import { australianUniversities } from "@/lib/universities";

const inviteOptions = (token: string) => queryOptions({ queryKey: ["student-invite", token], queryFn: () => studentInviteAction({ data: { token, action: "read" } }), retry: false });
export const Route = createFileRoute("/invite/$token")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(inviteOptions(params.token)),
  head: () => ({ meta: [
    { title: "Private Student Invitation — ROUNDER HQ" }, { name: "description", content: "Private scholarship consent, intake and contact permissions." },
    { property: "og:title", content: "Private Student Invitation — ROUNDER HQ" }, { property: "og:description", content: "Manage your scholarship consent and contact permissions." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" },
  ], links: [], }),
  errorComponent: () => <div className="mx-auto max-w-xl px-4 py-12"><h1 className="text-2xl">Invitation unavailable</h1><p className="mt-4 text-muted-foreground">This link is invalid, expired, or its data has been deleted. Ask your scholarship provider for a new invitation.</p></div>,
  component: StudentInvitation,
});

const selections = [
  ["discipline", "Discipline", disciplines],
  ["workSector", "Work sector", ["Other", "Hospitality", "Retail", "Hospital / Clinical Care", "Administration", "Tutoring", "Trades"]],
  ["visaStatus", "Citizenship / visa", ["Citizen", "Permanent Resident", "Student Visa 500"]],
  ["yearLevel", "Year level", ["1", "2", "3", "4", "5", "6"]],
  ["studyMode", "Study mode", ["Internal", "Online", "Hybrid"]],
  ["studyLoad", "Study load (%)", ["100", "75", "50", "25"]],
  ["gender", "Gender", ["", "female", "male", "non-binary"]],
  ["degreeLevel", "Level you are enrolled in this year", ["", ...studentLevels]],
  ["firstUndergraduateDegree", "Was this your first undergraduate degree?", ["", "yes", "no"]],
  ["intendsFurtherStudy", "Do you intend to continue to further study?", ["", "yes", "no"]],
  ["communityContribution", "Have you made a significant contribution to your community?", ["", "yes", "no"]],
  ["campusState", "Campus state (optional)", ["", ...australianStates]],
  ["institution", "University", ["", ...australianUniversities]],
  ["state", "Home state (optional)", ["", ...australianStates]],
  ["firstGeneration", "First-generation (optional)", ["", "yes", "no"]],
  ["centrelink", "Centrelink concession (optional)", ["", "yes", "no"]],
] as const;
const requiredSelections = new Set<string>(["gender", "degreeLevel", "institution", "firstUndergraduateDegree", "intendsFurtherStudy", "communityContribution"]);
const equitySelections = new Set<string>(["workSector", "firstGeneration", "centrelink"]);
const equity = ["High External Workload 20+ hrs", "Primary Caretaker", "First-Gen Student", "Regional/Remote Background", "Low-SES Postcode"];

function StudentInvitation() {
  const { token } = Route.useParams();
  const { data } = useSuspenseQuery(inviteOptions(token));
  const client = useQueryClient();
  const [consent, setConsent] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [formError, setFormError] = useState("");
  const action = useMutation({
    mutationFn: (input: Parameters<typeof studentInviteAction>[0]["data"]) => studentInviteAction({ data: input }),
    onSuccess: (state) => {
      if (state.deleted) { setDeleted(true); client.setQueryData(["student-invite", token], state); }
      else client.setQueryData(["student-invite", token], state);
    }, onError: (error) => toast.error(error.message),
  });
  if (deleted) return <div className="mx-auto max-w-xl px-4 py-12"><h1 className="text-2xl">Your data has been deleted</h1><p className="mt-4 text-muted-foreground">Your profile, contact details and applications have been removed. This invitation is no longer active.</p></div>;

  return <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
    <p className="eyebrow text-muted-foreground">Private scholarship invitation</p>
    <h1 className="mt-3 text-3xl">{!data.consented ? "Your consent" : !data.submitted ? "Student intake" : "Your applications"}</h1>
    {!data.consented ? <section className="mt-6 space-y-5">
      <p className="text-muted-foreground">Your academic answers will be stored for scholarship matching. Signed-in scholarship providers can view your anonymous profile (no name, email or phone). If a provider shortlists you, Rounder will invite you to apply. Nothing identifying is shared until you accept, Rounder has checked your paperwork, and the package is released to that provider.</p>
      <p className="text-muted-foreground">You can decline any application or delete your data here. Keep this private link safe: anyone with it can manage your consent and applications. It expires after 30 days. Deletion cannot remove copies already shared with a provider.</p>
      <label className="flex items-start gap-3"><Checkbox checked={consent} onCheckedChange={(checked) => setConsent(checked === true)} aria-label="I consent to scholarship matching" /><span>I consent to storing my answers for anonymous scholarship matching and understand that contact sharing requires my separate approval.</span></label>
      <Button disabled={!consent || action.isPending} onClick={() => action.mutate({ token, action: "consent" })}>Consent and continue</Button>
    </section> : !data.submitted ? <form className="mt-8 space-y-5" onSubmit={(event) => {
      event.preventDefault();
      const fields = new FormData(event.currentTarget);
      const payload = Object.fromEntries(fields);
      const parsed = intakeSchema.safeParse({ ...payload, firstDegreeCompletionYear: fields.get("firstDegreeCompletionYear") ? Number(fields.get("firstDegreeCompletionYear")) : undefined, yearsCompleted: fields.get("yearsCompleted") ? Number(fields.get("yearsCompleted")) : null, householdIncome: fields.get("householdIncome") ? Number(fields.get("householdIncome")) : null, rawGpa: Number(fields.get("rawGpa")), weeklyHours: collectEquityContext ? Number(fields.get("weeklyHours")) : 0, yearLevel: Number(fields.get("yearLevel")), studyLoad: Number(fields.get("studyLoad")), birthYear: Number(fields.get("birthYear")), equityTags: fields.getAll("equityTags") });
      if (!parsed.success) { setFormError(parsed.error.issues[0]?.message ?? "Check your answers."); return; }
      setFormError(""); action.mutate({ token, action: "intake", payload: parsed.data });
    }}>
      <div className="grid gap-5 sm:grid-cols-2">{[["legalName", "Full name", "text"], ["email", "Email", "email"], ["phone", "Phone (optional)", "tel"], ["degree", "Degree title", "text"], ["rawGpa", "GPA / marks out of 100", "number"], ["weeklyHours", "Weekly work and caring hours", "number"], ["birthYear", "Birth year", "number"], ["firstDegreeCompletionYear", "Year you completed the final year of your first undergraduate degree", "number"]].filter(([name]) => collectEquityContext || name !== "weeklyHours").map(([name, label, type]) => <div key={name} className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} required={name !== "phone"} min={name === "birthYear" ? 1900 : name === "firstDegreeCompletionYear" ? 1990 : 0} max={name === "firstDegreeCompletionYear" ? new Date().getUTCFullYear() + 1 : name === "birthYear" ? new Date().getFullYear() : name === "rawGpa" ? 100 : name === "weeklyHours" ? 168 : undefined} step={name === "rawGpa" ? "0.1" : "1"} /></div>)}</div>
      <div className="grid gap-5 sm:grid-cols-2">{selections.filter(([name]) => collectEquityContext || !equitySelections.has(name)).map(([name, label, options]) => <div key={name} className="space-y-2"><Label htmlFor={name}>{label}</Label><select id={name} name={name} required={requiredSelections.has(name)} defaultValue={requiredSelections.has(name) ? "" : undefined} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{options.map((option) => <option key={option} value={option}>{option || "Select an answer"}</option>)}</select></div>)}</div>
      <div className="grid gap-5 sm:grid-cols-2">{[["yearsCompleted","Years of study completed","number"],["householdIncome","Annual household income ($ AUD)","number"],["postcode","Home postcode","text"],["region","Home region","text"]].filter(([name]) => collectEquityContext || name === "yearsCompleted").map(([name,label,type]) => <div key={name} className="space-y-2"><Label htmlFor={name}>{label} (optional)</Label><Input id={name} name={name} type={type} min="0" step={name === "yearsCompleted" ? "0.5" : "1"} /></div>)}</div>
      {collectEquityContext && <fieldset className="space-y-3"><legend className="mb-3 font-medium">Life context (optional)</legend>{equity.map((tag) => <label key={tag} className="flex items-start gap-3 text-sm"><input type="checkbox" name="equityTags" value={tag} className="mt-1 accent-lime" />{tag}</label>)}</fieldset>}
      {formError && <p role="alert" className="text-destructive">{formError}</p>}
      <Button type="submit" disabled={action.isPending}>{action.isPending ? "Saving…" : "Submit intake"}</Button>
    </form> : <section className="mt-8 space-y-5">
      <p className="text-muted-foreground">Your anonymous profile is available for scholarship matching. Contact details are shared only after your consent and Rounder’s review and release.</p>
      <Button variant="outline" disabled={action.isPending} onClick={() => action.mutate({ token, action: "read" })}>Refresh applications</Button>
      {data.requests.length === 0 && <p className="border-t border-border pt-5 text-muted-foreground">No applications yet.</p>}
      {data.requests.map((request) => <article key={request.id} className="rounded-lg border border-border p-5"><h2 className="text-lg">{request.fundTitle ?? request.organisation}</h2><p className="mt-2 text-sm capitalize text-muted-foreground">{request.stage}</p>
        {request.stage === "invited" ? <div className="mt-4 space-y-4"><p className="text-sm text-muted-foreground">By accepting, you agree that Rounder may check your paperwork and pass your application, including your name and contact details, to the provider.</p><div className="flex flex-wrap gap-3"><Button disabled={action.isPending} onClick={() => action.mutate({ token, action: "respond", payload: { matchId: request.id, decision: "accept" } })}>Accept and apply</Button><Button variant="outline" disabled={action.isPending} onClick={() => action.mutate({ token, action: "respond", payload: { matchId: request.id, decision: "decline" } })}>Decline</Button></div></div> : request.stage === "released" ? <div className="mt-4 space-y-2 text-sm"><p>{request.organisation}</p><p>{request.contactPerson}</p><p className="break-all">{request.email}</p><p className="text-muted-foreground">Your application package, including your name and contact details, has been shared with this provider.</p></div> : <p className="mt-3 text-sm text-muted-foreground">{{ accepted: "Thanks. Rounder will contact you with the paperwork list and check it before anything is sent.", submitted: "Rounder is checking your paperwork.", returned: "Rounder has asked for changes to your paperwork.", checked: "Your application has been checked and will be passed to the provider.", declined: "You declined. Your details were not shared." }[request.stage]}</p>}
      </article>)}
    </section>}
    <section className="mt-12 border-t border-border pt-6"><h2 className="text-lg">Delete my data</h2>{confirmDelete ? <div className="mt-4 space-y-4"><p className="text-sm text-muted-foreground">Permanently remove your profile, contact details and all applications?</p><div className="flex gap-3"><Button variant="destructive" disabled={action.isPending} onClick={() => action.mutate({ token, action: "delete" })}>Confirm deletion</Button><Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button></div></div> : <Button variant="outline" className="mt-4" onClick={() => setConfirmDelete(true)}>Delete my data</Button>}</section>
  </div>;
}