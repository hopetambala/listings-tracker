import { describe, it, expect } from "vitest";
import { parseCSV } from "@/lib/api/csv-parser";

describe("parseCSV", () => {
  it("fails clearly on empty input", () => {
    const result = parseCSV("");
    expect(result.success).toBe(false);
    expect(result.errors[0].error).toMatch(/empty/i);
  });

  it("fails when required columns are missing", () => {
    const csv = "street_address,mls_number\nFoo,Bar";
    const result = parseCSV(csv);
    expect(result.success).toBe(false);
    expect(result.errors.map((e) => e.error).join("|")).toMatch(/listing_link/);
    expect(result.errors.map((e) => e.error).join("|")).toMatch(/listing_price/);
  });

  it("parses a valid minimal CSV", () => {
    const csv = "listing_link,listing_price\nhttps://example.com/a,450000";
    const result = parseCSV(csv);
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].listing_link).toBe("https://example.com/a");
    expect(result.data[0].listing_price).toBe("450000");
  });

  it("handles quoted addresses containing commas (the bug that motivated papaparse)", () => {
    const csv = `listing_link,street_address,listing_price
https://example.com/a,"123 Main St, Unit 4",450000`;
    const result = parseCSV(csv);
    expect(result.success).toBe(true);
    expect(result.data[0].street_address).toBe("123 Main St, Unit 4");
  });

  it("rejects invalid URLs with row number", () => {
    const csv = `listing_link,listing_price
not-a-url,450000`;
    const result = parseCSV(csv);
    expect(result.success).toBe(false);
    expect(result.errors[0]).toMatchObject({ row: 2, error: expect.stringMatching(/valid URL/) });
  });

  it("rejects non-numeric prices", () => {
    const csv = `listing_link,listing_price
https://example.com/a,abc`;
    const result = parseCSV(csv);
    expect(result.success).toBe(false);
    expect(result.errors[0]).toMatchObject({ row: 2, error: expect.stringMatching(/positive number/) });
  });

  it("skips blank lines and preserves valid rows", () => {
    const csv = `listing_link,listing_price

https://example.com/a,450000

https://example.com/b,500000
`;
    const result = parseCSV(csv);
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
  });

  it("keeps optional columns that are present and omits blank values", () => {
    const csv = `listing_link,street_address,mls_number,listing_price,notes
https://example.com/a,123 Main,MLS123,450000,
https://example.com/b,,MLS456,500000,Great yard`;
    const result = parseCSV(csv);
    expect(result.success).toBe(true);
    expect(result.data[0].street_address).toBe("123 Main");
    expect(result.data[0].notes).toBeUndefined();
    expect(result.data[1].notes).toBe("Great yard");
    expect(result.data[1].street_address).toBeUndefined();
  });

  it("collects multiple row-level errors (not just first)", () => {
    const csv = `listing_link,listing_price
not-a-url,450000
https://example.com/a,abc`;
    const result = parseCSV(csv);
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(2);
    expect(result.errors.map((e) => e.row)).toEqual([2, 3]);
  });
});
