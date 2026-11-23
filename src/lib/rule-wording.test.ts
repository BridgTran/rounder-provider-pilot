import { describe, expect, it } from "vitest";
import { describeRule } from "./rule-wording";
import { emptyFundRules } from "./fund-schema";

describe("describeRule", () => {
  const rules = { ...emptyFundRules(), gender: "female" as const, completionYear: 2026, campusStates: ["NSW", "ACT"] as ("NSW" | "ACT")[], residencies: ["Citizen", "Permanent Resident"] as ("Citizen" | "Permanent Resident")[] };
  it("words known rules from the fund values", () => {
    expect(describeRule("gender", rules, "Law")).toBe("Identifies as a woman");
    expect(describeRule("completionYear", rules, "Law")).toBe("Completes final year of first degree in 2026");
    expect(describeRule("campusStates", rules, "Law")).toBe("Campus in NSW or ACT");
    expect(describeRule("residencies", rules, "Law")).toBe("Citizen or Permanent Resident");
  });
  it("falls back to the raw key", () => {
    expect(describeRule("somethingNew", rules, "Law")).toBe("somethingNew");
  });
});
