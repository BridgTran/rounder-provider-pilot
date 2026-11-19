import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { studentInviteAction } from "@/lib/invite.functions";
import { intakeSchema } from "@/lib/invite-schema";
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
  ["gender", "Gender (optional)", ["", "female", "male", "non-binary"]],
  ["degreeLevel", "Degree level (optional)", ["", ...studentLevels]],
  ["firstUndergraduateDegree", "First undergraduate degree (optional)", ["", "yes", "no"]],
  ["campusState", "Campus state (optional)", ["", ...australianStates]],
  ["institution", "Institution (optional)", ["", ...australianUniversities]],
  ["state", "Home state (optional)", ["", ...australianStates]],
  ["firstGeneration", "First-generation (optional)", ["", "yes", "no"]],
  ["centrelink", "Centrelink concession (optional)", ["", "yes", "no"]],
] as const;
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
  if (deleted) return <div className="mx-auto max-w-xl px-4 py-12"><h1 className="text-2xl">Your data has been deleted</h1><p className="mt-4 text-muted-foreground">Your profile, contact details and unlock requests have been removed. This invitation is no longer active.</p></div>;

  return <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
    <p className="eyebrow text-muted-foreground">Private scholarship invitation</p>
    <h1 className="mt-3 text-3xl">{!data.consented ? "Your consent" : !data.submitted ? "Student intake" : "Your unlock requests"}</h1>
    {!data.consented ? <section className="mt-6 space-y-5">
      <p className="text-muted-foreground">Your academic and life-context answers will be stored for scholarship matching. Signed-in scholarship providers can view your anonymous profile. Your name, email and phone stay private until you consent and Rounder checks and releases your application.</p>
      <p className="text-muted-foreground">You can decline any request or delete your data here. Keep this private link safe: anyone with it can manage your consent and requests. It expires after 30 days. Deletion cannot remove copies already shared with a provider.</p>
      <label className="flex items-start gap-3"><Checkbox checked={consent} onCheckedChange={(checked) => setConsent(checked === true)} aria-label="I consent to scholarship matching" /><span>I consent to storing my answers for anonymous scholarship matching and understand that contact sharing requires my separate approval.</span></label>
      <Button disabled={!consent || action.isPending} onClick={() => action.mutate({ token, action: "consent" })}>Consent and continue</Button>
    </section> : !data.submitted ? <form className="mt-8 space-y-5" onSubmit={(event) => {
      event.preventDefault();
      const fields = new FormData(event.currentTarget);
      const payload = Object.fromEntries(fields);
      const parsed = intakeSchema.safeParse({ ...payload, yearsCompleted: fields.get("yearsCompleted") ? Number(fields.get("yearsCompleted")) : null, householdIncome: fields.get("householdIncome") ? Number(fields.get("householdIncome")) : null, rawGpa: Number(fields.get("rawGpa")), weeklyHours: Number(fields.get("weeklyHours")), yearLevel: Number(fields.get("yearLevel")), studyLoad: Number(fields.get("studyLoad")), birthYear: Number(fields.get("birthYear")), equityTags: fields.getAll("equityTags") });
      if (!parsed.success) { setFormError(parsed.error.issues[0]?.message ?? "Check your answers."); return; }
      setFormError(""); action.mutate({ token, action: "intake", payload: parsed.data });
    }}>
      <div className="grid gap-5 sm:grid-cols-2">{[["legalName", "Full name", "text"], ["email", "Email", "email"], ["phone", "Phone (optional)", "tel"], ["degree", "Degree title", "text"], ["rawGpa", "GPA / marks out of 100", "number"], ["weeklyHours", "Weekly work and caring hours", "number"], ["birthYear", "Birth year", "number"]].map(([name, label, type]) => <div key={name} className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} required={name !== "phone"} min={name === "birthYear" ? 1900 : 0} max={name === "birthYear" ? new Date().getFullYear() : name === "rawGpa" ? 100 : name === "weeklyHours" ? 168 : undefined} step={name === "rawGpa" ? "0.1" : "1"} /></div>)}</div>
      <div className="grid gap-5 sm:grid-cols-2">{selections.map(([name, label, options]) => <div key={name} className="space-y-2"><Label htmlFor={name}>{label}</Label><select id={name} name={name} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{options.map((option) => <option key={option}>{option}</option>)}</select></div>)}</div>
      <div className="grid gap-5 sm:grid-cols-2">{[["yearsCompleted","Years of study completed","number"],["householdIncome","Annual household income ($ AUD)","number"],["postcode","Home postcode","text"],["region","Home region","text"]].map(([name,label,type]) => <div key={name} className="space-y-2"><Label htmlFor={name}>{label} (optional)</Label><Input id={name} name={name} type={type} min="0" step={name === "yearsCompleted" ? "0.5" : "1"} /></div>)}</div>
      <fieldset className="space-y-3"><legend className="mb-3 font-medium">Life context (optional)</legend>{equity.map((tag) => <label key={tag} className="flex items-start gap-3 text-sm"><input type="checkbox" name="equityTags" value={tag} className="mt-1 accent-lime" />{tag}</label>)}</fieldset>
      {formError && <p role="alert" className="text-destructive">{formError}</p>}
      <Button type="submit" disabled={action.isPending}>{action.isPending ? "Saving…" : "Submit intake"}</Button>
    </form> : <section className="mt-8 space-y-5">
      <p className="text-muted-foreground">Your anonymous profile is available for scholarship matching. Contact details are shared only after your consent and Rounder’s review and release.</p>
      <Button variant="outline" disabled={action.isPending} onClick={() => action.mutate({ token, action: "read" })}>Refresh requests</Button>
      {data.requests.length === 0 && <p className="border-t border-border pt-5 text-muted-foreground">No unlock requests yet.</p>}
      {data.requests.map((request) => <article key={request.id} className="rounded-lg border border-border p-5"><h2 className="text-lg">{request.fundTitle ?? request.organisation}</h2><p className="mt-2 text-sm capitalize text-muted-foreground">{request.stage}</p>
        {request.stage === "invited" ? <div className="mt-4 flex flex-wrap gap-3"><Button disabled={action.isPending} onClick={() => action.mutate({ token, action: "respond", payload: { matchId: request.id, decision: "accept" } })}>Accept and consent to release after review</Button><Button variant="outline" disabled={action.isPending} onClick={() => action.mutate({ token, action: "respond", payload: { matchId: request.id, decision: "decline" } })}>Decline</Button></div> : request.stage === "released" ? <div className="mt-4 text-sm"><p>{request.contactPerson}</p><p className="break-all">{request.email}</p><p className="mt-2 text-muted-foreground">Your name, email and phone are shared with this provider.</p></div> : <p className="mt-3 text-sm text-muted-foreground">{request.stage === "declined" ? "Your contact details were not shared." : "Your contact details remain private until Rounder checks and releases your application."}</p>}
      </article>)}
    </section>}
    <section className="mt-12 border-t border-border pt-6"><h2 className="text-lg">Delete my data</h2>{confirmDelete ? <div className="mt-4 space-y-4"><p className="text-sm text-muted-foreground">Permanently remove your profile, contact details and all unlock requests?</p><div className="flex gap-3"><Button variant="destructive" disabled={action.isPending} onClick={() => action.mutate({ token, action: "delete" })}>Confirm deletion</Button><Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button></div></div> : <Button variant="outline" className="mt-4" onClick={() => setConfirmDelete(true)}>Delete my data</Button>}</section>
  </div>;
}