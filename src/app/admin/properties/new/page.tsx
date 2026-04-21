"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { generateCode } from "@/lib/api/code-utils";
import { getEventValue, WcInputEvent } from "@/dlite-design-system/wc-helpers";
import { toast } from "@/components/Toast";
import { selectBase } from "@/components/formControlStyles";

export default function NewProperty() {
  const [_user, setUser] = useState<any>(null);
  const [listing_link, setListing_link] = useState("");
  const [street_address, setStreet_address] = useState("");
  const [mls_number, setMls_number] = useState("");
  const [listing_price, setListing_price] = useState("");
  const [status, setStatus] = useState("active");
  const [notes, setNotes] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [square_feet, setSquare_feet] = useState("");
  const [year_built, setYear_built] = useState("");
  const [existingCode, setExistingCode] = useState("");
  const [existingCodes, setExistingCodes] = useState<string[]>([]);
  const [target_price, setTarget_price] = useState("");
  const [buyer_label, setBuyer_label] = useState("");
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

      // Load existing codes for this admin
      const { data: codesData } = await supabase
        .from("listings_tracker_access_codes")
        .select("code")
        .eq("created_by", user.id);

      if (codesData) {
        const unique = [...new Set(codesData.map((c) => c.code))];
        setExistingCodes(unique);
      }

      setLoading(false);
    }
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // Use existing code or generate a new one
      const trimmedCode = existingCode.trim();
      const code = trimmedCode || generateCode();
      const isNewCode = !trimmedCode;

      // Insert property
      const { data: propData, error: propError } = await supabase
        .from("listings_tracker_properties")
        .insert({
          admin_id: _user.id,
          listing_link,
          street_address: street_address || null,
          mls_number: mls_number || null,
          listing_price: parseFloat(listing_price),
          status,
          notes: notes || null,
          bedrooms: bedrooms ? parseInt(bedrooms, 10) : null,
          bathrooms: bathrooms ? parseFloat(bathrooms) : null,
          square_feet: square_feet ? parseInt(square_feet, 10) : null,
          year_built: year_built ? parseInt(year_built, 10) : null,
          listed_at: new Date().toISOString().slice(0, 10),
        })
        .select()
        .single();

      if (propError) throw propError;

      // Insert code row. When creating a brand-new code, stamp target_price + buyer_label
      // so the buyer dashboard can show budget context.
      const codeInsert: {
        property_id: string;
        code: string;
        created_by: string;
        target_price?: number | null;
        buyer_label?: string | null;
      } = {
        property_id: propData.id,
        code,
        created_by: _user.id,
      };
      if (isNewCode) {
        codeInsert.target_price = target_price ? parseFloat(target_price) : null;
        codeInsert.buyer_label = buyer_label.trim() || null;
      }
      const { error: codeError } = await supabase
        .from("listings_tracker_access_codes")
        .insert(codeInsert);

      if (codeError) throw codeError;

      toast.success(`Property created. Code: ${code}`);
      router.push("/admin/properties");
    } catch (err: any) {
      setError(err.message);
      toast.error("Couldn't create property.");
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
                onInput={(e: WcInputEvent) => setListing_link(getEventValue(e))}
              />
            </div>

            <div>
              <dl-text size="300" color="secondary">Street Address</dl-text>
              <dl-input
                type="text"
                placeholder="123 Main St"
                value={street_address}
                style={{ marginTop: "0.5rem" }}
                onInput={(e: WcInputEvent) => setStreet_address(getEventValue(e))}
              />
            </div>

            <div>
              <dl-text size="300" color="secondary">MLS Number</dl-text>
              <dl-input
                type="text"
                placeholder="MLS123456"
                value={mls_number}
                style={{ marginTop: "0.5rem" }}
                onInput={(e: WcInputEvent) => setMls_number(getEventValue(e))}
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
                onInput={(e: WcInputEvent) => setListing_price(getEventValue(e))}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem" }}>
              <div>
                <dl-text size="300" color="secondary">Bedrooms</dl-text>
                <dl-input
                  type="number"
                  placeholder="3"
                  value={bedrooms}
                  style={{ marginTop: "0.5rem" }}
                  onInput={(e: WcInputEvent) => setBedrooms(getEventValue(e))}
                />
              </div>
              <div>
                <dl-text size="300" color="secondary">Bathrooms</dl-text>
                <dl-input
                  type="number"
                  placeholder="2.5"
                  value={bathrooms}
                  style={{ marginTop: "0.5rem" }}
                  onInput={(e: WcInputEvent) => setBathrooms(getEventValue(e))}
                />
              </div>
              <div>
                <dl-text size="300" color="secondary">Square feet</dl-text>
                <dl-input
                  type="number"
                  placeholder="1850"
                  value={square_feet}
                  style={{ marginTop: "0.5rem" }}
                  onInput={(e: WcInputEvent) => setSquare_feet(getEventValue(e))}
                />
              </div>
              <div>
                <dl-text size="300" color="secondary">Year built</dl-text>
                <dl-input
                  type="number"
                  placeholder="1995"
                  value={year_built}
                  style={{ marginTop: "0.5rem" }}
                  onInput={(e: WcInputEvent) => setYear_built(getEventValue(e))}
                />
              </div>
            </div>

            <div>
              <dl-text size="300" color="secondary">Status</dl-text>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{ ...selectBase, marginTop: "0.5rem", width: "100%" }}
              >
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="sold">Sold</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </div>

            <div>
              <dl-text size="300" color="secondary">Notes</dl-text>
              <dl-textarea
                placeholder="Any additional notes..."
                value={notes}
                style={{ marginTop: "0.5rem", minHeight: "100px" }}
                onInput={(e: WcInputEvent) => setNotes(getEventValue(e))}
              />
            </div>

            <div>
              <dl-text size="300" color="secondary">Access Code</dl-text>
              <dl-text size="200" color="secondary" style={{ display: "block", marginBottom: "0.5rem" }}>
                Leave blank to generate a new code, or enter an existing code to group with other listings
              </dl-text>
              <dl-input
                type="text"
                placeholder="e.g. 1234 (leave blank for new code)"
                value={existingCode}
                style={{ marginTop: "0.25rem" }}
                onInput={(e: WcInputEvent) => {
                  const val = getEventValue(e).replace(/\D/g, "").slice(0, 4);
                  setExistingCode(val);
                }}
              />
              {existingCodes.length > 0 && (
                <div style={{ marginTop: "0.5rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  <dl-text size="200" color="secondary">Existing codes:</dl-text>
                  {existingCodes.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setExistingCode(c)}
                      style={{
                        padding: "0.125rem 0.5rem",
                        background: existingCode === c ? "#007AFF" : "#f0f0f0",
                        color: existingCode === c ? "white" : "#333",
                        border: "none",
                        borderRadius: "0.25rem",
                        cursor: "pointer",
                        fontSize: "0.875rem",
                        fontFamily: "monospace",
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {!existingCode.trim() && (
              <div style={{ padding: "1rem", background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: "0.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <dl-text size="300" color="secondary" style={{ fontWeight: 600 }}>
                  For this new code (optional)
                </dl-text>
                <div>
                  <dl-text size="300" color="secondary">Buyer label</dl-text>
                  <dl-input
                    type="text"
                    placeholder="e.g. The Johnsons"
                    value={buyer_label}
                    style={{ marginTop: "0.5rem" }}
                    onInput={(e: WcInputEvent) => setBuyer_label(getEventValue(e))}
                  />
                </div>
                <div>
                  <dl-text size="300" color="secondary">Target price / budget</dl-text>
                  <dl-input
                    type="number"
                    placeholder="e.g. 950000"
                    value={target_price}
                    style={{ marginTop: "0.5rem" }}
                    onInput={(e: WcInputEvent) => setTarget_price(getEventValue(e))}
                  />
                </div>
              </div>
            )}

            {error && <dl-text size="300" color="danger">{error}</dl-text>}

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
