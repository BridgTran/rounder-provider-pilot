import { describe, expect, it } from "vitest";
import { inviteActionSchema, intakeSchema } from "./invite-schema";

describe("private student actions", () => {
  const token = "a".repeat(64);
  it("requires a private invite credential, not a candidate code", () => {
    expect(inviteActionSchema.safeParse({ token: "CANDIDATE #AU-31076", action: "consent" }).success).toBe(false);
    expect(inviteActionSchema.safeParse({ token, action: "consent" }).success).toBe(true);
  });
  it("accepts or declines only a specifically identified unlock request", () => {
    const payload = { matchId: "00000000-0000-4000-8000-000000031076", decision: "accept" };
    expect(inviteActionSchema.safeParse({ token, action: "respond", payload }).success).toBe(true);
    expect(inviteActionSchema.safeParse({ token, action: "respond", payload: { ...payload, decision: "decline" } }).success).toBe(true);
    expect(inviteActionSchema.safeParse({ token, action: "respond", payload: { decision: "accept" } }).success).toBe(false);
  });
  it("allows deletion only with the invitation credential", () => {
    expect(inviteActionSchema.safeParse({ action: "delete" }).success).toBe(false);
    expect(inviteActionSchema.safeParse({ token, action: "delete" }).success).toBe(true);
  });
  it("requires intake name, email and academic information", () => {
    expect(intakeSchema.safeParse({}).success).toBe(false);
  });
});