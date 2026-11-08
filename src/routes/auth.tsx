import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search["redirect"] === "string" ? (search["redirect"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Provider Sign In — ROUNDER HQ" },
      {
        name: "description",
        content: "Sign in or register your scholarship provider workspace on ROUNDER HQ.",
      },
      { property: "og:title", content: "Provider Sign In — ROUNDER HQ" },
      {
        property: "og:description",
        content: "Access the context-matched candidate discovery workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

/** Only same-origin relative paths may be used as a post-login target. */
function safeRedirect(path: string | undefined): string {
  if (path && path.startsWith("/") && !path.startsWith("//")) return path;
  return "/corporate";
}

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  const handleSignIn = async () => {
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    navigate({ to: safeRedirect(redirect) });
  };

  const handleSignUp = async () => {
    setBusy(true);
    setError(null);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { organisation_name: orgName, contact_person: contactPerson },
        emailRedirectTo: window.location.origin,
      },
    });
    setBusy(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (data.session) {
      navigate({ to: safeRedirect(redirect) });
      return;
    }
    // Email confirmation is on: no session until the link is clicked.
    setCheckEmail(true);
  };

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-12 sm:py-16">
      <div className="panel-dark p-6 sm:p-8">
        <p className="eyebrow text-lime">Provider Workspace</p>
        <h1 className="mt-3 text-2xl text-charcoal-foreground sm:text-3xl">
          {mode === "sign-in" ? "Sign in to ROUNDER HQ" : "Register your organisation"}
        </h1>
        <p className="mt-2 text-sm text-charcoal-foreground/70">
          {mode === "sign-in"
            ? "Access your candidate discovery feed, funds and Match Credits."
            : "Create a provider account. New workspaces start with 12 Match Credits."}
        </p>

        {checkEmail ? (
          <div className="mt-6 rounded-2xl border border-lime/50 bg-lime/10 p-5 text-sm font-semibold text-charcoal-foreground">
            <p className="font-black text-lime">📬 Check your email</p>
            <p className="mt-2 text-charcoal-foreground/80">
              We sent a confirmation link to <span className="font-bold">{email}</span>. Click it to
              activate your workspace, then sign in.
            </p>
            <button
              onClick={() => {
                setCheckEmail(false);
                setMode("sign-in");
              }}
              className="mt-4 text-xs font-bold text-lime underline hover:brightness-110"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (busy) return;
              void (mode === "sign-in" ? handleSignIn() : handleSignUp());
            }}
          >
            {mode === "sign-up" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="org-name" className="text-xs font-bold text-charcoal-foreground">
                    Organisation name
                  </Label>
                  <Input
                    id="org-name"
                    required
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="e.g. Meridian Foundation"
                    className="border-charcoal-foreground/20 bg-charcoal-foreground/5 text-charcoal-foreground placeholder:text-charcoal-foreground/40"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact-person" className="text-xs font-bold text-charcoal-foreground">
                    Contact person
                  </Label>
                  <Input
                    id="contact-person"
                    required
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="e.g. Alex Chen"
                    className="border-charcoal-foreground/20 bg-charcoal-foreground/5 text-charcoal-foreground placeholder:text-charcoal-foreground/40"
                  />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-bold text-charcoal-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@organisation.org"
                className="border-charcoal-foreground/20 bg-charcoal-foreground/5 text-charcoal-foreground placeholder:text-charcoal-foreground/40"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-bold text-charcoal-foreground">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="border-charcoal-foreground/20 bg-charcoal-foreground/5 text-charcoal-foreground placeholder:text-charcoal-foreground/40"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-xs font-bold text-red-300">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={busy}
              className="w-full bg-lime font-black text-lime-foreground hover:bg-lime/90"
            >
              {busy ? "Working…" : mode === "sign-in" ? "Sign In" : "Create Provider Account"}
            </Button>

            <p className="text-center text-xs text-charcoal-foreground/60">
              {mode === "sign-in" ? "New provider?" : "Already registered?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "sign-in" ? "sign-up" : "sign-in");
                  setError(null);
                }}
                className="font-bold text-lime underline hover:brightness-110"
              >
                {mode === "sign-in" ? "Create an account" : "Sign in"}
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
