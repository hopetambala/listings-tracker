"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { getEventValue, WcInputEvent } from "@/dlite-design-system/wc-helpers";
import {
  budgetDelta,
  currentListPrice,
  marketSummary,
  type ListingBundle,
} from "@/lib/pricing";
import { MarketSummary } from "@/components/buyer/MarketSummary";
import { ListingCard } from "@/components/buyer/ListingCard";
import { EmptyState } from "@/components/EmptyState";
import { ListingCardSkeletonGrid, SummarySkeleton } from "@/components/Skeleton";
import { controlBase, selectBase } from "@/components/formControlStyles";

type Property = Database["public"]["Tables"]["listings_tracker_properties"]["Row"];
type Price = Database["public"]["Tables"]["listings_tracker_prices"]["Row"];
type Photo = Database["public"]["Tables"]["listings_tracker_photos"]["Row"];

type StatusFilter = "all" | "active" | "pending" | "sold" | "withdrawn";
type BudgetFilter = "all" | "in_range" | "stretch" | "over";
type SortBy = "date_desc" | "date_asc" | "price_asc" | "price_desc";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "sold", label: "Sold" },
  { value: "withdrawn", label: "Withdrawn" },
];

const BUDGET_FILTERS: { value: BudgetFilter; label: string }[] = [
  { value: "all", label: "Any budget" },
  { value: "in_range", label: "In range" },
  { value: "stretch", label: "Stretch" },
  { value: "over", label: "Over" },
];

function Chips<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={selected}
            className="lt-chip"
            data-selected={selected || undefined}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
            {opt.count != null && (
              <span className="lt-chip__count" aria-hidden="true">{opt.count}</span>
            )}
          </button>
        );
      })}
      <style>{`
        .lt-chip {
          padding: 0.45rem 1rem;
          border-radius: 9999px;
          font-size: 0.82rem;
          font-weight: 600;
          letter-spacing: 0.01em;
          border: 1.5px solid #e2e8f0;
          background: white;
          color: #334155;
          cursor: pointer;
          outline: none;
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          transition: transform 120ms cubic-bezier(0.4, 0, 0.2, 1), background 120ms, border-color 120ms, color 120ms, box-shadow 120ms;
        }
        .lt-chip__count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 1.5rem;
          padding: 0 0.4rem;
          height: 1.25rem;
          border-radius: 9999px;
          background: #e2e8f0;
          color: #475569;
          font-size: 0.72rem;
          font-weight: 700;
          line-height: 1;
        }
        .lt-chip[data-selected] .lt-chip__count {
          background: rgba(255, 255, 255, 0.2);
          color: white;
        }
        .lt-chip:hover {
          border-color: #0f172a;
          color: #0f172a;
          transform: translateY(-1px);
        }
        .lt-chip:active { transform: translateY(0); }
        .lt-chip[data-selected] {
          background: #0f172a;
          border-color: #0f172a;
          color: white;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.25);
        }
        .lt-chip[data-selected]:hover {
          background: #1e293b;
          border-color: #1e293b;
          transform: translateY(-1px);
        }
        .lt-chip:focus-visible {
          box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.25);
        }
        .lt-chip[data-selected]:focus-visible {
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.25), 0 0 0 3px rgba(15, 23, 42, 0.25);
        }
      `}</style>
    </div>
  );
}

export default function UserProperties() {
  return (
    <Suspense
      fallback={
        <main className="page page--centered" suppressHydrationWarning>
          <dl-spinner />
        </main>
      }
    >
      <UserPropertiesInner />
    </Suspense>
  );
}

