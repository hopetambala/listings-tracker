"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { generateCode } from "@/lib/api/code-utils";
import { parseCSV, getCSVTemplate } from "@/lib/api/csv-parser";
import { getEventValue, WcInputEvent } from "@/dlite-design-system/wc-helpers";

interface BulkResult {
  property_id: string;
  code: string;
  street_address?: string;
  listing_price: number;
  error?: string;
  duplicate?: boolean;
}

export default function BulkUpload() {
  const [_user, setUser] = useState<any>(null);
  const [csvText, setCsvText] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<BulkResult[]>([]);
  const [errors, setErrors] = useState<{ row: number; error: string }[]>([]);
  const [showTemplate, setShowTemplate] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/admin"); return; }
      setUser(user);
      setLoading(false);
    }
    checkAuth();
  }, [router, supabase.auth]);

  async function handleUpload() {
    if (!csvText.trim()) {
      alert("Please paste or upload CSV data");
      return;
    }

    setErrors([]);
    setResults([]);
    setUploading(true);

    const parseResult = parseCSV(csvText);
    if (!parseResult.success) {
      setErrors(parseResult.errors);
      setUploading(false);
      return;
    }

    // Check for duplicate URLs already in the DB for this admin
    const { data: existingProps } = await supabase
      .from("listings_tracker_properties")
      .select("listing_link")
      .eq("admin_id", _user.id);
    const existingUrls = new Set((existingProps ?? []).map((p) => p.listing_link));

    try {
      const results: BulkResult[] = [];

      for (const row of parseResult.data) {
        // Duplicate detection
        if (existingUrls.has(row.listing_link)) {
          results.push({
            property_id: "",
            code: "",
            street_address: row.street_address,
            listing_price: parseFloat(row.listing_price),
            duplicate: true,
            error: `Duplicate URL — this listing already exists in your properties.`,
          });
          continue;
        }

        try {
          const code = generateCode();

          const { data: propData, error: propError } = await supabase
            .from("listings_tracker_properties")
            .insert({
              admin_id: _user.id,
              listing_link: row.listing_link,
              street_address: row.street_address || null,
              mls_number: row.mls_number || null,
              listing_price: parseFloat(row.listing_price),
              notes: row.notes || null,
            })
            .select()
            .single();

          if (propError) throw propError;

          const { error: codeError } = await supabase
            .from("listings_tracker_access_codes")
            .insert({ property_id: propData.id, code, created_by: _user.id });

          if (codeError) throw codeError;

          existingUrls.add(row.listing_link); // prevent intra-batch duplicates

          results.push({
            property_id: propData.id,
            code,
            street_address: row.street_address,
            listing_price: parseFloat(row.listing_price),
          });
        } catch (err: any) {
          results.push({
            property_id: "",
            code: "",
            street_address: row.street_address,
            listing_price: parseFloat(row.listing_price),
            error: err.message,
          });
        }
      }

      setResults(results);
      setCsvText("");
    } catch (err: any) {
      alert("Error uploading: " + err.message);
    } finally {
      setUploading(false);
    }
  }

  function downloadResultsCSV() {
    const rows = [
      ["street_address", "listing_price", "code", "property_id", "status"],
      ...results.map((r) => [
        r.street_address ?? "",
        String(r.listing_price),
        r.code,
        r.property_id,
        r.error ? (r.duplicate ? "duplicate" : "error: " + r.error) : "created",
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bulk-upload-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyCode(code: string) {
    try { await navigator.clipboard.writeText(code); } catch { }
  }

  if (loading) {
    return <main className="page page--centered"><dl-spinner /></main>;
  }

  return (
    <main className="page page--centered">
      <div className="cl-dlite-w-full" style={{ maxWidth: "60rem" }}>
        <dl-heading level={1} className="cl-dlite-sem-mb-400">Bulk Upload Properties</dl-heading>
        <dl-text color="secondary" className="cl-dlite-sem-mb-600">
          Upload multiple properties at once using CSV format
        </dl-text>

        {results.length === 0 ? (
          <>
            <div style={{ marginBottom: "2rem" }}>
              <dl-button variant="secondary" size="sm" onClick={() => setShowTemplate(!showTemplate)}>
                {showTemplate ? "Hide" : "Show"} CSV Template
              </dl-button>
              {showTemplate && (
                <dl-card style={{ marginTop: "1rem" }}>
                  <div style={{ padding: "1rem", fontFamily: "monospace", fontSize: "0.875rem", overflow: "auto" }}>
                    <pre>{getCSVTemplate()}</pre>
                  </div>
                </dl-card>
              )}
            </div>

            <div>
              <dl-text size="300" color="secondary">Paste CSV Data</dl-text>
              <dl-textarea
                placeholder={getCSVTemplate()}
                value={csvText}
                style={{ marginTop: "0.5rem", minHeight: "200px", fontFamily: "monospace", fontSize: "0.875rem" }}
                onInput={(e: WcInputEvent) => setCsvText(getEventValue(e))}
              />
            </div>

            {errors.length > 0 && (
              <dl-card style={{ marginTop: "1rem", backgroundColor: "#fee" }}>
                <div style={{ padding: "1rem" }}>
                  <dl-heading level={3}>Errors in CSV</dl-heading>
                  <ul style={{ marginTop: "1rem", marginLeft: "1.5rem" }}>
                    {errors.map((err, i) => (
                      <li key={i}>
                        <dl-text size="300">Row {err.row}: {err.error}</dl-text>
                      </li>
                    ))}
                  </ul>
                </div>
              </dl-card>
            )}

            <div style={{ display: "flex", gap: "1rem", marginTop: "2rem" }}>
              <dl-button variant="primary" size="md" full-width disabled={uploading || undefined} onClick={handleUpload}>
                {uploading ? "Uploading..." : "Upload Properties"}
              </dl-button>
              <dl-button variant="secondary" size="md" full-width onClick={() => router.push("/admin/dashboard")}>
                Cancel
              </dl-button>
            </div>
          </>
        ) : (
          <>
            <dl-card style={{ marginBottom: "1rem" }}>
              <div style={{ padding: "1rem" }}>
                <dl-heading level={2}>Upload Complete</dl-heading>
                <div style={{ marginTop: "0.75rem", display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
                  <dl-text style={{ color: "#16a34a" }}>
                    ✓ {results.filter((r) => !r.error).length} created
                  </dl-text>
                  {results.some((r) => r.duplicate) && (
                    <dl-text style={{ color: "#92400e" }}>
                      ⚠ {results.filter((r) => r.duplicate).length} duplicate{results.filter((r) => r.duplicate).length !== 1 ? "s" : ""} skipped
                    </dl-text>
                  )}
                  {results.some((r) => r.error && !r.duplicate) && (
                    <dl-text style={{ color: "#991b1b" }}>
                      ✕ {results.filter((r) => r.error && !r.duplicate).length} failed
                    </dl-text>
                  )}
                </div>
              </div>
            </dl-card>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
              {results.map((result, i) => (
                <dl-card key={i}>
                  <div style={{ padding: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
                      <div style={{ flex: 1 }}>
                        <dl-text size="300" color={result.error ? "tertiary" : "primary"}>
                          {result.street_address || "No address"} — ${result.listing_price.toLocaleString()}
                        </dl-text>
                        {result.error && (
                          <dl-text size="200" color="tertiary" style={{ marginTop: "0.25rem" }}>
                            {result.duplicate ? "⚠ " : "✕ "}{result.error}
                          </dl-text>
                        )}
                      </div>
                      {!result.error && (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <dl-text size="300" style={{ fontWeight: "bold", fontFamily: "monospace", fontSize: "1.1rem" }}>
                            {result.code}
                          </dl-text>
                          <dl-button variant="secondary" size="sm" onClick={() => copyCode(result.code)}>
                            Copy
                          </dl-button>
                        </div>
                      )}
                    </div>
                  </div>
                </dl-card>
              ))}
            </div>

            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <dl-button variant="primary" size="md" full-width onClick={downloadResultsCSV}>
                Download Results CSV
              </dl-button>
              <dl-button variant="secondary" size="md" full-width onClick={() => { setResults([]); setCsvText(""); }}>
                Upload More
              </dl-button>
              <dl-button variant="ghost" size="md" full-width onClick={() => router.push("/admin/dashboard")}>
                Done
              </dl-button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
