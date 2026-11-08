import { describe, expect, it } from "vitest";
import { emptyFundRules, fundSaveSchema, fundRulesSchema } from "./fund-schema";

const draft = () => ({ title: "Pilot", orgClass: "Private trust", maximumAwardValue: 25000, discipline: "All Disciplines", lifeLoad: [], rules: emptyFundRules(), deedPath: null, activate: false, confirmed: false });
describe("Deed-backed fund rules", () => {
  it("accepts degree-level criteria without inventing a level from a degree title", () => {
    expect(fundRulesSchema.safeParse({degreeLevel:"undergraduate"}).success).toBe(true);
    expect(fundRulesSchema.safeParse({degreeLevel:"certificate"}).success).toBe(false);
  });
  it("accepts nonnegative years completed", () => {
    expect(fundRulesSchema.safeParse({yearsCompleted:2.5}).success).toBe(true);
    expect(fundRulesSchema.safeParse({yearsCompleted:-1}).success).toBe(false);
  });
  it("stores maximum award value rather than the deprecated stipend", () => {
    expect(fundSaveSchema.parse(draft()).maximumAwardValue).toBe(25000);
    expect(fundSaveSchema.safeParse({...draft(),maximumAwardValue:-1}).success).toBe(false);
  });
  it("requires fresh attestation on every later saved change", () => {
    expect(fundSaveSchema.safeParse({...draft(), id:"00000000-0000-4000-8000-000000000001"}).success).toBe(false);
    expect(fundSaveSchema.safeParse({...draft(), id:"00000000-0000-4000-8000-000000000001", confirmed:true}).success).toBe(true);
  });
  it("accepts only Required or Preferred strengths", () => {
    expect(fundRulesSchema.safeParse({strengths:{gender:"Preferred"}}).success).toBe(true);
    expect(fundRulesSchema.safeParse({strengths:{gender:"Optional"}}).success).toBe(false);
  });
  it("permits the four gender choices", () => {
    for (const gender of ["any","female","male","non-binary"]) expect(fundRulesSchema.safeParse({gender}).success).toBe(true);
    expect(fundRulesSchema.safeParse({gender:"unknown"}).success).toBe(false);
  });
  it("permits yes/no/any for first undergraduate degree", () => {
    for (const firstUndergraduateDegree of ["yes","no","any"]) expect(fundRulesSchema.safeParse({firstUndergraduateDegree}).success).toBe(true);
    expect(fundRulesSchema.safeParse({firstUndergraduateDegree:"maybe"}).success).toBe(false);
  });
  it("accepts multiple campus states", () => {
    expect(fundRulesSchema.safeParse({campusStates:["NSW","VIC"]}).success).toBe(true);
    expect(fundRulesSchema.safeParse({campusStates:["NZ"]}).success).toBe(false);
  });
  it("limits academic average to 0–100", () => {
    expect(fundRulesSchema.safeParse({minimumAcademicAverage:75}).success).toBe(true);
    expect(fundRulesSchema.safeParse({minimumAcademicAverage:101}).success).toBe(false);
  });
  it("limits study mode to on-campus/online/any", () => {
    for (const studyMode of ["any","on-campus","online"]) expect(fundRulesSchema.safeParse({studyMode}).success).toBe(true);
    expect(fundRulesSchema.safeParse({studyMode:"hybrid"}).success).toBe(false);
  });
  it("allows draft saving without deed confirmation", () => expect(fundSaveSchema.safeParse(draft()).success).toBe(true));
  it("requires deed confirmation to activate", () => expect(fundSaveSchema.safeParse({ ...draft(), activate: true, rules: { ...emptyFundRules(), numberOfAwards: 2, closeDate: "2027-06-30" } }).success).toBe(false));
  it("activates confirmed rules with awards and a close date", () => expect(fundSaveSchema.safeParse({ ...draft(), activate: true, confirmed: true, rules: { ...emptyFundRules(), numberOfAwards: 2, closeDate: "2027-06-30" } }).success).toBe(true));
  it("requires a positive number of awards", () => expect(fundRulesSchema.safeParse({ numberOfAwards: 0 }).success).toBe(false));
  it("accepts only four-digit Australian postcodes", () => expect(fundRulesSchema.safeParse({ postcodes: ["200"] }).success).toBe(false));
  it("offers the requested organisation classifications only", () => expect(fundSaveSchema.safeParse({ ...draft(), orgClass: "Employer" }).success).toBe(false));
  it("requires an application close date on activation", () => expect(fundSaveSchema.safeParse({ ...draft(), activate: true, confirmed: true, rules: { ...emptyFundRules(), numberOfAwards: 1 } }).success).toBe(false));
  it("limits first-generation choices to yes/no/any", () => expect(fundRulesSchema.safeParse({ firstGeneration: "maybe" }).success).toBe(false));
  it("limits Centrelink choices to yes/no/any", () => expect(fundRulesSchema.safeParse({ centrelink: "maybe" }).success).toBe(false));
  it("limits study load to full-time/part-time/any", () => expect(fundRulesSchema.safeParse({ studyLoad: "online" }).success).toBe(false));
});