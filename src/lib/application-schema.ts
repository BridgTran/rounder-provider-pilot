import { z } from "zod";

export const applicationStageSchema = z.enum(["shortlisted", "invited", "accepted", "declined", "submitted", "returned", "checked", "released"]);
export type ApplicationStage = z.infer<typeof applicationStageSchema>;
export const adminInviteCountSchema = z.object({ count: z.number().int().min(1).max(200) });
export const advanceApplicationSchema = z.object({ matchId: z.string().uuid(), to: z.enum(["invited", "submitted", "returned", "checked", "released"]) });
export const isReleasedApplication = (stage: ApplicationStage) => stage === "released";