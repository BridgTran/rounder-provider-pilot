/**
 * Anonymized candidate pool for the Corporate Hub discovery feed.
 * Mock data only — no real students.
 */

import type { StudentProfile } from "./irto";

export interface CandidateRecord extends StudentProfile {
  degree: string;
  year: string;
  uni: string;
  endorsement: string;
  endorser: string;
  traits: string[];
}

export const candidatePool: CandidateRecord[] = [
  {
    id: "c-88942",
    candidateCode: "CANDIDATE #AU-88942",
    degreeTitle: "Bachelor of Laws",
    degree: "Bachelor of Laws",
    discipline: "Law",
    year: "3rd Year",
    uni: "Sandstone University (anonymized)",
    rawGpa: 76,
    weeklyHours: 25,
    workSector: "Hospitality",
    visaStatus: "Citizen",
    yearLevel: 3,
    studyMode: "Internal",
    studyLoad: 75,
    birthYear: 2003,
    equityTags: ["First-Gen Student", "High External Workload 20+ hrs", "Low-SES Postcode"],
    verifiedEquity: { centrelinkConcession: true, lowSesPostcode: true },
    softSkills: {
      clientEmpathy: 92,
      pressureResilience: 88,
      crisisManagement: 84,
      adaptability: 86,
    },
    endorsement:
      "Shows up to every society shift after a 10-hour work roster and still lifts the whole team. First person I'd hire.",
    endorser: "President, Law Students' Society",
    traits: ["First-Gen", "20+ hrs work", "Distinction avg"],
  },
  {
    id: "c-31076",
    candidateCode: "CANDIDATE #AU-31076",
    degreeTitle: "Bachelor of Engineering (Civil)",
    degree: "Bachelor of Engineering (Civil)",
    discipline: "Engineering",
    year: "4th Year",
    uni: "Regional University (anonymized)",
    rawGpa: 72,
    weeklyHours: 30,
    workSector: "Trades",
    visaStatus: "Citizen",
    yearLevel: 4,
    studyMode: "Hybrid",
    studyLoad: 75,
    birthYear: 1998,
    equityTags: ["Regional/Remote Background", "Primary Caretaker"],
    verifiedEquity: { centrelinkConcession: false, lowSesPostcode: false },
    softSkills: {
      clientEmpathy: 80,
      pressureResilience: 90,
      crisisManagement: 88,
      adaptability: 92,
    },
    endorsement:
      "Drove 400km each week for capstone placements while caring for a parent. Never missed a deadline, never complained.",
    endorser: "President, Engineering Society",
    traits: ["Regional/Remote", "Primary Caretaker"],
  },
  {
    id: "c-55213",
    candidateCode: "CANDIDATE #AU-55213",
    degreeTitle: "Bachelor of Commerce",
    degree: "Bachelor of Commerce",
    discipline: "Business",
    year: "2nd Year",
    uni: "Metro University (anonymized)",
    rawGpa: 74,
    weeklyHours: 22,
    workSector: "Retail",
    visaStatus: "Permanent Resident",
    yearLevel: 2,
    studyMode: "Internal",
    studyLoad: 100,
    birthYear: 2004,
    equityTags: ["First-Gen Student", "High External Workload 20+ hrs"],
    verifiedEquity: { centrelinkConcession: true, lowSesPostcode: false },
    softSkills: {
      clientEmpathy: 86,
      pressureResilience: 82,
      crisisManagement: 78,
      adaptability: 84,
    },
    endorsement:
      "Built our case-competition program from zero while working three casual jobs. Relentless in the best way.",
    endorser: "President, Business Students' Association",
    traits: ["First-Gen", "20+ hrs work"],
  },
  {
    id: "c-70415",
    candidateCode: "CANDIDATE #AU-70415",
    degreeTitle: "Bachelor of Nursing",
    degree: "Bachelor of Nursing",
    discipline: "Medicine",
    year: "3rd Year",
    uni: "Coastal University (anonymized)",
    rawGpa: 70,
    weeklyHours: 32,
    workSector: "Hospital / Clinical Care",
    visaStatus: "Citizen",
    yearLevel: 3,
    studyMode: "Internal",
    studyLoad: 75,
    birthYear: 1994,
    equityTags: ["Low-SES Postcode", "Primary Caretaker", "High External Workload 20+ hrs"],
    verifiedEquity: { centrelinkConcession: true, lowSesPostcode: true },
    softSkills: {
      clientEmpathy: 95,
      pressureResilience: 93,
      crisisManagement: 91,
      adaptability: 88,
    },
    endorsement:
      "Ran night shifts on a cardiac ward and still tutored first-years every Saturday. Calm under genuine pressure.",
    endorser: "President, Nursing Students' Society",
    traits: ["Mature Age", "Clinical shifts", "Low-SES"],
  },
  {
    id: "c-19638",
    candidateCode: "CANDIDATE #AU-19638",
    degreeTitle: "Bachelor of Communications",
    degree: "Bachelor of Communications",
    discipline: "Arts",
    year: "2nd Year",
    uni: "Inner-City University (anonymized)",
    rawGpa: 81,
    weeklyHours: 14,
    workSector: "Administration",
    visaStatus: "Student Visa 500",
    yearLevel: 2,
    studyMode: "Online",
    studyLoad: 50,
    birthYear: 2003,
    equityTags: ["Regional/Remote Background"],
    verifiedEquity: { centrelinkConcession: false, lowSesPostcode: false },
    softSkills: {
      clientEmpathy: 84,
      pressureResilience: 72,
      crisisManagement: 68,
      adaptability: 80,
    },
    endorsement:
      "Turned our student magazine around in a semester while studying remotely from three hours out of town.",
    endorser: "President, Media & Communications Collective",
    traits: ["Regional/Remote", "Online study"],
  },
];
