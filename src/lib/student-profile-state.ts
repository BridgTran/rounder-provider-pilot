/** Global onboarding state for the signed-in student (mock, session-persisted). */
import { useSyncExternalStore } from "react";
import type { IrtoResult } from "./irto";

export interface OnboardingState {
  completed: boolean;
  result: IrtoResult | null;
  gritAnswers: number[];
}

const KEY = "rounder-hq:student-onboarding";
const initial: OnboardingState = { completed: false, result: null, gritAnswers: [] };
let state = initial;
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) {
      state = JSON.parse(raw) as OnboardingState;
      listeners.forEach((l) => l());
    }
  } catch {
    /* ignore */
  }
}

export function setOnboarding(next: OnboardingState) {
  state = next;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function resetOnboarding() {
  setOnboarding(initial);
}

export function useOnboarding() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      hydrate();
      return () => listeners.delete(l);
    },
    () => state,
    () => initial,
  );
}
