"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { formatPrice } from "@/lib/formatters";
import {
  originalListPrice,
  currentListPrice,
  overAskPct,
  budgetDelta,
  daysOnMarket,
  pricePerSqft,
} from "@/lib/pricing";

type Property = Database["public"]["Tables"]["listings_tracker_properties"]["Row"];
type Price = Database["public"]["Tables"]["listings_tracker_prices"]["Row"];
type Photo = Database["public"]["Tables"]["listings_tracker_photos"]["Row"];

interface ComparisonColumn {
  property: Property;
  prices: Price[];
  heroUrl: string | null;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <div
        className="cl-dlite-sem-py-300 cl-dlite-sem-px-400 cl-dlite-sem-bg-sunken cl-dlite-sem-border-b"
        style={{
          fontSize: "0.75rem",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: "#475569",
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      {children}
    </>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="cl-dlite-sem-py-300 cl-dlite-sem-px-400 cl-dlite-sem-border-b"
      style={{ fontSize: "0.875rem", background: "white" }}
    >
      {children}
    </div>
  );
}

export default function CompareListings() {
  return (
    <Suspense
      fallback={
        <main className="page page--centered" suppressHydrationWarning>
          <dl-spinner />
        </main>
      }
    >
      <CompareListingsInner />
    </Suspense>
  );
}

function CompareListingsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [columns, setColumns] = useState<ComparisonColumn[]>([]);
  const [targetPrice, setTargetPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const idsParam = searchParams.get("ids") ?? "";
  const requestedIds = idsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  useEffect(() => {
    async function load() {
      if (requestedIds.length < 2) {
        setError("Pick at least 2 listings to compare.");
        setLoading(false);
        return;
      }
      const stored = localStorage.getItem("listings_tracker_session");
      if (!stored) {
        router.push("/");
        return;
      }
      const { code, expiry } = JSON.parse(stored);
      if (Date.now() > expiry) {
        localStorage.removeItem("listings_tracker_session");
        router.push("/");
        return;
      }

      const { data: codeRows } = await supabase
        .from("listings_tracker_access_codes")
        .select("property_id, target_price")
        .eq("code", code);
      if (!codeRows || codeRows.length === 0) {
        setError("Invalid code.");
        setLoading(false);
        return;
      }
      const allowedIds = new Set(codeRows.map((r) => r.property_id));
      const allowed = requestedIds.filter((id) => allowedIds.has(id));
      if (allowed.length < 2) {
        setError("Not enough listings available to compare.");
        setLoading(false);
        return;
      }

      const meta = codeRows.find((r) => r.target_price != null);
      if (meta) setTargetPrice(meta.target_price ?? null);

      const [{ data: properties }, { data: allPrices }, { data: allPhotos }] = await Promise.all([
        supabase.from("listings_tracker_properties").select("*").in("id", allowed),
        supabase
          .from("listings_tracker_prices")
          .select("*")
          .in("property_id", allowed)
          .order("recorded_at", { ascending: false }),
        supabase
          .from("listings_tracker_photos")
          .select("*")
          .in("property_id", allowed)
          .order("display_order", { ascending: true }),
      ]);

      const pricesByProp: Record<string, Price[]> = {};
      for (const p of allPrices ?? []) (pricesByProp[p.property_id] ??= []).push(p);

      const photosByProp: Record<string, Photo[]> = {};
      for (const p of allPhotos ?? []) (photosByProp[p.property_id] ??= []).push(p);

      const ordered = allowed
        .map((id) => (properties ?? []).find((p) => p.id === id))
        .filter((p): p is Property => p != null);

      setColumns(
        ordered.map((property) => {
          const photos = photosByProp[property.id] ?? [];
          const key = photos.find((p) => p.is_key_photo);
          return {
            property,
            prices: pricesByProp[property.id] ?? [],
            heroUrl: (key ?? photos[0])?.photo_url ?? null,
          };
        })
      );
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsParam, router, supabase]);

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
          <dl-heading level={2}>Can&apos;t compare</dl-heading>
          <dl-text color="secondary" style={{ margin: "1rem 0", display: "block" }}>{error}</dl-text>
          <dl-button variant="primary" size="md" onClick={() => router.push("/properties")}>
            Back to listings
          </dl-button>
        </div>
      </main>
    );
  }

  const gridTemplate = `160px repeat(${columns.length}, minmax(200px, 1fr))`;

