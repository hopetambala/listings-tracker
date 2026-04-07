"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { formatPrice } from "@/lib/formatters";
import { getEventValue, WcInputEvent } from "@/dlite-design-system/wc-helpers";

type Property = Database["public"]["Tables"]["listings_tracker_properties"]["Row"];

const STATUS_STYLES: Record<string, { bg: string; border: string; color: string; label: string }> = {
  active:    { bg: "#dbeafe", border: "#3b82f6", color: "#1d4ed8", label: "Active" },
  pending:   { bg: "#fef3c7", border: "#f59e0b", color: "#92400e", label: "Pending" },
  sold:      { bg: "#dcfce7", border: "#22c55e", color: "#166534", label: "Sold" },
  withdrawn: { bg: "#f3f4f6", border: "#9ca3af", color: "#374151", label: "Withdrawn" },
};

function StatusBadge({ status }: { status: string | null }) {
  const s = STATUS_STYLES[status ?? "active"] ?? STATUS_STYLES.active;
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: "9999px",
      fontSize: "0.7rem",
      fontWeight: 700,
      letterSpacing: "0.05em",
      textTransform: "uppercase",
      background: s.bg,
      border: `1.5px solid ${s.border}`,
      color: s.color,
    }}>
      {s.label}
    </span>
  );
}

