/**
 * Password-reset links must bounce back to this app's own reset page, never to
 * an arbitrary caller-supplied host that could capture the recovery token.
 */
export const PASSWORD_RESET_PATH = "/reset-password";

/** Builds the same-origin `emailRedirectTo` target for a password-reset email. */
export function passwordResetRedirectUrl(origin: string): string {
  const trimmed = origin.replace(/\/+$/, "");
  return `${trimmed}${PASSWORD_RESET_PATH}`;
}

/** True when the browser URL hash carries a Supabase recovery-token link. */
export function isRecoveryHash(hash: string): boolean {
  return /(?:^|[#&])type=recovery(?:&|$)/.test(hash);
}
