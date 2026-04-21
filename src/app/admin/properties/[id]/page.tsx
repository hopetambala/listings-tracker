"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { getEventValue, WcInputEvent } from "@/dlite-design-system/wc-helpers";
import { toast } from "@/components/Toast";

type Property = Database["public"]["Tables"]["listings_tracker_properties"]["Row"];

export default function EditProperty() {
  const [_user, setUser] = useState<any>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [listing_link, setListing_link] = useState("");
  const [street_address, setStreet_address] = useState("");
  const [mls_number, setMls_number] = useState("");
  const [listing_price, setListing_price] = useState("");
  const [sold_price, setSold_price] = useState("");
  const [status, setStatus] = useState("active");
  const [notes, setNotes] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [square_feet, setSquare_feet] = useState("");
  const [year_built, setYear_built] = useState("");
  const [listed_at, setListed_at] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const params = useParams();
  const propertyId = params.id as string;
  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/admin");
        return;
      }
      setUser(user);

      const { data, error } = await supabase
        .from("listings_tracker_properties")
        .select("*")
        .eq("id", propertyId)
        .eq("admin_id", user.id)
        .single();

      if (error || !data) {
        router.push("/admin/properties");
        return;
      }

      setProperty(data);
      setListing_link(data.listing_link);
      setStreet_address(data.street_address || "");
      setMls_number(data.mls_number || "");
      setListing_price(String(data.listing_price));
      setSold_price(data.sold_price ? String(data.sold_price) : "");
      setStatus(data.status ?? "active");
      setNotes(data.notes || "");
      setBedrooms(data.bedrooms != null ? String(data.bedrooms) : "");
      setBathrooms(data.bathrooms != null ? String(data.bathrooms) : "");
      setSquare_feet(data.square_feet != null ? String(data.square_feet) : "");
      setYear_built(data.year_built != null ? String(data.year_built) : "");
      setListed_at(data.listed_at || "");
      setLoading(false);
    }
    loadData();
  }, [router, supabase, propertyId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const { error } = await supabase
        .from("listings_tracker_properties")
        .update({
          listing_link,
          street_address: street_address || null,
          mls_number: mls_number || null,
          listing_price: parseFloat(listing_price),
          sold_price: sold_price ? parseFloat(sold_price) : null,
          status,
          notes: notes || null,
          bedrooms: bedrooms ? parseInt(bedrooms, 10) : null,
          bathrooms: bathrooms ? parseFloat(bathrooms) : null,
          square_feet: square_feet ? parseInt(square_feet, 10) : null,
          year_built: year_built ? parseInt(year_built, 10) : null,
          listed_at: listed_at || null,
        })
        .eq("id", propertyId);

      if (error) throw error;
      toast.success("Property saved.");
      router.push("/admin/properties");
    } catch (err: any) {
      setError(err.message);
      toast.error("Couldn't save property.");
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
          Edit Property
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

            <div>
              <dl-text size="300" color="secondary">Sold Price</dl-text>
              <dl-input
                type="number"
                placeholder="425000"
                value={sold_price}
                style={{ marginTop: "0.5rem" }}
                onInput={(e: WcInputEvent) => setSold_price(getEventValue(e))}
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
              <dl-text size="300" color="secondary">Listed on</dl-text>
              <input
                type="date"
                value={listed_at}
                onChange={(e) => setListed_at(e.target.value)}
                style={{ marginTop: "0.5rem", width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #e5e7eb", borderRadius: "0.375rem", fontSize: "0.875rem", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <dl-text size="300" color="secondary">Status</dl-text>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{ marginTop: "0.5rem", width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #e5e7eb", borderRadius: "0.375rem", fontSize: "0.875rem" }}
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

            {error && <dl-text size="300" color="tertiary">{error}</dl-text>}

            <div style={{ display: "flex", gap: "1rem" }}>
              <dl-button
                variant="primary"
                size="md"
                full-width
                disabled={saving || undefined}
                onClick={handleSubmit}
              >
                {saving ? "Saving..." : "Save Changes"}
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