export default function UserProperties() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [heroImages, setHeroImages] = useState<Record<string, string>>({});
  const [latestPrices, setLatestPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "price_asc" | "price_desc">("date_desc");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [newLink, setNewLink] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const router = useRouter();
  const supabase = createClient();

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
      const { data: codeRows, error: codeError } = await supabase
        .from("listings_tracker_access_codes")
        .select("property_id")
        .eq("code", storedCode);
      if (codeError || !codeRows || codeRows.length === 0) {
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
          // Prefer key photo; fall back to first by display_order
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
      const errorMessage = err instanceof Error ? err.message : "Failed to load properties";
      setError(errorMessage);
    }
    setLoading(false);
  };

  async function handleAddProperty(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!newLink || !newPrice) {
      setFormError("Listing link and price are required.");
      return;
    }
    setSubmitting(true);
    try {
      const stored = localStorage.getItem("listings_tracker_session");
      if (!stored) { router.push("/"); return; }
      const { code: storedCode } = JSON.parse(stored);

      const { data: propData, error: propError } = await supabase
        .from("listings_tracker_properties")
        .insert({
          listing_link: newLink,
          street_address: newAddress || null,
          listing_price: parseFloat(newPrice),
          status: "active",
        })
        .select()
        .single();

      if (propError) throw propError;

      const { error: codeError } = await supabase
        .from("listings_tracker_access_codes")
        .insert({ property_id: propData.id, code: storedCode });

      if (codeError) throw codeError;

      setNewLink("");
      setNewAddress("");
      setNewPrice("");
      await loadData();
    } catch (err: any) {
      setFormError(err.message);
    }
    setSubmitting(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, supabase]);

  const displayedProperties = useMemo(() => {
    let list = [...properties];
    if (filterStatus !== "all") {
      list = list.filter((p) => (p.status ?? "active") === filterStatus);
    }
    switch (sortBy) {
      case "price_asc":  list.sort((a, b) => a.listing_price - b.listing_price); break;
      case "price_desc": list.sort((a, b) => b.listing_price - a.listing_price); break;
      case "date_asc":   list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()); break;
      case "date_desc":  list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
    }
    return list;
  }, [properties, filterStatus, sortBy]);

  if (loading) {
    return (
      <main className="page page--centered" suppressHydrationWarning>
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

        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <dl-heading level={1} style={{ margin: 0 }}>Your Listings</dl-heading>
            <span style={{ fontSize: "0.8rem", color: "#6b7280", background: "#f3f4f6", borderRadius: "9999px", padding: "2px 10px" }}>
              {displayedProperties.length} of {properties.length}
            </span>
          </div>
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

        {/* Sort & filter controls */}
        {properties.length > 0 && (
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ padding: "0.4rem 0.75rem", border: "1px solid #e5e7eb", borderRadius: "0.375rem", fontSize: "0.875rem", background: "white" }}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="sold">Sold</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              style={{ padding: "0.4rem 0.75rem", border: "1px solid #e5e7eb", borderRadius: "0.375rem", fontSize: "0.875rem", background: "white" }}
            >
              <option value="date_desc">Newest first</option>
              <option value="date_asc">Oldest first</option>
              <option value="price_asc">Price: low → high</option>
              <option value="price_desc">Price: high → low</option>
            </select>
          </div>
        )}

        {/* Add property form */}
        <dl-card style={{ marginBottom: "1.25rem" }}>
          <form onSubmit={handleAddProperty} style={{ padding: "1.25rem 1.5rem" }}>
            <dl-text size="300" color="secondary" style={{ display: "block", marginBottom: "0.75rem", fontWeight: 600 }}>
              Add a Listing
            </dl-text>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: "2 1 200px" }}>
                <dl-input
                  label="Listing Link"
                  type="url"
                  placeholder="Listing URL *"
                  value={newLink}
                  required
                  onInput={(e: WcInputEvent) => setNewLink(getEventValue(e))}
                />
              </div>
              <div style={{ flex: "1 1 140px" }}>
                <dl-input
                  type="text"
                  placeholder="Address"
                  value={newAddress}
                  onInput={(e: WcInputEvent) => setNewAddress(getEventValue(e))}
                />
              </div>
              <div style={{ flex: "1 1 120px" }}>
                <dl-input
                  type="number"
                  placeholder="Price *"
                  value={newPrice}
                  required
                  onInput={(e: WcInputEvent) => setNewPrice(getEventValue(e))}
                />
              </div>
              <dl-button variant="primary" size="sm" disabled={submitting || undefined} onClick={handleAddProperty}>
                {submitting ? "Adding..." : "Add"}
              </dl-button>
            </div>
            {formError && (
              <dl-text size="300" color="danger" style={{ display: "block", marginTop: "0.5rem" }}>
                {formError}
              </dl-text>
            )}
          </form>
        </dl-card>

        {displayedProperties.length === 0 ? (
          <dl-card>
            <div style={{ padding: "2rem", textAlign: "center" }}>
              <dl-text color="secondary">
                {properties.length === 0 ? "No properties available with this code." : "No properties match the current filter."}
              </dl-text>
            </div>
          </dl-card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {displayedProperties.map((prop) => (
              <dl-card
                key={prop.id}
                style={{ cursor: "pointer" }}
                onClick={(e: React.MouseEvent<HTMLElement>) => {
                  if (e.target instanceof HTMLElement && (e.target.closest("a") || e.target.closest("button") || e.target.closest("select"))) return;
                  router.push(`/property/${prop.id}`);
                }}
              >
                {heroImages[prop.id] && (
                  <div style={{ position: "relative" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
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
                    {/* Status badge over image */}
                    <div style={{ position: "absolute", top: "10px", left: "10px" }}>
                      <StatusBadge status={prop.status} />
                    </div>
                    {prop.sold_price && (
                      <div style={{
                        position: "absolute", top: "10px", right: "10px",
                        background: "rgba(22,101,52,0.92)", color: "white",
                        padding: "3px 12px", borderRadius: "9999px",
                        fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em",
                      }}>
                        SOLD ${formatPrice(prop.sold_price)}
                      </div>
                    )}
                  </div>
                )}
                <div style={{ padding: "1.5rem" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
                    <dl-heading level={3}>{prop.street_address || "No address"}</dl-heading>
                    {!heroImages[prop.id] && <StatusBadge status={prop.status} />}
                  </div>
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
                        window.open(prop.listing_link, "_blank");
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
      </div>
    </main>
  );
}
