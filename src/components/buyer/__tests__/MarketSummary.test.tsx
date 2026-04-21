import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MarketSummary } from "@/components/buyer/MarketSummary";
import type { MarketSummary as MarketSummaryData } from "@/lib/pricing";

function mkSummary(overrides: Partial<MarketSummaryData> = {}): MarketSummaryData {
  return {
    soldCount: 0,
    activeCount: 0,
    avgOverAskPct: null,
    medianPricePerSqft: null,
    countInRange: null,
    countOverBudget: null,
    ...overrides,
  };
}

describe("<MarketSummary />", () => {
  it("renders nothing when there are no metrics to show", () => {
    const { container } = render(<MarketSummary summary={mkSummary()} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows avg over ask with sign and sold count", () => {
    const { container } = render(
      <MarketSummary summary={mkSummary({ avgOverAskPct: 7.2, soldCount: 5 })} />
    );
    expect(container.textContent).toMatch(/\+7\.2%/);
    expect(container.textContent).toMatch(/across 5 sold/);
  });

  it("shows median $/sqft formatted with commas", () => {
    const { container } = render(
      <MarketSummary summary={mkSummary({ medianPricePerSqft: 512.7, soldCount: 3 })} />
    );
    expect(container.textContent).toMatch(/\$513/);
  });

  it("shows in-range and over-budget counts when targetPrice is set", () => {
    const { container } = render(
      <MarketSummary
        summary={mkSummary({ countInRange: 2, countOverBudget: 4 })}
        targetPrice={950_000}
      />
    );
    expect(container.textContent).toMatch(/In your range/);
    expect(container.textContent).toMatch(/Over budget/);
    expect(container.textContent).toMatch(/at or under \$950,000/);
    expect(container.textContent).toMatch(/more than 5% over \$950,000/);
  });

  it("hides budget counts when targetPrice is missing", () => {
    const { container } = render(
      <MarketSummary summary={mkSummary({ countInRange: 2, countOverBudget: 4 })} />
    );
    expect(container.textContent).not.toMatch(/In your range/);
    expect(container.textContent).not.toMatch(/Over budget/);
  });

  it("renders buyer label and budget line when provided", () => {
    const { container } = render(
      <MarketSummary
        summary={mkSummary({ avgOverAskPct: 0, soldCount: 1 })}
        buyerLabel="The Johnsons"
        targetPrice={950_000}
      />
    );
    expect(container.textContent).toMatch(/The Johnsons/);
    expect(container.textContent).toMatch(/Budget \$950,000/);
  });
});
