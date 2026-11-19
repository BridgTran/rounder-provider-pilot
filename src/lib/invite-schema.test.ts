import { describe, expect, it } from "vitest";
import { inviteActionSchema, intakeSchema } from "./invite-schema";

describe("private student actions", () => {
  const intake = { legalName: "Test Applicant", email: "test@example.com", phone: "", degree: "Science", discipline: "Science", rawGpa: 75, visaStatus: "Citizen", yearLevel: 1, studyMode: "Internal", studyLoad: 100, birthYear: 2000, firstDegreeCompletionYear: 2025, firstUndergraduateDegree: "yes", intendsFurtherStudy: "yes", communityContribution: "no", gender: "female", institution: "University of Sydney", degreeLevel: "not enrolled" };
  it("accepts not enrolled as a student level", () => {
    expect(intakeSchema.safeParse({ ...intake, degreeLevel: "not enrolled" }).success).toBe(true);
    expect(intakeSchema.safeParse({ ...intake, degreeLevel: "certificate" }).success).toBe(false);
  });
  it("limits completion year to 1990 through next year", () => {
    const nextYear = new Date().getUTCFullYear() + 1;
    for (const firstDegreeCompletionYear of [1990, nextYear]) expect(intakeSchema.safeParse({ ...intake, firstDegreeCompletionYear }).success).toBe(true);
    for (const firstDegreeCompletionYear of [null, undefined, 1989, nextYear + 1, 2020.5]) expect(intakeSchema.safeParse({ ...intake, firstDegreeCompletionYear }).success).toBe(false);
  });
  it("requires yes or no for further study", () => {
    for (const intendsFurtherStudy of ["yes", "no"]) expect(intakeSchema.safeParse({ ...intake, intendsFurtherStudy }).success).toBe(true);
    for (const intendsFurtherStudy of ["", undefined, "any"]) expect(intakeSchema.safeParse({ ...intake, intendsFurtherStudy }).success).toBe(false);
  });
  it("requires yes or no for community contribution", () => {
    for (const communityContribution of ["yes", "no"]) expect(intakeSchema.safeParse({ ...intake, communityContribution }).success).toBe(true);
    for (const communityContribution of ["", undefined, "any"]) expect(intakeSchema.safeParse({ ...intake, communityContribution }).success).toBe(false);
  });
  it("requires a first undergraduate degree answer", () => {
    for (const firstUndergraduateDegree of ["yes", "no"]) expect(intakeSchema.safeParse({ ...intake, firstUndergraduateDegree }).success).toBe(true);
    for (const firstUndergraduateDegree of ["", undefined]) expect(intakeSchema.safeParse({ ...intake, firstUndergraduateDegree }).success).toBe(false);
  });
  it("requires gender", () => {
    for (const gender of ["female", "male", "non-binary"]) expect(intakeSchema.safeParse({ ...intake, gender }).success).toBe(true);
    for (const gender of ["", undefined]) expect(intakeSchema.safeParse({ ...intake, gender }).success).toBe(false);
  });
  it("requires a listed university", () => {
    expect(intakeSchema.safeParse(intake).success).toBe(true);
    for (const institution of ["", undefined, "Unknown university"]) expect(intakeSchema.safeParse({ ...intake, institution }).success).toBe(false);
  });
  it("requires current enrolment level including not enrolled", () => {
    expect(intakeSchema.safeParse(intake).success).toBe(true);
    for (const degreeLevel of ["", undefined]) expect(intakeSchema.safeParse({ ...intake, degreeLevel }).success).toBe(false);
  });
  it("accepts intake without equity answers", () => {
    const parsed = intakeSchema.parse(intake);
    expect(parsed.equityTags).toEqual([]);
    expect(parsed.householdIncome).toBe(null);
  });
  it("defaults weekly hours to zero", () => expect(intakeSchema.parse(intake).weeklyHours).toBe(0));
  it("defaults work sector to Other", () => expect(intakeSchema.parse(intake).workSector).toBe("Other"));
  it("accepts all ten student disciplines", () => {
    for (const discipline of ["Law", "Engineering", "Business", "Medicine", "Arts", "Science", "Health", "Education", "IT", "Other"]) expect(intakeSchema.safeParse({ ...intake, discipline }).success).toBe(true);
    expect(intakeSchema.safeParse({ ...intake, discipline: "Unknown" }).success).toBe(false);
  });
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