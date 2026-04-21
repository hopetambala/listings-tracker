import type { Database } from "@/lib/supabase/types";

type Price = Database["public"]["Tables"]["listings_tracker_prices"]["Row"];

interface SparklineProps {
  prices: readonly Price[];
  width?: number;
  height?: number;
  ariaLabel?: string;
}

export function Sparkline({ prices, width = 80, height = 24, ariaLabel }: SparklineProps) {
  if (prices.length < 2) return null;

  const sorted = [...prices].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );
  const vals = sorted.map((p) => p.price);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const PAD = 2;

  const pts = sorted
    .map((p, i) => {
      const x = PAD + (i / (sorted.length - 1)) * (width - PAD * 2);
      const y = PAD + (1 - (p.price - min) / range) * (height - PAD * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const isUp = sorted[sorted.length - 1].price >= sorted[0].price;
  const color = isUp ? "#16a34a" : "#dc2626";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={ariaLabel ?? "Price trend sparkline"}
      style={{ display: "block" }}
    >
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
