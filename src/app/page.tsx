"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getEventValue } from "@/dlite-design-system/wc-helpers";

export default function Home() {
  const [code, setCode] = useState("");
  const [validating, setValidating] = useState(false);
  const [codeError, setCodeError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const stored = localStorage.getItem("listings_tracker_session");
    if (stored) {
      try {
        const { expiry } = JSON.parse(stored);
        if (Date.now() < expiry) {
          router.push("/properties");
          return;
        }
      } catch {
        localStorage.removeItem("listings_tracker_session");
      }
    }
  }, [router]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 4) return;

    setCodeError("");
    setValidating(true);
    try {
      const { data, error } = await supabase
        .from("listings_tracker_access_codes")
        .select("id")
        .eq("code", code)
        .limit(1);

      if (error || !data || data.length === 0) {
        setCodeError("Invalid code. Please check and try again.");
        setValidating(false);
        return;
      }

      const expiry = Date.now() + 24 * 60 * 60 * 1000;
      localStorage.setItem("listings_tracker_session", JSON.stringify({ code, expiry }));
      router.push("/properties");
    } catch {
      setCodeError("Something went wrong. Please try again.");
      setValidating(false);
    }
  }

  return (
    <main className="page page--centered">
      <div className="cl-dlite-text-center" style={{ padding: "0 1rem" }}>
        <dl-heading level={1} style={{ wordBreak: "break-word", fontSize: "clamp(1.5rem, 5vw, 2.5rem)" }}>
          Listings Tracker
        </dl-heading>
        <dl-text color="secondary">Enter your 4-digit access code to view listings</dl-text>
      </div>

      <form
        onSubmit={handleJoin}
        className="cl-dlite-flex cl-dlite-flex-col cl-dlite-items-center cl-dlite-sem-gap-400 cl-dlite-w-full"
        style={{ maxWidth: "20rem", padding: "0 1rem" }}
      >
        <dl-input
          type="text"
          placeholder="4-digit code"
          value={code}
          style={{ textAlign: "center", fontSize: "1.5rem", letterSpacing: "0.1em", width: "100%" }}
          onInput={(e: any) => {
            const val = getEventValue(e).replace(/\D/g, "");
            setCode(val.slice(0, 4));
            setCodeError("");
          }}
        />
        {codeError && (
          <dl-text color="danger" size="300" style={{ textAlign: "center" }}>
            {codeError}
          </dl-text>
        )}
        <dl-button
          variant="primary"
          full-width
          size="md"
          disabled={code.length !== 4 || validating || undefined}
          onClick={handleJoin}
        >
          {validating ? "Checking..." : "View Properties"}
        </dl-button>
      </form>

      <div style={{ maxWidth: "20rem", width: "100%", padding: "0 1rem" }} className="cl-dlite-w-full">
        <dl-divider orientation="horizontal" />
        <div className="cl-dlite-text-center cl-dlite-sem-mt-400">
          <dl-button variant="ghost" size="sm" onClick={() => router.push("/admin")}>
            Admin Login
          </dl-button>
        </div>
      </div>
    </main>
  );
}
