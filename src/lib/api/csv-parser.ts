/**
 * CSV parsing utilities for bulk property upload.
 *
 * Uses papaparse to correctly handle quoted fields (addresses containing
 * commas), escaped quotes, and CRLF line endings.
 */
import Papa from "papaparse";

export interface PropertyRow {
  listing_link: string;
  street_address?: string;
  mls_number?: string;
  listing_price: string;
  notes?: string;
}

export interface ParseResult {
  success: boolean;
  data: PropertyRow[];
  errors: { row: number; error: string }[];
}

const REQUIRED_COLUMNS = ["listing_link", "listing_price"] as const;
const OPTIONAL_COLUMNS = ["street_address", "mls_number", "notes"] as const;

export function parseCSV(csvText: string): ParseResult {
  const trimmed = csvText.trim();
  if (!trimmed) {
    return {
      success: false,
      data: [],
      errors: [{ row: 1, error: "CSV is empty." }],
    };
  }

  const parsed = Papa.parse<Record<string, string>>(trimmed, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase(),
    transform: (value) => value.trim(),
  });

  // Validate required headers
  const fields = parsed.meta.fields ?? [];
  const missing = REQUIRED_COLUMNS.filter((c) => !fields.includes(c));
  if (missing.length > 0) {
    return {
      success: false,
      data: [],
      errors: missing.map((c) => ({ row: 1, error: `Missing required column: ${c}` })),
    };
  }

  const data: PropertyRow[] = [];
  const errors: { row: number; error: string }[] = [];

  // papaparse row index starts at 0 for the first *data* row; header is row 1 for users.
  parsed.data.forEach((raw, index) => {
    const rowNum = index + 2;
    const listing_link = (raw.listing_link ?? "").trim();
    const listing_price = (raw.listing_price ?? "").trim();

    if (!listing_link) {
      errors.push({ row: rowNum, error: "listing_link is required" });
      return;
    }
    if (!isValidUrl(listing_link)) {
      errors.push({ row: rowNum, error: "listing_link must be a valid URL" });
      return;
    }
    if (!listing_price) {
      errors.push({ row: rowNum, error: "listing_price is required" });
      return;
    }
    const price = parseFloat(listing_price);
    if (!Number.isFinite(price) || price < 0) {
      errors.push({ row: rowNum, error: "listing_price must be a valid positive number" });
      return;
    }

    const row: PropertyRow = { listing_link, listing_price };
    for (const col of OPTIONAL_COLUMNS) {
      const value = raw[col];
      if (value != null && value !== "") {
        row[col] = value;
      }
    }
    data.push(row);
  });

  // papaparse-level errors (malformed quoting, etc.)
  parsed.errors.forEach((e) => {
    errors.push({
      row: typeof e.row === "number" ? e.row + 2 : 1,
      error: e.message,
    });
  });

  return {
    success: errors.length === 0 && data.length > 0,
    data,
    errors,
  };
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function getCSVTemplate(): string {
  return `listing_link,street_address,mls_number,listing_price,notes
https://www.zillow.com/homedetails/123-main-st,"123 Main St, Unit 4",MLS123,450000,Ranch style home
https://www.redfin.com/properties/456-oak-ave,456 Oak Ave,MLS456,650000,Modern condo
https://www.zillow.com/homedetails/789-elm-road,789 Elm Road,MLS789,525000,Victorian with pool`;
}
