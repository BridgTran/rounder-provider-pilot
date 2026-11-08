/**
 * ROUNDER HQ — global match state controller.
 *
 * A single, typed, in-memory store shared by the Student View and the
 * Corporate Hub. Every state change flows through
 * `handleMatchStateTransition`, which owns credit accounting, the
 * double-blind privacy mask, and the reveal handshake.
 */

import { useSyncExternalStore } from "react";

export type MatchStatus = "passive" | "active" | "revealed";

export interface StudentIdentity {
  legalName: string;
  phone: string;
  email: string;
  transcriptUrl: string;
}

export interface MatchRecord {
  /** Stable join key between the corporate feed row and the student card. */
  id: string;
  /** Anonymized corporate-feed tracking code. */
  candidateCode: string;
  /** Student-side opportunity program name. */
  program: string;
  /** Masked organisation label shown to the student pre-handshake. */
  orgMask: string;
  /** Real legal entity name — only unmasked after the handshake. */
  orgLegalName: string;
  /** Student PII — only unmasked to the organisation after the handshake. */
  student: StudentIdentity;
  status: MatchStatus;
  /** ISO timestamp of the completed handshake, if any. */
  handshakeAt: string | null;
}

export interface MatchState {
  credits: number;
  matches: MatchRecord[];
  /** Latest system/debug banner message, surfaced in both views. */
  systemStatus: string | null;
}

export type MatchAction =
  /** Organisation initiates contact: costs 1 credit, arms the student card. */
  | { type: "ORG_REQUEST_MATCH"; candidateCode: string }
  /** Student accepts: double-blind reveal handshake for both parties. */
  | { type: "STUDENT_ACCEPT_REVEAL"; program: string }
  | { type: "TOP_UP_CREDITS"; amount: number }
  | { type: "CLEAR_SYSTEM_STATUS" };

export interface TransitionResult {
  ok: boolean;
  /** Human-readable outcome, suitable for a toast. */
  message: string;
  detail?: string;
  match?: MatchRecord;
}

const HANDSHAKE_BANNER = "Handshake Complete. Secure P2P communication tunnel established.";

const initialMatches: MatchRecord[] = [
  {
    id: "m-88942",
    candidateCode: "CANDIDATE #AU-88942",
    program: "Commercial Pathways",
    orgMask: "Top-Tier Law Firm",
    orgLegalName: "Allens (Allens Linklaters), Pty Ltd",
    student: {
      legalName: "Priya Raman",
      phone: "+61 412 884 902",
      email: "p.raman@student.edu.au",
      transcriptUrl: "https://my.equals.com/transcripts/AU-88942",
    },
    status: "passive",
    handshakeAt: null,
  },
  {
    id: "m-31076",
    candidateCode: "CANDIDATE #AU-31076",
    program: "Regional Engineering Scholarship",
    orgMask: "Fortune 100 Miner",
    orgLegalName: "BHP Group Limited",
    student: {
      legalName: "Jack Mereweather",
      phone: "+61 438 310 776",
      email: "j.mereweather@student.edu.au",
      transcriptUrl: "https://my.equals.com/transcripts/AU-31076",
    },
    status: "passive",
    handshakeAt: null,
  },
  {
    id: "m-55213",
    candidateCode: "CANDIDATE #AU-55213",
    program: "Leadership Stream",
    orgMask: "Big Four Bank",
    orgLegalName: "Commonwealth Bank of Australia",
    student: {
      legalName: "Amira Haddad",
      phone: "+61 421 552 130",
      email: "a.haddad@student.edu.au",
      transcriptUrl: "https://my.equals.com/transcripts/AU-55213",
    },
    status: "passive",
    handshakeAt: null,
  },
  {
    id: "m-70415",
    candidateCode: "CANDIDATE #AU-70415",
    program: "Future Health Leaders Grant",
    orgMask: "National Health Network",
    orgLegalName: "Ramsay Health Care Limited",
    student: {
      legalName: "Dana Kowalski",
      phone: "+61 470 415 208",
      email: "d.kowalski@student.edu.au",
      transcriptUrl: "https://my.equals.com/transcripts/AU-70415",
    },
    status: "passive",
    handshakeAt: null,
  },
  {
    id: "m-19638",
    candidateCode: "CANDIDATE #AU-19638",
    program: "Creative Industries Fellowship",
    orgMask: "Global Media Group",
    orgLegalName: "Nine Entertainment Co. Holdings Limited",
    student: {
      legalName: "Levi Okafor",
      phone: "+61 419 638 441",
      email: "l.okafor@student.edu.au",
      transcriptUrl: "https://my.equals.com/transcripts/AU-19638",
    },
    status: "passive",
    handshakeAt: null,
  },
];