  return (
    <main className="page page--centered">
      <div className="cl-dlite-w-full" style={{ maxWidth: "72rem", padding: "0 1rem" }}>
        <div className="cl-dlite-flex cl-dlite-items-center cl-dlite-justify-between cl-dlite-flex-wrap cl-dlite-sem-gap-300 cl-dlite-sem-mb-600">
          <dl-heading level={1} style={{ margin: 0 }}>Compare {columns.length} listings</dl-heading>
          <dl-button variant="ghost" size="sm" onClick={() => router.push("/properties")}>
            ← Back
          </dl-button>
        </div>

        <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: "0.5rem" }}>
          <div style={{ minWidth: "min-content", display: "grid", gridTemplateColumns: gridTemplate }}>
            <Row label="Listing">
              {columns.map(({ property, heroUrl }) => (
                <Cell key={`head-${property.id}`}>
                  {heroUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={heroUrl}
                      alt={property.street_address ?? "Property hero"}
                      style={{ width: "100%", height: "120px", objectFit: "cover", borderRadius: "0.375rem", marginBottom: "0.5rem" }}
                    />
                  )}
                  <div style={{ fontWeight: 700 }}>
                    {property.street_address || "No address"}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.125rem" }}>
                    {property.status ?? "active"}
                    {property.mls_number ? ` · MLS ${property.mls_number}` : ""}
                  </div>
                </Cell>
              ))}
            </Row>

            <Row label="Original ask">
              {columns.map(({ property, prices }) => (
                <Cell key={`ask-${property.id}`}>
                  ${formatPrice(originalListPrice(prices, property))}
                </Cell>
              ))}
            </Row>

            <Row label="Current price">
              {columns.map(({ property, prices }) => (
                <Cell key={`cur-${property.id}`}>
                  ${formatPrice(currentListPrice(prices, property))}
                </Cell>
              ))}
            </Row>

            <Row label="Sold price">
              {columns.map(({ property, prices }) => {
                const sold = property.sold_price;
                if (sold == null) return <Cell key={`sold-${property.id}`}>—</Cell>;
                const pct = overAskPct(sold, originalListPrice(prices, property));
                return (
                  <Cell key={`sold-${property.id}`}>
                    ${formatPrice(sold)}
                    {pct != null && (
                      <div style={{ fontSize: "0.75rem", marginTop: "0.125rem", fontWeight: 600, color: pct >= 0 ? "#9a3412" : "#166534" }}>
                        {pct >= 0 ? "+" : ""}{pct.toFixed(1)}% {pct >= 0 ? "over" : "under"} ask
                      </div>
                    )}
                  </Cell>
                );
              })}
            </Row>

            {targetPrice != null && targetPrice > 0 && (
              <Row label={`vs. $${formatPrice(targetPrice)} budget`}>
                {columns.map(({ property, prices }) => {
                  const isSold = property.status === "sold" && property.sold_price != null;
                  const comparePrice = isSold ? (property.sold_price as number) : currentListPrice(prices, property);
                  const delta = budgetDelta(comparePrice, targetPrice);
                  if (!delta) return <Cell key={`budget-${property.id}`}>—</Cell>;
                  if (delta.state === "in_range") {
                    return <Cell key={`budget-${property.id}`}>In range (${formatPrice(Math.abs(delta.deltaDollars))} under)</Cell>;
                  }
                  if (delta.state === "stretch") {
                    return <Cell key={`budget-${property.id}`}>Stretch (+${formatPrice(delta.deltaDollars)})</Cell>;
                  }
                  return <Cell key={`budget-${property.id}`}>Over (+${formatPrice(delta.deltaDollars)})</Cell>;
                })}
              </Row>
            )}

            <Row label="$ / sqft">
              {columns.map(({ property, prices }) => {
                const ref = property.sold_price ?? currentListPrice(prices, property);
                const pps = pricePerSqft(ref, property.square_feet);
                return <Cell key={`pps-${property.id}`}>{pps != null ? `$${formatPrice(Math.round(pps))}` : "—"}</Cell>;
              })}
            </Row>

            <Row label="Beds / baths">
              {columns.map(({ property }) => (
                <Cell key={`bb-${property.id}`}>
                  {property.bedrooms ?? "—"} bd · {property.bathrooms ?? "—"} ba
                </Cell>
              ))}
            </Row>

            <Row label="Sqft / built">
              {columns.map(({ property }) => (
                <Cell key={`sb-${property.id}`}>
                  {property.square_feet ? `${formatPrice(property.square_feet)} sqft` : "— sqft"}
                  {" · "}
                  {property.year_built ?? "—"}
                </Cell>
              ))}
            </Row>

            <Row label="Days on market">
              {columns.map(({ property }) => {
                const dom = daysOnMarket(property.listed_at);
                return <Cell key={`dom-${property.id}`}>{dom != null ? `${dom} ${dom === 1 ? "day" : "days"}` : "—"}</Cell>;
              })}
            </Row>

            <Row label="Notes">
              {columns.map(({ property }) => (
                <Cell key={`notes-${property.id}`}>
                  <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", color: property.notes ? undefined : "#94a3b8" }}>
                    {property.notes || "—"}
                  </div>
                </Cell>
              ))}
            </Row>
          </div>
        </div>
      </div>
    </main>
  );
}
