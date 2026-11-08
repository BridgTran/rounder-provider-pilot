import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isRecoveryHash, passwordResetRedirectUrl } from "@/lib/auth-redirect";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password — ROUNDER HQ" },
      {
        name: "description",
        content: "Set a new password for your ROUNDER HQ provider workspace.",
      },
      { property: "og:title", content: "Choose a new password — ROUNDER HQ" },
      {
        property: "og:description",
        content: "Finish the password reset you requested from your provider workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPasswordPage,
});

/**
 * Captured while the module loads, before Supabase strips the recovery token
 * out of the URL hash. Only used to decide what to render after mount.
 */
const OPENED_FROM_RECOVERY_LINK =
  typeof window !== "undefined" && isRecoveryHash(window.location.hash);

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"checking" | "recovery" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let settled = false;
    const finish = (recovery: boolean) => {
      if (settled) return;
      settled = true;
      setPhase(recovery ? "recovery" : "invalid");
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        finish(true);
        return;
      }
      if (event === "INITIAL_SESSION") finish(OPENED_FROM_RECOVERY_LINK && Boolean(session));
    });

    // Resolves once Supabase has finished reading the link (or found nothing).
    void supabase.auth.getSession().then(({ data }) => {
      finish(OPENED_FROM_RECOVERY_LINK && Boolean(data.session));
    });

    // Never leave the page stuck on "checking" if no session event arrives.
    const timer = window.setTimeout(() => finish(false), 5000);
    return () => {
      window.clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  const handleUpdate = async () => {
    if (password.length < 6) {
      setError("Choose a password with at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those two passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    toast.success("Password updated — you're signed in to your workspace.");
    navigate({ to: "/corporate" });
  };

  const handleSendNewLink = async (email: string) => {
    setBusy(true);
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: passwordResetRedirectUrl(window.location.origin),
    });
    setBusy(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    toast.success("We sent a new reset link. Check your inbox.");
  };

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-12 sm:py-16">
      <div className="panel-dark p-6 sm:p-8">
        <p className="eyebrow text-lime">Password Reset</p>
        <h1 className="mt-3 text-2xl text-charcoal-foreground sm:text-3xl">
          {phase === "recovery" ? "Choose a new password" : "This reset link won't work"}
        </h1>

        {phase === "checking" && (
          <p className="mt-2 text-sm text-charcoal-foreground/70">
            Checking your reset link…
          </p>
        )}

        {phase === "recovery" && (
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (busy) return;
              void handleUpdate();
            }}
          >
            <p className="text-sm text-charcoal-foreground/70">
              Pick a new password for your provider workspace. You'll stay signed in when it's saved.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="new-password" className="text-xs font-bold text-charcoal-foreground">
                New password
              </Label>
              <Input
                id="new-password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="border-charcoal-foreground/20 bg-charcoal-foreground/5 text-charcoal-foreground placeholder:text-charcoal-foreground/40"
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="confirm-password"
                className="text-xs font-bold text-charcoal-foreground"
              >
                Confirm new password
              </Label>
              <Input
                id="confirm-password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="border-charcoal-foreground/20 bg-charcoal-foreground/5 text-charcoal-foreground placeholder:text-charcoal-foreground/40"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-xs font-bold text-red-300"
              >
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={busy}
              className="w-full bg-lime font-black text-lime-foreground hover:bg-lime/90"
            >
              {busy ? "Saving…" : "Save new password"}
            </Button>
          </form>
        )}

        {phase === "invalid" && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-charcoal-foreground/70">
              Reset links expire after an hour and only work once. Ask for a fresh one, or go back
              and sign in as usual.
            </p>
            <InvalidLinkHelp
              busy={busy}
              error={error}
              onSend={(email) => void handleSendNewLink(email)}
            />
            <p className="text-center text-xs text-charcoal-foreground/60">
              Remembered it?{" "}
              <Link
                to="/auth"
                search={{ redirect: undefined }}
                className="font-bold text-lime underline hover:brightness-110"
              >
                Sign in
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function InvalidLinkHelp({
  busy,
  error,
  onSend,
}: {
  busy: boolean;
  error: string | null;
  onSend: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (busy || !email) return;
        onSend(email);
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="reset-email" className="text-xs font-bold text-charcoal-foreground">
          Email on your account
        </Label>
        <Input
          id="reset-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@organisation.org"
          className="border-charcoal-foreground/20 bg-charcoal-foreground/5 text-charcoal-foreground placeholder:text-charcoal-foreground/40"
        />
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-xs font-bold text-red-300"
        >
          {error}
        </p>
      )}
      <Button
        type="submit"
        disabled={busy}
        className="w-full bg-lime font-black text-lime-foreground hover:bg-lime/90"
      >
        {busy ? "Sending…" : "Send me a new reset link"}
      </Button>
    </form>
  );
}
