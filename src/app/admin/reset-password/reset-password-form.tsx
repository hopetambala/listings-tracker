"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getEventValue } from "@/dlite-design-system/wc-helpers";

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

  useEffect(() => {
    const code = searchParams.get("code");

    if (!code) {
      setError("Invalid reset link. Please request a new password reset.");
      return;
    }

    // Exchange the one-time code for an active session so updateUser will work
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setError("This reset link has expired or already been used. Please request a new one.");
      } else {
        setReady(true);
      }
    });
  }, [searchParams, supabase.auth]);

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
        ) : error && !ready ? (
          // Link is invalid/expired — show error + request new link button
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
                onInput={(e: any) => setNewPassword(getEventValue(e))}
              />
              <dl-input
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                required
                onInput={(e: any) => setConfirmPassword(getEventValue(e))}
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
