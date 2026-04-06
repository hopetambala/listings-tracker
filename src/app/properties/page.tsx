"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { getEventValue } from "@/dlite-design-system/wc-helpers";
import { formatPrice } from "@/lib/formatters";

type Property = Database["public"]["Tables"]["listings_tracker_properties"]["Row"];
type Photo = Database["public"]["Tables"]["listings_tracker_photos"]["Row"];

export default function UserProperties() {
  const [code, setCode] = useState("");
  const [properties, setProperties] = useState<Property[]>([]);
  const [heroImages, setHeroImages] = useState<Record<string, string>>({});
  const [latestPrices, setLatestPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();
  const [newLink, setNewLink] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    const stored = localStorage.getItem("listings_tracker_session");
    if (!stored) {
      router.push("/");
      return;
    }
    try {
      const { code: storedCode, expiry } = JSON.parse(stored);
      if (Date.now() > expiry) {
        localStorage.removeItem("listings_tracker_session");
        router.push("/");
        return;
      }
      setCode(storedCode);
      const { data: codeRows, error: codeError } = await supabase
        .from("listings_tracker_access_codes")
        .select("property_id")
        .eq("code", storedCode);
      if (codeError || !codeRows || codeRows.length === 0) {
        console.error("Code lookup error:", codeError, "Rows:", codeRows);
        setError("Invalid code. Please check your code and try again.");
        setLoading(false);
        return;
      }
      const propertyIds = codeRows.map((r) => r.property_id);
      const { data: propsData, error: propError } = await supabase
        .from("listings_tracker_properties")
        .select("*")
        .in("id", propertyIds)
        .order("created_at", { ascending: false });
      if (propError || !propsData) {
        setError("Failed to load properties. Please try again.");
        setLoading(false);
        return;
      }
      setProperties(propsData);
      const heroMap: Record<string, string> = {};
      const pricesMap: Record<string, number> = {};
      await Promise.all(
        propsData.map(async (prop) => {
          // Prefer the key photo; fall back to first by display_order
          const { data: keyPhotoData } = await supabase
            .from("listings_tracker_photos")
            .select("photo_url")
            .eq("property_id", prop.id)
            .eq("is_key_photo", true)
            .limit(1);
          if (keyPhotoData && keyPhotoData.length > 0) {
            heroMap[prop.id] = keyPhotoData[0].photo_url;
          } else {
            const { data: photosData } = await supabase
              .from("listings_tracker_photos")
              .select("photo_url")
              .eq("property_id", prop.id)
              .order("display_order", { ascending: true })
              .limit(1);
            if (photosData && photosData.length > 0) {
              heroMap[prop.id] = photosData[0].photo_url;
            }
          }
          
          const { data: pricesData } = await supabase
            .from("listings_tracker_prices")
            .select("price")
            .eq("property_id", prop.id)
            .order("recorded_at", { ascending: false })
            .limit(1);
          if (pricesData && pricesData.length > 0) {
            pricesMap[prop.id] = pricesData[0].price;
          }
        })
      );
      setHeroImages(heroMap);
      setLatestPrices(pricesMap);
    } catch (err) {
      console.error("Error loading properties:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load properties";
      setError(errorMessage);
      setLoading(false);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, supabase]);

  const handleAddProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!newLink.trim() || !newPrice.trim()) {
      setFormError("Both fields are required.");
      return;
    }
    const priceNum = Number(newPrice.replace(/[^\d.]/g, ""));
    if (isNaN(priceNum) || priceNum <= 0) {
      setFormError("Price must be a positive number.");
      return;
    }
    setSubmitting(true);
    try {
      // 1. Get admin_id for this code
      const { data: codeRows, error: codeErr } = await supabase
        .from("listings_tracker_access_codes")
        .select("created_by, code")
        .eq("code", code)
        .limit(1)
        .maybeSingle();
      if (codeErr || !codeRows) {
        setFormError("Could not find admin for this code.");
        setSubmitting(false);
        return;
      }
      const admin_id = codeRows.created_by;
      // 2. Insert property
      const { data: prop, error: propErr } = await supabase
        .from("listings_tracker_properties")
        .insert({
          admin_id,
          listing_link: newLink,
          listing_price: priceNum,
        })
        .select()
        .maybeSingle();
      if (propErr || !prop) {
        setFormError("Failed to add property.");
        setSubmitting(false);
        return;
      }
      // 3. Insert access code for new property
      const { error: codeInsertErr } = await supabase
        .from("listings_tracker_access_codes")
        .insert({
          property_id: prop.id,
          code,
          created_by: admin_id,
        });
      if (codeInsertErr) {
        setFormError("Failed to link property to code.");
        setSubmitting(false);
        return;
      }
      setNewLink("");
      setNewPrice("");
      await loadData();
    } catch (err) {
      console.error("Error adding property:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to add property";
      setFormError(errorMessage);
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <main className="page page--centered">
        <dl-spinner />
      </main>
    );
  }

  if (error) {
    return (
      <main className="page page--centered">
        <div className="cl-dlite-text-center">
          <dl-heading level={2}>Something went wrong</dl-heading>
          <dl-text color="secondary" style={{ margin: "1rem 0", display: "block" }}>{error}</dl-text>
          <dl-button
            variant="primary"
            size="md"
            onClick={() => {
              localStorage.removeItem("listings_tracker_session");
              router.push("/");
            }}
          >
            Try a Different Code
          </dl-button>
        </div>
      </main>
    );
  }

  return (
    <main className="page page--centered">
      <div className="cl-dlite-w-full" style={{ maxWidth: "60rem", padding: "0 1rem" }}>
        <form onSubmit={handleAddProperty}>
          <div className="form-row" style={{ marginBottom: "2rem" }}>
            <div style={{ flex: 2 }}>
              <dl-input
                label="Listing Link"
                placeholder="https://www.zillow.com/..."
                value={newLink}
                onInput={(e: any) => setNewLink(getEventValue(e))}
                required
              />
            </div>
            <div style={{ flex: 1 }}>
              <dl-input
                label="Listing Price"
                placeholder="450000"
                value={newPrice}
                onInput={(e: any) => setNewPrice(getEventValue(e))}
                required
                type="number"
                min="0"
              />
            </div>
            <dl-button
              variant="primary"
              size="md"
              disabled={submitting}
              onClick={async (e: any) => {
                e.preventDefault?.();
                await handleAddProperty(e as any);
              }}
            >
              {submitting ? "Adding..." : "Add Listing"}
            </dl-button>
          </div>
        </form>
        {formError && (
          <dl-text color="danger" style={{ marginBottom: "1rem" }}>{formError}</dl-text>
        )}
        {properties.length === 0 ? (
          <dl-card>
            <div style={{ padding: "2rem", textAlign: "center" }}>
              <dl-text color="secondary">No properties available with this code.</dl-text>
            </div>
          </dl-card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {properties.map((prop) => (
              <dl-card key={prop.id} style={{ cursor: "pointer" }}
                onClick={(e: React.MouseEvent<HTMLElement>) => {
                  // Only navigate if the click is not on a link/button
                  if (
                    e.target instanceof HTMLElement &&
                    (e.target.closest('a') || e.target.closest('button'))
                  ) {
                    return;
                  }
                  router.push(`/property/${prop.id}`);
                }}>
                {heroImages[prop.id] && (
                  <img
                    src={heroImages[prop.id]}
                    alt={prop.street_address || "Property"}
                    style={{
                      width: "100%",
                      height: "220px",
                      objectFit: "cover",
                      display: "block",
                      borderRadius: "var(--tk-dlite-semantic-border-radius-md) var(--tk-dlite-semantic-border-radius-md) 0 0",
                    }}
                  />
                )}
                <div style={{ padding: "1.5rem" }}>
                  <dl-heading level={3}>{prop.street_address || "No address"}</dl-heading>
                  <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                    <dl-text color="secondary" size="300">
                      MLS: {prop.mls_number || "N/A"} | Listed at: ${formatPrice(prop.listing_price)}
                    </dl-text>
                    {latestPrices[prop.id] && latestPrices[prop.id] !== prop.listing_price && (
                      <div style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.5rem 1rem",
                        backgroundColor: latestPrices[prop.id] > prop.listing_price ? "#dcfce7" : "#fecaca",
                        borderRadius: "9999px",
                        border: `2px solid ${latestPrices[prop.id] > prop.listing_price ? "#22c55e" : "#f87171"}`,
                      }}>
                        <span style={{ fontSize: "0.75rem", fontWeight: "600", color: latestPrices[prop.id] > prop.listing_price ? "#16a34a" : "#991b1b", textTransform: "uppercase" }}>
                          {latestPrices[prop.id] > prop.listing_price ? "↑ Increased" : "↓ Reduced"}
                        </span>
                        <span style={{ fontSize: "0.9rem", fontWeight: "700", color: latestPrices[prop.id] > prop.listing_price ? "#16a34a" : "#991b1b" }}>
                          ${formatPrice(latestPrices[prop.id])}
                          {" "}
                          ({latestPrices[prop.id] > prop.listing_price ? "+" : "-"}${formatPrice(Math.abs(latestPrices[prop.id] - prop.listing_price))} / {((latestPrices[prop.id] - prop.listing_price) / prop.listing_price * 100).toFixed(1)}%)
                        </span>
                      </div>
                    )}
                  </div>
                  {prop.listing_link && (
                    <dl-button
                      variant="primary"
                      size="sm"
                      onClick={(e: React.MouseEvent<HTMLElement>) => {
                        e.stopPropagation();
                        window.open(prop.listing_link, '_blank');
                      }}
                      style={{ marginTop: "0.75rem" }}
                    >
                      View Real Estate Listing ↗
                    </dl-button>
                  )}
                  {prop.notes && (
                    <dl-text size="300" style={{ marginTop: "0.5rem" }}>
                      {prop.notes}
                    </dl-text>
                  )}
                </div>
              </dl-card>
            ))}
          </div>
        )}

        <div className="cl-dlite-text-center cl-dlite-sem-mt-600">
          <dl-button
            variant="ghost"
            size="sm"
            onClick={() => {
              localStorage.removeItem("listings_tracker_session");
              router.push("/");
            }}
          >
            Sign Out
          </dl-button>
        </div>
      </div>
    </main>
  );
}
