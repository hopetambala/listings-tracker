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
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    // Check if there's a recovery code in the URL
    const code = searchParams.get("code");
    if (!code) {
       
      setError("Invalid reset link. Please use the email link to reset your password.");
    }
  }, [searchParams]);

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Validation
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      // Update the user's password
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

      if (updateError) {
        setLoading(false);
        setError(updateError.message);
        return;
      }

      setLoading(false);
      setSuccess(true);
      setNewPassword("");
      setConfirmPassword("");

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push("/admin/dashboard");
      }, 2000);
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "Failed to reset password");
    }
  }

  return (
    <main className="page page--centered">
      <div className="cl-dlite-w-full" style={{ maxWidth: "24rem" }}>
        <div className="cl-dlite-text-center">
          <dl-heading level={1}>Set New Password</dl-heading>
        </div>

        {success ? (
          <div style={{ textAlign: "center" }}>
            <dl-text color="primary" style={{ marginBottom: "1rem", display: "block" }}>
              ✓ Password updated successfully!
            </dl-text>
            <dl-text color="secondary" size="300">
              Redirecting to dashboard...
            </dl-text>
          </div>
        ) : (
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
              <dl-button
                variant="primary"
                size="md"
                full-width
                disabled={loading || undefined}
                onClick={handleResetPassword}
              >
                {loading ? "..." : "Update Password"}
              </dl-button>
            </dl-stack>
          </form>
        )}

        <div className="cl-dlite-text-center cl-dlite-sem-mt-600">
          <dl-button variant="ghost" size="sm" onClick={() => router.push("/admin")}>
            &larr; Back to Login
          </dl-button>
        </div>
      </div>
    </main>
  );
}
