"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getEventValue, WcInputEvent } from "@/dlite-design-system/wc-helpers";

export default function ResetPasswordForm() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [ready, setReady] = useState(false); // true once code is exchanged for a session
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const code = searchParams.get("code");

  useEffect(() => {
    if (!code) return;

    // @supabase/ssr sets detectSessionInUrl: true, so the browser client automatically
    // exchanges the code before this component mounts and fires PASSWORD_RECOVERY.
    // Calling exchangeCodeForSession manually would fail with "already used".
    // Instead, listen for PASSWORD_RECOVERY; fall back to getSession() for the race
    // condition where the event fires before this listener is attached.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
      else setError("This reset link has expired or already been used. Please request a new one.");
    });

    return () => subscription.unsubscribe();
  }, [code, supabase.auth]);

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }
      setSuccess(true);
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => router.push("/admin/dashboard"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
      setLoading(false);
    }
  }

  return (
    <main className="page page--centered">
      <div className="cl-dlite-w-full" style={{ maxWidth: "24rem" }}>
        <div className="cl-dlite-text-center" style={{ marginBottom: "1.5rem" }}>
          <dl-heading level={1}>Set New Password</dl-heading>
        </div>

        {success ? (
          <div style={{ textAlign: "center" }}>
            <dl-text color="primary" style={{ marginBottom: "1rem", display: "block" }}>
              ✓ Password updated successfully!
            </dl-text>
            <dl-text color="secondary" size="300">Redirecting to dashboard...</dl-text>
          </div>
        ) : !code ? (
          // No code in URL — invalid link
          <div style={{ textAlign: "center" }}>
            <dl-text color="tertiary" style={{ display: "block", marginBottom: "1.5rem" }}>
              Invalid reset link. Please request a new password reset.
            </dl-text>
            <dl-button variant="primary" onClick={() => router.push("/admin")}>
              Request a New Reset Link
            </dl-button>
          </div>
        ) : error && !ready ? (
          // Link expired or already used
          <div style={{ textAlign: "center" }}>
            <dl-text color="tertiary" style={{ display: "block", marginBottom: "1.5rem" }}>
              {error}
            </dl-text>
            <dl-button variant="primary" onClick={() => router.push("/admin")}>
              Request a New Reset Link
            </dl-button>
          </div>
        ) : ready ? (
          <form onSubmit={handleResetPassword}>
            <dl-stack direction="vertical" gap="400">
              <dl-input
                type="password"
                placeholder="New Password"
                value={newPassword}
                required
                onInput={(e: WcInputEvent) => setNewPassword(getEventValue(e))}
              />
              <dl-input
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                required
                onInput={(e: WcInputEvent) => setConfirmPassword(getEventValue(e))}
              />
              {error && <dl-text size="300" color="tertiary">{error}</dl-text>}
              <dl-button variant="primary" size="md" full-width disabled={loading || undefined} onClick={handleResetPassword}>
                {loading ? "Updating..." : "Update Password"}
              </dl-button>
            </dl-stack>
          </form>
        ) : (
          // Exchanging code — brief loading state
          <div style={{ textAlign: "center" }}>
            <dl-spinner />
            <dl-text color="secondary" size="300" style={{ marginTop: "1rem", display: "block" }}>
              Verifying reset link...
            </dl-text>
          </div>
        )}

        <div className="cl-dlite-text-center cl-dlite-sem-mt-600">
          <dl-button variant="ghost" size="sm" onClick={() => router.push("/admin")}>
            ← Back to Login
          </dl-button>
        </div>
      </div>
    </main>
  );
}