function UserPropertiesInner() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [photosByProperty, setPhotosByProperty] = useState<Record<string, Photo[]>>({});
  const [pricesByProperty, setPricesByProperty] = useState<Record<string, Price[]>>({});
  const [targetPrice, setTargetPrice] = useState<number | null>(null);
  const [buyerLabel, setBuyerLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [sortBy, setSortBy] = useState<SortBy>(
    (searchParams.get("sort") as SortBy) || "date_desc"
  );
  const [filterStatus, setFilterStatus] = useState<StatusFilter>(
    (searchParams.get("status") as StatusFilter) || "all"
  );
  const [filterBudget, setFilterBudget] = useState<BudgetFilter>(
    (searchParams.get("budget") as BudgetFilter) || "all"
  );
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [newLink, setNewLink] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Sync filter state to the URL (shallow, no history entry)
  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (filterStatus !== "all") params.set("status", filterStatus);
    if (filterBudget !== "all") params.set("budget", filterBudget);
    if (sortBy !== "date_desc") params.set("sort", sortBy);
    const qs = params.toString();
    router.replace(qs ? `/properties?${qs}` : "/properties", { scroll: false });
  }, [query, filterStatus, filterBudget, sortBy, router]);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  }, []);

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
        .select("property_id, target_price, buyer_label")
        .eq("code", storedCode);
      if (codeError || !codeRows || codeRows.length === 0) {
        setError("Invalid code. Please check your code and try again.");
        setLoading(false);
        return;
      }

      const codeMeta = codeRows.find((r) => r.target_price != null || r.buyer_label != null) ?? codeRows[0];
      setTargetPrice(codeMeta.target_price ?? null);
      setBuyerLabel(codeMeta.buyer_label ?? null);

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

      // Bulk-fetch all photos and prices for these properties in 2 queries total.
      const [{ data: allPhotos }, { data: allPrices }] = await Promise.all([
        supabase
          .from("listings_tracker_photos")
          .select("*")
          .in("property_id", propertyIds)
          .order("display_order", { ascending: true }),
        supabase
          .from("listings_tracker_prices")
          .select("*")
          .in("property_id", propertyIds)
          .order("recorded_at", { ascending: false }),
      ]);

      const photos: Record<string, Photo[]> = {};
      for (const photo of allPhotos ?? []) {
        (photos[photo.property_id] ??= []).push(photo);
      }
      setPhotosByProperty(photos);

      const prices: Record<string, Price[]> = {};
      for (const price of allPrices ?? []) {
        (prices[price.property_id] ??= []).push(price);
      }
      setPricesByProperty(prices);
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

      const { data: codeRow, error: codeRowError } = await supabase
        .from("listings_tracker_access_codes")
        .select("created_by")
        .eq("code", storedCode)
        .limit(1)
        .single();
      if (codeRowError || !codeRow) throw new Error("Could not resolve access code owner.");
      const admin_id = codeRow.created_by;

      const { data: propData, error: propError } = await supabase
        .from("listings_tracker_properties")
        .insert({
          admin_id,
          listing_link: newLink,
          street_address: newAddress || null,
          listing_price: parseFloat(newPrice),
          status: "active",
        })
        .select()
        .single();

      if (propError) throw propError;

      const { error: codeInsertError } = await supabase
        .from("listings_tracker_access_codes")
        .insert({ property_id: propData.id, code: storedCode, created_by: admin_id });

      if (codeInsertError) throw codeInsertError;

      setNewLink("");
      setNewAddress("");
      setNewPrice("");
      await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to add listing.");
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
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((p) =>
        [p.street_address, p.notes, p.mls_number]
          .filter(Boolean)
          .some((field) => (field as string).toLowerCase().includes(q))
      );
    }
    if (filterBudget !== "all" && targetPrice && targetPrice > 0) {
      list = list.filter((p) => {
        const history = pricesByProperty[p.id] ?? [];
        const isSold = p.status === "sold" && p.sold_price != null;
        const comparePrice = isSold ? (p.sold_price as number) : currentListPrice(history, p);
        const delta = budgetDelta(comparePrice, targetPrice);
        return delta?.state === filterBudget;
      });
    }
    switch (sortBy) {
      case "price_asc":  list.sort((a, b) => a.listing_price - b.listing_price); break;
      case "price_desc": list.sort((a, b) => b.listing_price - a.listing_price); break;
      case "date_asc":   list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()); break;
      case "date_desc":  list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
    }
    return list;
  }, [properties, filterStatus, filterBudget, query, sortBy, pricesByProperty, targetPrice]);

  const summary = useMemo(() => {
    let scoped = properties;
    if (filterStatus !== "all") {
      scoped = scoped.filter((p) => (p.status ?? "active") === filterStatus);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      scoped = scoped.filter((p) =>
        [p.street_address, p.notes, p.mls_number]
          .filter(Boolean)
          .some((field) => (field as string).toLowerCase().includes(q))
      );
    }
    const bundles: ListingBundle[] = scoped.map((property) => ({
      property,
      priceHistory: pricesByProperty[property.id] ?? [],
    }));
    return marketSummary(bundles, targetPrice);
  }, [properties, filterStatus, query, pricesByProperty, targetPrice]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { active: 0, pending: 0, sold: 0, withdrawn: 0 };
    for (const p of properties) {
      const s = p.status ?? "active";
      counts[s] = (counts[s] ?? 0) + 1;
    }
    return counts;
  }, [properties]);

  const heroFor = (propertyId: string): string | null => {
    const photos = photosByProperty[propertyId] ?? [];
    const key = photos.find((p) => p.is_key_photo);
    return (key ?? photos[0])?.photo_url ?? null;
  };

  if (loading) {
    return (
      <main className="page page--centered" suppressHydrationWarning>
        <div className="cl-dlite-w-full" style={{ maxWidth: "60rem", padding: "0 1rem" }}>
          <div style={{ marginBottom: "1.5rem" }}>
            <dl-heading level={1} style={{ margin: 0 }}>Your Listings</dl-heading>
          </div>
          <SummarySkeleton />
          <ListingCardSkeletonGrid count={3} />
        </div>
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

        <div className="cl-dlite-flex cl-dlite-items-center cl-dlite-justify-between cl-dlite-flex-wrap cl-dlite-sem-gap-300 cl-dlite-sem-mb-600">
          <div className="cl-dlite-flex cl-dlite-items-center cl-dlite-sem-gap-300">
            <dl-heading level={1} style={{ margin: 0 }}>Your Listings</dl-heading>
            <span
              aria-label={`Showing ${displayedProperties.length} of ${properties.length} listings`}
              style={{
                fontSize: "0.78rem",
                fontWeight: 600,
                color: "#0f172a",
                background: "#e2e8f0",
                borderRadius: "9999px",
                padding: "3px 12px",
                letterSpacing: "0.01em",
              }}
            >
              {displayedProperties.length} <span style={{ color: "#64748b", fontWeight: 500 }}>of {properties.length}</span>
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

        {properties.length > 0 && (
          <MarketSummary
            summary={summary}
            buyerLabel={buyerLabel}
            targetPrice={targetPrice}
            filterStatus={filterStatus}
            query={query}
          />
        )}

        {properties.length > 0 && (
          <div
            className="lt-sticky-filters"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              marginBottom: "1.5rem",
              position: "sticky",
              top: 0,
              zIndex: 10,
              padding: "1rem 1.25rem",
              background: "rgba(255,255,255,0.96)",
              backdropFilter: "blur(10px) saturate(140%)",
              WebkitBackdropFilter: "blur(10px) saturate(140%)",
              boxShadow: "0 1px 0 rgba(15, 23, 42, 0.06), 0 8px 16px -12px rgba(15, 23, 42, 0.12)",
              borderRadius: "0.75rem",
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "stretch" }}>
              <div style={{ position: "relative", flex: "1 1 200px", display: "flex" }}>
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: "0.75rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#64748b",
                    pointerEvents: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.75" />
                    <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search address, notes, or MLS…"
                  aria-label="Search listings"
                  style={{ ...controlBase, paddingLeft: "2.25rem", width: "100%" }}
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                aria-label="Sort listings"
                style={selectBase}
              >
                <option value="date_desc">Newest first</option>
                <option value="date_asc">Oldest first</option>
                <option value="price_asc">Price: low → high</option>
                <option value="price_desc">Price: high → low</option>
              </select>
            </div>
            <Chips<StatusFilter>
              value={filterStatus}
              options={STATUS_FILTERS.map((o) => ({
                ...o,
                count: o.value === "all" ? properties.length : statusCounts[o.value] ?? 0,
              }))}
              onChange={setFilterStatus}
              ariaLabel="Filter by status"
            />
            {targetPrice != null && targetPrice > 0 && (
              <Chips<BudgetFilter>
                value={filterBudget}
                options={BUDGET_FILTERS}
                onChange={setFilterBudget}
                ariaLabel="Filter by budget fit"
              />
            )}
            <style>{`
              .lt-sticky-filters input[type="search"]::-webkit-search-cancel-button {
                appearance: none;
                height: 14px;
                width: 14px;
                background: #94a3b8;
                -webkit-mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='M4 4l8 8M12 4l-8 8' stroke='black' stroke-width='1.75' stroke-linecap='round'/></svg>") no-repeat center / contain;
                          mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='M4 4l8 8M12 4l-8 8' stroke='black' stroke-width='1.75' stroke-linecap='round'/></svg>") no-repeat center / contain;
                cursor: pointer;
                margin-right: 0.25rem;
              }
              .lt-sticky-filters input[type="search"]:focus {
                border-color: #0f172a;
                outline: none;
                box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.12);
              }
              .lt-sticky-filters select:focus {
                border-color: #0f172a;
                outline: none;
                box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.12);
              }
            `}</style>
          </div>
        )}

        <dl-card className="cl-dlite-sem-mb-500">
          <form onSubmit={handleAddProperty} style={{ padding: "1.25rem 1.5rem" }}>
            <dl-text size="300" color="secondary" className="cl-dlite-block cl-dlite-sem-mb-300" style={{ fontWeight: 600 }}>
              Add a Listing
            </dl-text>
            <div className="cl-dlite-flex cl-dlite-flex-wrap cl-dlite-items-end cl-dlite-sem-gap-300">
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
              <dl-text size="300" color="danger" className="cl-dlite-block cl-dlite-sem-mt-200">
                {formError}
              </dl-text>
            )}
          </form>
        </dl-card>

        {displayedProperties.length === 0 ? (
          properties.length === 0 ? (
            <EmptyState
              icon="🏠"
              title="No listings here yet"
              description="When your agent adds properties to this code, they'll appear here with price and market context."
            />
          ) : (
            <EmptyState
              icon="🔎"
              title="Nothing matches"
              description="Try clearing filters or the search to see more."
              action={
                <dl-button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setQuery("");
                    setFilterStatus("all");
                    setFilterBudget("all");
                  }}
                >
                  Clear filters
                </dl-button>
              }
            />
          )
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", paddingBottom: selectedIds.length >= 2 ? "5rem" : 0 }}>
            {displayedProperties.map((prop) => (
              <ListingCard
                key={prop.id}
                property={prop}
                priceHistory={pricesByProperty[prop.id] ?? []}
                heroImageUrl={heroFor(prop.id)}
                targetPrice={targetPrice}
                onOpen={() => router.push(`/property/${prop.id}`)}
                compareChecked={selectedIds.includes(prop.id)}
                compareDisabled={selectedIds.length >= 4 && !selectedIds.includes(prop.id)}
                onToggleCompare={() => toggleSelected(prop.id)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedIds.length >= 2 && (
        <div
          role="region"
          aria-label="Compare selected listings"
          style={{
            position: "fixed",
            bottom: "1rem",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: "0.625rem",
            alignItems: "center",
            padding: "0.625rem 0.875rem",
            background: "#0f172a",
            color: "white",
            borderRadius: "9999px",
            boxShadow: "0 12px 32px rgba(15, 23, 42, 0.35)",
            zIndex: 50,
          }}
        >
          <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
            {selectedIds.length} selected
          </span>
          <button
            type="button"
            onClick={() => router.push(`/properties/compare?ids=${selectedIds.join(",")}`)}
            style={{
              padding: "0.4rem 0.9rem",
              borderRadius: "9999px",
              border: "none",
              background: "white",
              color: "#0f172a",
              fontWeight: 700,
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            Compare ({selectedIds.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            style={{
              padding: "0.4rem 0.75rem",
              borderRadius: "9999px",
              border: "1px solid rgba(255,255,255,0.5)",
              background: "transparent",
              color: "white",
              fontSize: "0.8rem",
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        </div>
      )}
    </main>
  );
}
