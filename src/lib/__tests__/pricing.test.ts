import { describe, it, expect } from "vitest";
import type { Database } from "@/lib/supabase/types";
import {
  originalListPrice,
  currentListPrice,
  overAskPct,
  budgetDelta,
  daysOnMarket,
  pricePerSqft,
  marketSummary,
} from "@/lib/pricing";

type Property = Database["public"]["Tables"]["listings_tracker_properties"]["Row"];
type Price = Database["public"]["Tables"]["listings_tracker_prices"]["Row"];

function mkProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: "p1",
    admin_id: "a1",
    listing_link: "https://example.com",
    street_address: "123 Main St",
    mls_number: null,
    listing_price: 900_000,
    sold_price: null,
    notes: null,
    status: "active",
    bedrooms: null,
    bathrooms: null,
    square_feet: null,
    year_built: null,
    listed_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function mkPrice(recorded_at: string, price: number): Price {
  return {
    id: `price-${recorded_at}`,
    property_id: "p1",
    price,
    recorded_at,
    recorded_by: null,
    created_at: recorded_at,
  };
}

describe("originalListPrice", () => {
  it("falls back to property.listing_price when no history", () => {
    expect(originalListPrice([], { listing_price: 800_000 })).toBe(800_000);
  });

  it("returns the earliest history entry regardless of array order", () => {
    const prices = [
      mkPrice("2026-03-01T00:00:00Z", 900_000),
      mkPrice("2026-01-01T00:00:00Z", 850_000),
      mkPrice("2026-02-01T00:00:00Z", 875_000),
    ];
    expect(originalListPrice(prices, { listing_price: 999_999 })).toBe(850_000);
  });

  it("handles single-entry history", () => {
    expect(originalListPrice([mkPrice("2026-01-01T00:00:00Z", 700_000)], { listing_price: 1 })).toBe(700_000);
  });
});

describe("currentListPrice", () => {
  it("falls back to listing_price when no history", () => {
    expect(currentListPrice([], { listing_price: 800_000 })).toBe(800_000);
  });

  it("returns the latest history entry", () => {
    const prices = [
      mkPrice("2026-03-01T00:00:00Z", 950_000),
      mkPrice("2026-01-01T00:00:00Z", 850_000),
    ];
    expect(currentListPrice(prices, { listing_price: 1 })).toBe(950_000);
  });
});

describe("overAskPct", () => {
  it("returns signed percent over ask", () => {
    expect(overAskPct(1_080_000, 1_000_000)).toBe(8);
  });

  it("returns negative when sold below ask", () => {
    expect(overAskPct(980_000, 1_000_000)).toBe(-2);
  });

  it("returns 0 when sold matches ask", () => {
    expect(overAskPct(1_000_000, 1_000_000)).toBe(0);
  });

  it("guards divide-by-zero", () => {
    expect(overAskPct(1_000_000, 0)).toBeNull();
  });
});

describe("budgetDelta", () => {
  it("is null when target is missing or non-positive", () => {
    expect(budgetDelta(900_000, null)).toBeNull();
    expect(budgetDelta(900_000, 0)).toBeNull();
    expect(budgetDelta(900_000, undefined)).toBeNull();
  });

  it("is in_range when price is at or below target", () => {
    expect(budgetDelta(950_000, 950_000)).toEqual({ state: "in_range", deltaDollars: 0 });
    expect(budgetDelta(900_000, 950_000)).toEqual({ state: "in_range", deltaDollars: -50_000 });
  });

  it("is stretch when 0-5% over target", () => {
    expect(budgetDelta(975_000, 950_000)).toEqual({ state: "stretch", deltaDollars: 25_000 });
  });

  it("is over when >5% above target", () => {
    const result = budgetDelta(1_050_000, 950_000);
    expect(result?.state).toBe("over");
    expect(result?.deltaDollars).toBe(100_000);
  });
});

