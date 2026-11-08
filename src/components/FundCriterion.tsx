import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const fundInputClass = "rounded-xl border-border bg-secondary/40 py-2.5 text-sm font-semibold text-secondary-foreground";
export function FundCriterion({ name, label, clause, onClause, children }: { name: string; label: string; clause?: string | undefined; onClause: (v: string) => void; children: ReactNode }) {
  return <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)]">
    <div className="min-w-0 space-y-2"><Label htmlFor={name} className="text-xs font-bold text-charcoal">{label}</Label>{children}</div>
    <div className="min-w-0 space-y-2"><Label htmlFor={`${name}-clause`} className="text-xs text-muted-foreground">Deed clause reference <span className="font-normal">(optional)</span></Label><Input id={`${name}-clause`} aria-label={`${label} deed clause reference`} value={clause ?? ""} onChange={(e) => onClause(e.target.value)} placeholder="e.g. 4.2(a)" className={fundInputClass} /></div>
  </div>;
}
export function FundSelect({ id, label, value, onChange, options }: { id: string; label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger id={id} aria-label={label} className={`w-full ${fundInputClass}`}><SelectValue /></SelectTrigger><SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>;
}