import type { MouseEvent } from "react";
import type { Database } from "@/lib/supabase/types";
import { formatPrice } from "@/lib/formatters";
import {
  originalListPrice,
  currentListPrice,
  overAskPct,
  budgetDelta,
  daysOnMarket,
} from "@/lib/pricing";
import { Sparkline } from "@/components/buyer/Sparkline";

type Property = Database["public"]["Tables"]["listings_tracker_properties"]["Row"];
type Price = Database["public"]["Tables"]["listings_tracker_prices"]["Row"];

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

function Chip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "positive" | "warning" | "neutral" | "info";
}) {
  const palette = {
    positive: { bg: "#dcfce7", color: "#166534", border: "#86efac" },
    warning: { bg: "#fef3c7", color: "#92400e", border: "#fcd34d" },
    neutral: { bg: "#f3f4f6", color: "#374151", border: "#d1d5db" },
    info: { bg: "#dbeafe", color: "#1d4ed8", border: "#93c5fd" },
  }[tone];
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: "9999px",
      fontSize: "0.7rem",
      fontWeight: 700,
      letterSpacing: "0.04em",
      background: palette.bg,
      border: `1.5px solid ${palette.border}`,
      color: palette.color,
      whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}

interface ListingCardProps {
  property: Property;
  priceHistory: readonly Price[];
  heroImageUrl?: string | null;
  targetPrice?: number | null;
  onOpen: () => void;
  compareChecked?: boolean;
  compareDisabled?: boolean;
  onToggleCompare?: () => void;
}

export function ListingCard({
  property,
  priceHistory,
  heroImageUrl,
  targetPrice,
  onOpen,
  compareChecked,
  compareDisabled,
  onToggleCompare,
}: ListingCardProps) {
  const isSold = property.status === "sold" && property.sold_price != null;
  const originalAsk = originalListPrice(priceHistory, property);
  const current = currentListPrice(priceHistory, property);
  const comparePrice = isSold ? (property.sold_price as number) : current;
  const askDelta = isSold ? overAskPct(property.sold_price as number, originalAsk) : null;
  const budget = budgetDelta(comparePrice, targetPrice ?? null);
  const dom = daysOnMarket(property.listed_at);

  return (
    <dl-card
      style={{ cursor: "pointer" }}
      onClick={(e: MouseEvent<HTMLElement>) => {
        if (
          e.target instanceof HTMLElement &&
          (e.target.closest("a") || e.target.closest("button") || e.target.closest("select"))
        ) {
          return;
        }
        onOpen();
      }}
    >
      {heroImageUrl && (
        <div style={{ position: "relative" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImageUrl}
            alt={property.street_address ? `${property.street_address} hero photo` : "Property hero photo"}
            style={{
              width: "100%",
              height: "220px",
              objectFit: "cover",
              display: "block",
              borderRadius: "var(--tk-dlite-semantic-border-radius-md) var(--tk-dlite-semantic-border-radius-md) 0 0",
            }}
          />
          <div style={{ position: "absolute", top: "10px", left: "10px" }}>
            <StatusBadge status={property.status} />
          </div>
          {isSold && (
            <div style={{
              position: "absolute", top: "10px", right: "10px",
              background: "rgba(22,101,52,0.92)", color: "white",
              padding: "3px 12px", borderRadius: "9999px",
              fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em",
            }}>
              SOLD ${formatPrice(property.sold_price as number)}
            </div>
          )}
        </div>
      )}

      <div style={{ padding: "1.25rem 1.5rem" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
          <dl-heading level={3}>{property.street_address || "No address"}</dl-heading>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {!heroImageUrl && <StatusBadge status={property.status} />}
            {onToggleCompare && (
              <label
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  padding: "0.25rem 0.625rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: compareDisabled ? "#9ca3af" : "#374151",
                  border: `1.5px solid ${compareChecked ? "#0f172a" : "#e5e7eb"}`,
                  background: compareChecked ? "#0f172a" : "white",
                  borderRadius: "9999px",
                  cursor: compareDisabled ? "not-allowed" : "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={!!compareChecked}
                  disabled={compareDisabled}
                  onChange={(e) => {
                    e.stopPropagation();
                    onToggleCompare();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{ margin: 0 }}
                />
                <span style={{ color: compareChecked ? "white" : undefined }}>Compare</span>
              </label>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.625rem", alignItems: "center" }}>
          {askDelta != null && (
            <Chip tone={askDelta >= 0 ? "warning" : "positive"}>
              Sold {askDelta >= 0 ? "+" : ""}{askDelta.toFixed(1)}% {askDelta >= 0 ? "over" : "under"} ask
            </Chip>
          )}
          {budget && (
            <Chip tone={budget.state === "in_range" ? "positive" : budget.state === "stretch" ? "warning" : "warning"}>
              {budget.state === "in_range" && budget.deltaDollars === 0 && "At your budget"}
              {budget.state === "in_range" && budget.deltaDollars < 0 && `$${formatPrice(Math.abs(budget.deltaDollars))} (${Math.abs(budget.deltaPct).toFixed(1)}%) under budget`}
              {budget.state === "stretch" && `Stretch: +$${formatPrice(budget.deltaDollars)} (${budget.deltaPct.toFixed(1)}%)`}
              {budget.state === "over" && `$${formatPrice(budget.deltaDollars)} (${budget.deltaPct.toFixed(1)}%) over budget`}
            </Chip>
          )}
          {dom != null && !isSold && (
            <Chip tone="neutral">{dom} {dom === 1 ? "day" : "days"} on market</Chip>
          )}
        </div>

        <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <dl-text color="secondary" size="300">
            MLS: {property.mls_number || "N/A"} · Listed at ${formatPrice(originalAsk)}
            {current !== originalAsk && (
              <> · Now ${formatPrice(current)}</>
            )}
          </dl-text>
          {priceHistory.length >= 2 && (
            <Sparkline
              prices={priceHistory}
              ariaLabel={`Price trend for ${property.street_address || "property"}`}
            />
          )}
        </div>

        {property.listing_link && (
          <dl-button
            variant="primary"
            size="sm"
            onClick={(e: MouseEvent<HTMLElement>) => {
              e.stopPropagation();
              window.open(property.listing_link, "_blank");
            }}
            style={{ marginTop: "0.75rem" }}
          >
            View Real Estate Listing ↗
          </dl-button>
        )}
        {property.notes && (
          <dl-text size="300" style={{ marginTop: "0.5rem" }}>
            {property.notes}
          </dl-text>
        )}
      </div>
    </dl-card>
  );
}
