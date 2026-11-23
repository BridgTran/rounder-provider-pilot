import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Star, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveCandidateNote } from "@/lib/provider-review.functions";

export function ConsiderStar({ considered, disabled, onToggle }: { considered: boolean; disabled: boolean; onToggle: () => void }) {
  return <Button size="icon" variant="outline" disabled={disabled} onClick={onToggle} aria-pressed={considered} aria-label={considered ? "Remove from consider list" : "Add to consider list"} title={considered ? "Remove from consider list" : "Add to consider list"} className={considered ? "border-lime bg-lime/15 text-charcoal" : "text-muted-foreground"}><Star aria-hidden="true" className={considered ? "size-4 fill-current" : "size-4"} /></Button>;
}

export function PrivateCandidateNotes({ fundId, studentId, savedNote }: { fundId: string; studentId: string; savedNote: string }) {
  const [note, setNote] = useState(savedNote);
  const client = useQueryClient();
  const saveNote = useServerFn(saveCandidateNote);
  const save = useMutation({
    mutationFn: () => saveNote({ data: { fundId, studentId, note } }),
    onSuccess: async () => { toast.success("Private notes saved"); await client.invalidateQueries({ queryKey: ["candidate-notes", fundId] }); },
    onError: (error) => toast.error(error.message),
  });
  return <section className="border-t border-border pt-4">
    <Label htmlFor="private-candidate-notes" className="text-lg">Private notes</Label>
    <p id="private-notes-help" className="mt-2 text-xs text-muted-foreground">Only people in your organisation can see this.</p>
    <Textarea id="private-candidate-notes" className="mt-3" rows={4} maxLength={1000} value={note} disabled={save.isPending} onChange={(event) => setNote(event.target.value)} aria-describedby="private-notes-help private-notes-count" />
    <p id="private-notes-count" className="mt-2 text-right text-xs tabular-nums text-muted-foreground" aria-live="polite">{note.length} / 1000</p>
    <Button className="mt-3" disabled={save.isPending || note === savedNote} onClick={() => save.mutate()}><Save className="size-4" aria-hidden="true" />{save.isPending ? "Saving…" : "Save"}</Button>
  </section>;
}