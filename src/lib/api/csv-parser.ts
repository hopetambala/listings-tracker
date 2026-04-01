/**
 * CSV parsing utilities for bulk property upload
 */

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

/**
 * Parse CSV text and validate property data
 */
export function parseCSV(csvText: string): ParseResult {
  const lines = csvText.trim().split("\n");
  const errors: { row: number; error: string }[] = [];
  const data: PropertyRow[] = [];

  if (lines.length < 2) {
    return {
      success: false,
      data: [],
      errors: [{ row: 1, error: "CSV must include header row and at least one data row" }],
    };
  }

  // Parse header
  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().toLowerCase());

  const requiredCols = {
    listing_link: headers.indexOf("listing_link"),
    listing_price: headers.indexOf("listing_price"),
  };

  const optionalCols = {
    street_address: headers.indexOf("street_address"),
    mls_number: headers.indexOf("mls_number"),
    notes: headers.indexOf("notes"),
  };

  // Validate required columns exist
  if (requiredCols.listing_link === -1) {
    return {
      success: false,
      data: [],
      errors: [{ row: 1, error: "Missing required column: listing_link" }],
    };
  }

  if (requiredCols.listing_price === -1) {
    return {
      success: false,
      data: [],
      errors: [{ row: 1, error: "Missing required column: listing_price" }],
    };
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    const cols = line.split(",").map((c) => c.trim());
    const row: PropertyRow = {
      listing_link: cols[requiredCols.listing_link],
      listing_price: cols[requiredCols.listing_price],
    };

    // Validate listing_link
    if (!row.listing_link) {
      errors.push({ row: i + 1, error: "listing_link is required" });
      continue;
    }

    if (!isValidUrl(row.listing_link)) {
      errors.push({ row: i + 1, error: "listing_link must be a valid URL" });
      continue;
    }

    // Validate listing_price
    if (!row.listing_price) {
      errors.push({ row: i + 1, error: "listing_price is required" });
      continue;
    }

    const price = parseFloat(row.listing_price);
    if (isNaN(price) || price < 0) {
      errors.push({
        row: i + 1,
        error: "listing_price must be a valid positive number",
      });
      continue;
    }

    // Add optional columns
    if (optionalCols.street_address >= 0) {
      row.street_address = cols[optionalCols.street_address];
    }
    if (optionalCols.mls_number >= 0) {
      row.mls_number = cols[optionalCols.mls_number];
    }
    if (optionalCols.notes >= 0) {
      row.notes = cols[optionalCols.notes];
    }

    data.push(row);
  }

  return {
    success: errors.length === 0 && data.length > 0,
    data,
    errors,
  };
}

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create sample CSV template
 */
export function getCSVTemplate(): string {
  return `listing_link,street_address,mls_number,listing_price,notes
https://www.zillow.com/homedetails/123-main-st,123 Main St,MLS123,450000,Ranch style home
https://www.redfin.com/properties/456-oak-ave,456 Oak Ave,MLS456,650000,Modern condo
https://www.zillow.com/homedetails/789-elm-road,789 Elm Road,MLS789,525000,Victorian with pool`;
}
