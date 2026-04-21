import { formatPrice } from "@/lib/formatters";
import type { MarketSummary as MarketSummaryData } from "@/lib/pricing";

interface MarketSummaryProps {
  summary: MarketSummaryData;
  buyerLabel?: string | null;
  targetPrice?: number | null;
}

interface Stat {
  label: string;
  value: string;
  tone: "neutral" | "positive" | "warning";
  sub?: string;
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
    stats.push({
      label: "In your range",
      value: `${summary.countInRange}`,
      tone: "positive",
      sub: `at or under $${formatPrice(targetPrice)}`,
    });
  }

  if (summary.countOverBudget != null && targetPrice) {
    stats.push({
      label: "Over budget",
      value: `${summary.countOverBudget}`,
      tone: "warning",
      sub: `more than 5% over $${formatPrice(targetPrice)}`,
    });
  }

  return stats;
}

const TONE_STYLES: Record<Stat["tone"], { valueColor: string; borderColor: string }> = {
  neutral: { valueColor: "#0f172a", borderColor: "#e2e8f0" },
  positive: { valueColor: "#166534", borderColor: "#bbf7d0" },
  warning: { valueColor: "#9a3412", borderColor: "#fed7aa" },
};

export function MarketSummary({ summary, buyerLabel, targetPrice }: MarketSummaryProps) {
  const stats = buildStats(summary, targetPrice);
  if (stats.length === 0) return null;

  return (
    <section
      aria-label="Market summary"
      style={{
        marginBottom: "1.5rem",
      }}
    >
      {(buyerLabel || targetPrice) && (
        <div style={{ marginBottom: "0.5rem" }}>
          <dl-text size="300" color="secondary">
            {buyerLabel ? `${buyerLabel} · ` : ""}
            {targetPrice ? `Budget $${formatPrice(targetPrice)}` : ""}
          </dl-text>
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fit, minmax(160px, 1fr))`,
          gap: "0.75rem",
        }}
      >
        {stats.map((stat) => {
          const tone = TONE_STYLES[stat.tone];
          return (
            <div
              key={stat.label}
              style={{
                padding: "0.875rem 1rem",
                background: "white",
                border: `1.5px solid ${tone.borderColor}`,
                borderRadius: "var(--tk-dlite-semantic-border-radius-md, 8px)",
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              <dl-text size="300" color="secondary" style={{ fontSize: "0.75rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>
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
