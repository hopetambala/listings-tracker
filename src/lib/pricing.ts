import type { Database } from "@/lib/supabase/types";

type Property = Database["public"]["Tables"]["listings_tracker_properties"]["Row"];
type Price = Database["public"]["Tables"]["listings_tracker_prices"]["Row"];

export type BudgetState = "in_range" | "stretch" | "over";

export interface BudgetDelta {
  state: BudgetState;
  deltaDollars: number;
}

export interface MarketSummary {
  soldCount: number;
  activeCount: number;
  avgOverAskPct: number | null;
  medianPricePerSqft: number | null;
  countInRange: number | null;
  countOverBudget: number | null;
}

export interface ListingBundle {
  property: Property;
  priceHistory: Price[];
}

const STRETCH_PCT = 0.05;

export function originalListPrice(
  history: readonly Price[],
  property: Pick<Property, "listing_price">
): number {
  if (history.length === 0) return property.listing_price;
  const earliest = history.reduce((earliest, p) =>
    new Date(p.recorded_at).getTime() < new Date(earliest.recorded_at).getTime() ? p : earliest
  );
  return earliest.price;
}

export function currentListPrice(
  history: readonly Price[],
  property: Pick<Property, "listing_price">
): number {
  if (history.length === 0) return property.listing_price;
  const latest = history.reduce((latest, p) =>
    new Date(p.recorded_at).getTime() > new Date(latest.recorded_at).getTime() ? p : latest
  );
  return latest.price;
}

export function overAskPct(soldPrice: number, originalAsk: number): number | null {
  if (!Number.isFinite(originalAsk) || originalAsk === 0) return null;
  return ((soldPrice - originalAsk) / originalAsk) * 100;
}

export function budgetDelta(price: number, target: number | null | undefined): BudgetDelta | null {
  if (target == null || !Number.isFinite(target) || target <= 0) return null;
  const deltaDollars = price - target;
  if (deltaDollars <= 0) return { state: "in_range", deltaDollars };
  if (deltaDollars / target <= STRETCH_PCT) return { state: "stretch", deltaDollars };
  return { state: "over", deltaDollars };
}

export function daysOnMarket(
  listedAt: string | null | undefined,
  endDate: string | Date | null = new Date()
): number | null {
  if (!listedAt) return null;
  const start = new Date(listedAt).getTime();
  const end = endDate ? new Date(endDate).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.floor((end - start) / 86_400_000);
}

export function pricePerSqft(price: number, sqft: number | null | undefined): number | null {
  if (!sqft || sqft <= 0) return null;
  return price / sqft;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function marketSummary(
  listings: readonly ListingBundle[],
  target: number | null | undefined
): MarketSummary {
  let soldCount = 0;
  let activeCount = 0;
  const overAskPcts: number[] = [];
  const ppsqfts: number[] = [];
  let inRange = 0;
  let overBudget = 0;

  for (const { property, priceHistory } of listings) {
    const isSold = property.status === "sold" && property.sold_price != null;
    if (isSold) {
      soldCount++;
      const ask = originalListPrice(priceHistory, property);
      const pct = overAskPct(property.sold_price as number, ask);
      if (pct != null) overAskPcts.push(pct);
      const pps = pricePerSqft(property.sold_price as number, property.square_feet);
      if (pps != null) ppsqfts.push(pps);
    } else {
      activeCount++;
    }

    if (target != null && target > 0) {
      const comparePrice = isSold ? (property.sold_price as number) : currentListPrice(priceHistory, property);
      const delta = budgetDelta(comparePrice, target);
      if (delta?.state === "in_range") inRange++;
      else if (delta?.state === "over") overBudget++;
    }
  }

  const avgOverAskPct =
    overAskPcts.length > 0 ? overAskPcts.reduce((a, b) => a + b, 0) / overAskPcts.length : null;

  return {
    soldCount,
    activeCount,
    avgOverAskPct,
    medianPricePerSqft: median(ppsqfts),
    countInRange: target != null && target > 0 ? inRange : null,
    countOverBudget: target != null && target > 0 ? overBudget : null,
  };
}
