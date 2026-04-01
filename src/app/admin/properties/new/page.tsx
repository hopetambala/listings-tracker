"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { generateCode } from "@/lib/api/code-utils";
import { getEventValue } from "@/dlite-design-system/wc-helpers";

export default function NewProperty() {
  const [user, setUser] = useState<any>(null);
  const [listing_link, setListing_link] = useState("");
  const [street_address, setStreet_address] = useState("");
  const [mls_number, setMls_number] = useState("");
  const [listing_price, setListing_price] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/admin");
        return;
      }
      setUser(user);
      setLoading(false);
    }
    checkAuth();
  }, [router, supabase.auth]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    if (!listing_link || !listing_price) {
      setError("Listing link and price are required");
      setSaving(false);
      return;
    }

    try {
      const code = generateCode();

      // Insert property
      const { data: propData, error: propError } = await supabase
        .from("listings_tracker_properties")
        .insert({
          admin_id: user.id,
          listing_link,
          street_address: street_address || null,
          mls_number: mls_number || null,
          listing_price: parseFloat(listing_price),
          notes: notes || null,
        })
        .select()
        .single();

      if (propError) throw propError;

      // Insert code
      const { error: codeError } = await supabase
        .from("listings_tracker_access_codes")
        .insert({
          property_id: propData.id,
          code,
          created_by: user.id,
        });

      if (codeError) throw codeError;

      // Show code to admin
      alert(`Property created! Your 4-digit code is: ${code}`);
      router.push("/admin/properties");
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="page page--centered">
        <dl-spinner />
      </main>
    );
  }

  return (
    <main className="page page--centered">
      <div className="cl-dlite-w-full" style={{ maxWidth: "40rem" }}>
        <dl-heading level={1} className="cl-dlite-sem-mb-600">
          Create Property
        </dl-heading>

        <form onSubmit={handleSubmit}>
          <dl-stack direction="vertical" gap="400">
            <div>
              <dl-text size="300" color="secondary">Listing Link *</dl-text>
              <dl-input
                type="url"
                placeholder="https://www.zillow.com/..."
                value={listing_link}
                required
                style={{ marginTop: "0.5rem" }}
                onInput={(e: any) => setListing_link(getEventValue(e))}
              />
            </div>

            <div>
              <dl-text size="300" color="secondary">Street Address</dl-text>
              <dl-input
                type="text"
                placeholder="123 Main St"
                value={street_address}
                style={{ marginTop: "0.5rem" }}
                onInput={(e: any) => setStreet_address(getEventValue(e))}
              />
            </div>

            <div>
              <dl-text size="300" color="secondary">MLS Number</dl-text>
              <dl-input
                type="text"
                placeholder="MLS123456"
                value={mls_number}
                style={{ marginTop: "0.5rem" }}
                onInput={(e: any) => setMls_number(getEventValue(e))}
              />
            </div>

            <div>
              <dl-text size="300" color="secondary">Listing Price *</dl-text>
              <dl-input
                type="number"
                placeholder="450000"
                value={listing_price}
                required
                style={{ marginTop: "0.5rem" }}
                onInput={(e: any) => setListing_price(getEventValue(e))}
              />
            </div>

            <div>
              <dl-text size="300" color="secondary">Notes</dl-text>
              <dl-textarea
                placeholder="Any additional notes..."
                value={notes}
                style={{ marginTop: "0.5rem", minHeight: "100px" }}
                onInput={(e: any) => setNotes(getEventValue(e))}
              />
            </div>

            {error && <dl-text size="300" color="tertiary">{error}</dl-text>}

            <div style={{ display: "flex", gap: "1rem" }}>
              <dl-button
                variant="primary"
                size="md"
                full-width
                disabled={saving || undefined}
                onClick={handleSubmit}
              >
                {saving ? "Creating..." : "Create Property"}
              </dl-button>
              <dl-button
                variant="secondary"
                size="md"
                full-width
                onClick={() => router.push("/admin/properties")}
              >
                Cancel
              </dl-button>
            </div>
          </dl-stack>
        </form>
      </div>
    </main>
  );
}
