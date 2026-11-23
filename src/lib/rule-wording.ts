import type { FundRules } from "./fund-schema";

const list = (items: readonly (string | number)[]) =>
  items.length <= 1 ? String(items[0] ?? "") : `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;

const genderWords: Record<string, string> = { female: "a woman", male: "a man", "non-binary": "non-binary" };

/** Plain-English wording for each fund rule key; values come from the fund's own rules. */
const ruleWording: Record<string, (r: FundRules, discipline: string) => string> = {
  gender: (r) => `Identifies as ${genderWords[r.gender] ?? r.gender}`,
  firstUndergraduateDegree: (r) => (r.firstUndergraduateDegree === "no" ? "Not their first undergraduate degree" : "First undergraduate degree"),
  completionYear: (r) => `Completes final year of first degree in ${r.completionYear ?? "the required year"}`,
  campusStates: (r) => `Campus in ${list(r.campusStates)}`,
  state: (r) => `Lives in ${r.state}`,
  residencies: (r) => list(r.residencies),
  degreeLevel: (r) => `Enrolled in ${r.degreeLevel}`,
  studyLoad: (r) => `Studies ${r.studyLoad}`,
  studyMode: (r) => (r.studyMode === "on-campus" ? "Studies on campus" : "Studies online"),
  minimumAcademicAverage: (r) => `Academic average of at least ${r.minimumAcademicAverage}`,
  communityContribution: () => "Significant community contribution",
  furtherStudy: () => "Intends to continue to further study",
  yearsCompleted: (r) => `Has completed at least ${r.yearsCompleted} years of study`,
  institutions: (r) => `Studies at ${list(r.institutions)}`,
  yearLevels: (r) => `In year ${list(r.yearLevels)} of study`,
  firstGeneration: (r) => (r.firstGeneration === "no" ? "Not first in family at university" : "First in family at university"),
  centrelink: (r) => (r.centrelink === "no" ? "No Centrelink concession" : "Holds a Centrelink concession"),
  maxHouseholdIncome: (r) => `Household income up to $${r.maxHouseholdIncome?.toLocaleString("en-AU")}`,
  postcodes: (r) => `Lives in postcode ${list(r.postcodes)}`,
  regions: (r) => `Lives in ${list(r.regions)}`,
  discipline: (_r, d) => `Studies ${d}`,
  lifeLoad: () => "Matches the fund's life circumstances criteria",
};

export function describeRule(key: string, rules: FundRules, discipline: string): string {
  const word = ruleWording[key];
  return word ? word(rules, discipline) : key;
}
