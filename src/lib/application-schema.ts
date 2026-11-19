import { z } from "zod";

export const applicationStageSchema = z.enum(["shortlisted", "invited", "accepted", "declined", "submitted", "returned", "checked", "released"]);
export type ApplicationStage = z.infer<typeof applicationStageSchema>;
export const adminInviteCountSchema = z.object({ count: z.number().int().min(1).max(200) });
export const advanceApplicationSchema = z.object({ matchId: z.string().uuid(), to: z.enum(["invited", "submitted", "returned", "checked", "released"]) });
export const isReleasedApplication = (stage: ApplicationStage) => stage === "released";
export const applicationStageLabels: Record<ApplicationStage, string> = {
  shortlisted: "Shortlisted, Rounder will contact the student",
  invited: "Student invited",
  accepted: "Student accepted, collecting paperwork",
  submitted: "Paperwork with Rounder for checking",
  returned: "Returned to student for changes",
  checked: "Checked, release pending",
  released: "Package released",
  declined: "Student declined",
};
export const applicationCounts = (matches: readonly { stage: ApplicationStage }[]) => ({
  shortlisted: matches.length,
  released: matches.filter((match) => isReleasedApplication(match.stage)).length,
});