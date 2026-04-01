import { NextRequest, NextResponse } from "next/server";

/**
 * Mock market data endpoint
 * In production, integrate with real APIs (Zillow, Redfin, etc.)
 */
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  const mls = request.nextUrl.searchParams.get("mls");

  if (!address && !mls) {
    return NextResponse.json(
      { error: "Must provide address or mls parameter" },
      { status: 400 }
    );
  }

  // Mock comparable sales data
  const mockComparables = [
    {
      address: address || "Similar Property 1",
      price: 450000,
      sqft: 2000,
      beds: 3,
      baths: 2,
    },
    {
      address: address || "Similar Property 2",
      price: 475000,
      sqft: 2100,
      beds: 3,
      baths: 2,
    },
    {
      address: address || "Similar Property 3",
      price: 425000,
      sqft: 1900,
      beds: 3,
      baths: 2,
    },
  ];

  const avgPrice = mockComparables.reduce((sum, c) => sum + c.price, 0) / mockComparables.length;
  const avgPricePerSqft = mockComparables.reduce((sum, c) => sum + (c.price / c.sqft), 0) / mockComparables.length;

  return NextResponse.json({
    comparables: mockComparables,
    avgPrice: Math.round(avgPrice),
    avgPricePerSqft: avgPricePerSqft.toFixed(2),
    avgDaysOnMarket: 45,
  });
}
