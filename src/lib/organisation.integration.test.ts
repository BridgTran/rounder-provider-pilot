import { describe, expect, it } from "vitest";

// Run with a managed test session; never persist credentials in the project.
const url = process.env["TEAM_TEST_URL"];
const key = process.env["TEAM_TEST_KEY"];
const token = process.env["TEAM_TEST_TOKEN"];
const email = process.env["TEAM_TEST_EMAIL"];

describe.skipIf(!url || !key || !token || !email)("automatic verified team joining", () => {
  it("accepts the verified invited email once without a pasted invitation token", async () => {
    async function rpc(name: string, input: Record<string, unknown> = {}) {
      const result = await fetch(`${url}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: { apikey: key ?? "", Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      expect(result.ok).toBe(true);
      const text = await result.text();
      return text ? JSON.parse(text) : null;
    }
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const hash = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
    await rpc("create_organisation_invite", { p_email: email, p_hash: hash });
    expect(await rpc("claim_organisation_invitations")).toBeGreaterThanOrEqual(1);
    expect(await rpc("claim_organisation_invitations")).toBe(0);
  });
});