import { formatPrice } from "@/lib/formatters";
import type { MarketSummary as MarketSummaryData } from "@/lib/pricing";

interface MarketSummaryProps {
  summary: MarketSummaryData;
  buyerLabel?: string | null;
  targetPrice?: number | null;
  filterStatus?: string;
  query?: string;
}

interface Stat {
  label: string;
  value: string;
  tone: "neutral" | "positive" | "warning";
  sub?: string;
}

function formatMedianDelta(dollars: number | null, pct: number | null, direction: "under" | "over"): string | null {
  if (dollars == null || pct == null) return null;
  return `median $${formatPrice(Math.round(dollars))} (${pct.toFixed(1)}%) ${direction}`;
}

function buildStats(summary: MarketSummaryData, targetPrice?: number | null): Stat[] {
  const stats: Stat[] = [];

  if (summary.avgOverAskPct != null) {
    const pct = summary.avgOverAskPct;
    const sign = pct >= 0 ? "+" : "";
    stats.push({
      label: "Avg over ask",
      value: `${sign}${pct.toFixed(1)}%`,
      tone: pct > 0 ? "warning" : "positive",
      sub: `across ${summary.soldCount} sold`,
    });
  }

  if (summary.medianPricePerSqft != null) {
    stats.push({
      label: "Median $/sqft",
      value: `$${formatPrice(Math.round(summary.medianPricePerSqft))}`,
      tone: "neutral",
      sub: "from sold",
    });
  }

  if (summary.countInRange != null && targetPrice) {
    const medianPart = formatMedianDelta(summary.medianDollarsUnder, summary.medianPctUnder, "under");
    stats.push({
      label: "In your range",
      value: `${summary.countInRange}`,
      tone: "positive",
      sub: `at or under $${formatPrice(targetPrice)}${medianPart ? ` · ${medianPart}` : ""}`,
    });
  }

  if (summary.countStretch != null && summary.countStretch > 0 && targetPrice) {
    stats.push({
      label: "Near budget",
      value: `${summary.countStretch}`,
      tone: "warning",
      sub: `within 5% over $${formatPrice(targetPrice)}`,
    });
  }

  if (summary.countOverBudget != null && targetPrice) {
    const medianPart = formatMedianDelta(summary.medianDollarsOver, summary.medianPctOver, "over");
    stats.push({
      label: "Over budget",
      value: `${summary.countOverBudget}`,
      tone: "warning",
      sub: `more than 5% over $${formatPrice(targetPrice)}${medianPart ? ` · ${medianPart}` : ""}`,
    });
  }

  return stats;
}

const TONE_STYLES: Record<Stat["tone"], { valueColor: string; borderColor: string }> = {
  neutral: { valueColor: "#0f172a", borderColor: "#e2e8f0" },
  positive: { valueColor: "#166534", borderColor: "#bbf7d0" },
  warning: { valueColor: "#9a3412", borderColor: "#fed7aa" },
};

const STATUS_LABELS: Record<string, string> = {
  all: "All statuses",
  active: "Active",
  pending: "Pending",
  sold: "Sold",
  withdrawn: "Withdrawn",
};

export function MarketSummary({ summary, buyerLabel, targetPrice, filterStatus, query }: MarketSummaryProps) {
  const stats = buildStats(summary, targetPrice);
  if (stats.length === 0) return null;

  const trimmedQuery = query?.trim() ?? "";
  const showScope = (filterStatus && filterStatus !== "all") || trimmedQuery.length > 0;
  const statusLabel = filterStatus ? STATUS_LABELS[filterStatus] ?? filterStatus : "All statuses";

  return (
    <section aria-label="Market summary" className="cl-dlite-sem-mb-600">
      {(buyerLabel || targetPrice) && (
        <div className="cl-dlite-sem-mb-200">
          <dl-text size="300" color="secondary">
            {buyerLabel ? `${buyerLabel} · ` : ""}
            {targetPrice ? `Budget $${formatPrice(targetPrice)}` : ""}
          </dl-text>
        </div>
      )}
      {showScope && (
        <div className="cl-dlite-sem-mb-200">
          <dl-text size="300" color="secondary">
            Showing: {statusLabel}
            {trimmedQuery ? ` · matching "${trimmedQuery}"` : ""}
          </dl-text>
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "0.75rem",
        }}
      >
        {stats.map((stat) => {
          const tone = TONE_STYLES[stat.tone];
          return (
            <div
              key={stat.label}
              className="cl-dlite-flex cl-dlite-flex-col cl-dlite-sem-p-400 cl-dlite-sem-gap-100 cl-dlite-sem-rounded-md"
              style={{ background: "white", border: `1.5px solid ${tone.borderColor}` }}
            >
              <dl-text
                size="300"
                color="secondary"
                style={{ fontSize: "0.75rem", letterSpacing: "0.04em", textTransform: "uppercase" }}
              >
                {stat.label}
              </dl-text>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: tone.valueColor, lineHeight: 1.1 }}>
                {stat.value}
              </div>
              {stat.sub && (
                <dl-text size="300" color="secondary" style={{ fontSize: "0.75rem" }}>
                  {stat.sub}
                </dl-text>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
