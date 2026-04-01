"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getEventValue } from "@/dlite-design-system/wc-helpers";

export default function AdminAuth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Check if already logged in + listen for auth changes
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.push("/admin/dashboard");
      }
    };
    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session) {
          setIsRedirecting(true);
          router.push("/admin/dashboard");
        }
      }
    );

    return () => subscription?.unsubscribe();
  }, [supabase.auth, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Forgot password flow
    if (isForgotPassword) {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);

      if (resetError) {
        setLoading(false);
        setError(resetError.message);
        return;
      }

      setLoading(false);
      setError("✓ Check your email for a password reset link.");
      setEmail("");
      return;
    }

    // Sign up flow
    if (isSignUp) {
      const { error: authError } = await supabase.auth.signUp({ email, password });

      if (authError) {
        setLoading(false);
        setError(authError.message);
        return;
      }

      setLoading(false);
      setError("✓ Check your email to confirm your account, then sign in.");
      setEmail("");
      setPassword("");
      setIsSignUp(false);
      return;
    }

    // Sign in flow
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setLoading(false);
      setError(authError.message);
      return;
    }

    setLoading(false);
    // onAuthStateChange listener will handle the redirect
  }

  return (
    <main className="page page--centered">
      <div className="cl-dlite-w-full" style={{ maxWidth: "24rem" }}>
        <div className="cl-dlite-text-center">
          <dl-heading level={1}>
            {isForgotPassword ? "Reset Password" : `Admin ${isSignUp ? "Sign Up" : "Login"}`}
          </dl-heading>
        </div>

        <form onSubmit={handleSubmit}>
          <dl-stack direction="vertical" gap="400">
            <dl-input
              type="email"
              placeholder="Email"
              value={email}
              required
              onInput={(e: any) => setEmail(getEventValue(e))}
            />
            {!isForgotPassword && (
              <dl-input
                type="password"
                placeholder="Password"
                value={password}
                required
                onInput={(e: any) => setPassword(getEventValue(e))}
              />
            )}
            {error && (
              <dl-text size="300" color={error.startsWith("✓") ? "primary" : "tertiary"}>
                {error}
              </dl-text>
            )}
            <dl-button
              variant="primary"
              size="md"
              full-width
              disabled={loading || isRedirecting || undefined}
              onClick={handleSubmit}
            >
              {isRedirecting
                ? "Redirecting..."
                : loading
                ? "..."
                : isForgotPassword
                ? "Send Reset Email"
                : isSignUp
                ? "Sign Up"
                : "Sign In"}
            </dl-button>
          </dl-stack>
        </form>

        <div className="cl-dlite-text-center cl-dlite-sem-mt-400">
          {isForgotPassword ? (
            <dl-button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsForgotPassword(false);
                setError("");
                setEmail("");
                setPassword("");
              }}
            >
              Back to Sign In
            </dl-button>
          ) : (
            <>
              <dl-button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError("");
                  setEmail("");
                  setPassword("");
                }}
              >
                {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
              </dl-button>
              <div className="cl-dlite-sem-mt-300">
                <dl-button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsForgotPassword(true);
                    setError("");
                    setEmail("");
                    setPassword("");
                  }}
                >
                  Forgot password?
                </dl-button>
              </div>
            </>
          )}
        </div>

        <div className="cl-dlite-text-center cl-dlite-sem-mt-600">
          <dl-button variant="ghost" size="sm" onClick={() => router.push("/")}>
            &larr; Back
          </dl-button>
        </div>
      </div>
    </main>
  );
}
