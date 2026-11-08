import { describe, expect, it } from "vitest";
import {
  PASSWORD_RESET_PATH,
  isRecoveryHash,
  passwordResetRedirectUrl,
} from "./auth-redirect";

describe("password reset redirect", () => {
  it("sends the reset email to this app's own reset page", () => {
    expect(passwordResetRedirectUrl("https://roundherhq.lovable.app")).toBe(
      "https://roundherhq.lovable.app/reset-password",
    );
    expect(PASSWORD_RESET_PATH).toBe("/reset-password");
  });

  it("does not double the path when the origin has a trailing slash", () => {
    expect(passwordResetRedirectUrl("http://localhost:8080/")).toBe(
      "http://localhost:8080/reset-password",
    );
  });

  it("recognises a recovery link and rejects other auth links", () => {
    expect(
      isRecoveryHash("#access_token=abc&token_type=bearer&expires_in=3600&type=recovery"),
    ).toBe(true);
    expect(isRecoveryHash("#access_token=abc&type=confirmation")).toBe(false);
    expect(isRecoveryHash("")).toBe(false);
  });
});
