import { describe, expect, it } from "vitest";
import { adminApplicationActions, applicationCounts, applicationStageSchema, adminInviteCountSchema, advanceApplicationSchema, isReleasedApplication, canAdminUnlockIntake } from "./application-schema";

describe("application pipeline", () => {
  it("allows intake override controls on every stage except released", () => {
    expect(applicationStageSchema.options.filter(canAdminUnlockIntake)).toEqual(["shortlisted", "invited", "accepted", "declined", "submitted", "returned", "checked"]);
    expect(canAdminUnlockIntake("released")).toBe(false);
  });
  it("allows shortlisted applications to be marked invited", () => {
    expect(adminApplicationActions.shortlisted.map((action) => action.to)).toEqual(["invited"]);
  });
  it("allows paperwork receipt only for accepted or returned applications", () => {
    expect(applicationStageSchema.options.filter((stage) => adminApplicationActions[stage].some((action) => action.to === "submitted"))).toEqual(["accepted", "returned"]);
  });
  it("allows submitted paperwork to pass checking or be returned", () => {
    expect(adminApplicationActions.submitted.map((action) => action.to)).toEqual(["checked", "returned"]);
  });
  it("offers release only after checking", () => {
    expect(applicationStageSchema.options.filter((stage) => adminApplicationActions[stage].some((action) => action.to === "released"))).toEqual(["checked"]);
  });
  it("offers no admin step for invited, released or declined applications", () => {
    for (const stage of ["invited", "released", "declined"] as const) expect(adminApplicationActions[stage]).toEqual([]);
  });
  it("counts all matches as shortlisted and only released packages as released", () => {
    expect(applicationCounts(applicationStageSchema.options.map((stage) => ({ stage })))).toEqual({ shortlisted: 8, released: 1 });
    expect(applicationCounts([{ stage: "accepted" }, { stage: "checked" }])).toEqual({ shortlisted: 2, released: 0 });
  });
  it("accepts all eight pipeline stages", () => {
    for (const stage of ["shortlisted", "invited", "accepted", "declined", "submitted", "returned", "checked", "released"]) expect(applicationStageSchema.safeParse(stage).success).toBe(true);
    expect(applicationStageSchema.safeParse("pending").success).toBe(false);
  });
  it("shows provider identities only after release", () => {
    for (const stage of applicationStageSchema.options) expect(isReleasedApplication(stage)).toBe(stage === "released");
  });
  it("limits administrator invitation batches to 1–200", () => {
    for (const count of [1, 200]) expect(adminInviteCountSchema.safeParse({ count }).success).toBe(true);
    for (const count of [0, 201, 1.5]) expect(adminInviteCountSchema.safeParse({ count }).success).toBe(false);
  });
  it("limits administrator targets to the five supported actions", () => {
    const matchId = "00000000-0000-4000-8000-000000000001";
    for (const to of ["invited", "submitted", "returned", "checked", "released"]) expect(advanceApplicationSchema.safeParse({ matchId, to }).success).toBe(true);
    for (const to of ["shortlisted", "accepted", "declined"]) expect(advanceApplicationSchema.safeParse({ matchId, to }).success).toBe(false);
  });
});