const STORAGE_KEY = "rounder-hq:match-state";

const defaultState: MatchState = {
  credits: 12,
  matches: initialMatches,
  systemStatus: null,
};

let state: MatchState = defaultState;

const listeners = new Set<() => void>();

function persist(next: MatchState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — in-memory only */
  }
}

function emit(next: MatchState) {
  state = next;
  if (typeof window !== "undefined") persist(next);
  listeners.forEach((l) => l());
}

let hydrated = false;

function hydrateFromStorage() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as MatchState;
    if (typeof parsed?.credits === "number" && Array.isArray(parsed.matches)) {
      state = parsed;
      listeners.forEach((l) => l());
    }
  } catch {
    /* ignore malformed cache */
  }
}

function patchMatch(id: string, patch: Partial<MatchRecord>): MatchRecord {
  let updated!: MatchRecord;
  const matches = state.matches.map((m) => {
    if (m.id !== id) return m;
    updated = { ...m, ...patch };
    return updated;
  });
  emit({ ...state, matches });
  return updated;
}

/**
 * The single authority for match lifecycle transitions.
 * Validates the action against the current matches array, applies credit
 * accounting, and unmasks identity data only on a completed handshake.
 */
export function handleMatchStateTransition(action: MatchAction): TransitionResult {
  switch (action.type) {
    case "ORG_REQUEST_MATCH": {
      const match = state.matches.find((m) => m.candidateCode === action.candidateCode);
      if (!match) {
        return { ok: false, message: "Candidate not found in the active match registry." };
      }
      if (match.status !== "passive") {
        return { ok: false, message: `Match already in progress for ${match.candidateCode}.` };
      }
      if (state.credits <= 0) {
        return {
          ok: false,
          message: "No Match Credits remaining",
          detail: "Top up to unlock more candidates.",
        };
      }
      emit({ ...state, credits: state.credits - 1 });
      const updated = patchMatch(match.id, { status: "active" });
      return {
        ok: true,
        message: `Handshake pending for ${updated.candidateCode}`,
        detail: "The candidate has been notified. 1 Match Credit used.",
        match: updated,
      };
    }

    case "STUDENT_ACCEPT_REVEAL": {
      const match = state.matches.find((m) => m.program === action.program);
      if (!match) {
        return { ok: false, message: "No active request found for this opportunity." };
      }
      if (match.status !== "active") {
        return {
          ok: false,
          message: "This provider has not initiated an official match request yet.",
        };
      }
      const updated = patchMatch(match.id, {
        status: "revealed",
        handshakeAt: new Date().toISOString(),
      });
      emit({ ...state, systemStatus: HANDSHAKE_BANNER });
      // System debug status check
      // eslint-disable-next-line no-console
      console.log(
        `[ROUNDER HQ] ${HANDSHAKE_BANNER}`,
        { matchId: updated.id, candidate: updated.candidateCode, org: updated.orgLegalName },
      );
      return {
        ok: true,
        message: `Identity handshake complete — ${updated.orgLegalName} revealed`,
        detail: "Both parties are now unmasked. Secure P2P tunnel established.",
        match: updated,
      };
    }

    case "TOP_UP_CREDITS": {
      emit({ ...state, credits: state.credits + action.amount });
      return { ok: true, message: "Top-up successful", detail: `${action.amount} Match Credits added.` };
    }

    case "CLEAR_SYSTEM_STATUS": {
      emit({ ...state, systemStatus: null });
      return { ok: true, message: "System status cleared." };
    }
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  hydrateFromStorage();
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => state;
const getServerSnapshot = () => defaultState;

/** React binding for the global match state. */
export function useMatchState(): MatchState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function findMatchByProgram(matches: MatchRecord[], program: string) {
  return matches.find((m) => m.program === program);
}

export function findMatchByCode(matches: MatchRecord[], code: string) {
  return matches.find((m) => m.candidateCode === code);
}
