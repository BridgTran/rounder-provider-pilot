import { describe, expect, it } from "vitest";
import { emptyFundRules, fundSaveSchema, fundRulesSchema } from "./fund-schema";

const draft = () => ({ title: "Pilot", orgClass: "Private trust", stipendAud: 25000, discipline: "All Disciplines", lifeLoad: [], rules: emptyFundRules(), deedPath: null, activate: false, confirmed: false });
describe("Deed-backed fund rules", () => {
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