describe("daysOnMarket", () => {
  it("returns null when listed_at is missing", () => {
    expect(daysOnMarket(null)).toBeNull();
    expect(daysOnMarket(undefined)).toBeNull();
  });

  it("returns whole-day count between listed_at and endDate", () => {
    expect(daysOnMarket("2026-01-01", "2026-01-15")).toBe(14);
  });

  it("returns null when end is before start", () => {
    expect(daysOnMarket("2026-03-01", "2026-01-01")).toBeNull();
  });
});

describe("pricePerSqft", () => {
  it("divides price by sqft", () => {
    expect(pricePerSqft(1_000_000, 2_000)).toBe(500);
  });

  it("returns null for missing or zero sqft", () => {
    expect(pricePerSqft(1_000_000, null)).toBeNull();
    expect(pricePerSqft(1_000_000, 0)).toBeNull();
  });
});

describe("marketSummary", () => {
  it("returns nulls for budget fields when target is not set", () => {
    const summary = marketSummary(
      [{ property: mkProperty(), priceHistory: [] }],
      null
    );
    expect(summary.countInRange).toBeNull();
    expect(summary.countOverBudget).toBeNull();
  });

  it("computes avg over-ask across sold listings", () => {
    const listings = [
      {
        property: mkProperty({ id: "a", status: "sold", sold_price: 1_080_000, listing_price: 1_000_000 }),
        priceHistory: [mkPrice("2026-01-01T00:00:00Z", 1_000_000)],
      },
      {
        property: mkProperty({ id: "b", status: "sold", sold_price: 980_000, listing_price: 1_000_000 }),
        priceHistory: [mkPrice("2026-01-01T00:00:00Z", 1_000_000)],
      },
      {
        property: mkProperty({ id: "c", status: "active", listing_price: 950_000 }),
        priceHistory: [],
      },
    ];
    const summary = marketSummary(listings, null);
    expect(summary.soldCount).toBe(2);
    expect(summary.activeCount).toBe(1);
    expect(summary.avgOverAskPct).toBe(3);
  });

  it("counts in-range vs over-budget against target", () => {
    const listings = [
      {
        property: mkProperty({ id: "a", status: "active", listing_price: 900_000 }),
        priceHistory: [],
      },
      {
        property: mkProperty({ id: "b", status: "active", listing_price: 960_000 }),
        priceHistory: [],
      },
      {
        property: mkProperty({ id: "c", status: "sold", sold_price: 1_100_000, listing_price: 950_000 }),
        priceHistory: [],
      },
    ];
    const summary = marketSummary(listings, 950_000);
    expect(summary.countInRange).toBe(1);
    expect(summary.countOverBudget).toBe(1);
  });

  it("uses sold_price for budget comparison on sold listings", () => {
    const listings = [
      {
        property: mkProperty({ status: "sold", sold_price: 900_000, listing_price: 1_050_000 }),
        priceHistory: [],
      },
    ];
    const summary = marketSummary(listings, 950_000);
    expect(summary.countInRange).toBe(1);
  });

  it("computes median $/sqft from sold listings only", () => {
    const listings = [
      {
        property: mkProperty({ id: "a", status: "sold", sold_price: 800_000, square_feet: 2_000, listing_price: 1 }),
        priceHistory: [],
      },
      {
        property: mkProperty({ id: "b", status: "sold", sold_price: 1_200_000, square_feet: 2_000, listing_price: 1 }),
        priceHistory: [],
      },
      {
        property: mkProperty({ id: "c", status: "active", listing_price: 500_000, square_feet: 1_000 }),
        priceHistory: [],
      },
    ];
    const summary = marketSummary(listings, null);
    expect(summary.medianPricePerSqft).toBe(500);
  });

  it("leaves avgOverAskPct null when no sold listings have history", () => {
    const summary = marketSummary(
      [{ property: mkProperty({ status: "active" }), priceHistory: [] }],
      null
    );
    expect(summary.avgOverAskPct).toBeNull();
  });
});
