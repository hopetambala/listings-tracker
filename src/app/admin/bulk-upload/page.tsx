"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { generateCode } from "@/lib/api/code-utils";
import { parseCSV, getCSVTemplate, type PropertyRow } from "@/lib/api/csv-parser";
import { getEventValue, WcInputEvent } from "@/dlite-design-system/wc-helpers";
import { toast } from "@/components/Toast";

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
  const [preview, setPreview] = useState<PropertyRow[] | null>(null);
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

  function handlePreview() {
    setErrors([]);
    setResults([]);
    setPreview(null);
    if (!csvText.trim()) {
      toast.error("Paste or upload CSV data first.");
      return;
    }
    const parseResult = parseCSV(csvText);
    if (!parseResult.success) {
      setErrors(parseResult.errors);
      toast.error("CSV has errors — see below.");
      return;
    }
    setPreview(parseResult.data);
  }

  async function handleUpload() {
    if (!preview) {
      handlePreview();
      return;
    }
    setErrors([]);
    setResults([]);
    setUploading(true);

    // Check for duplicate URLs already in the DB for this admin
    const { data: existingProps } = await supabase
      .from("listings_tracker_properties")
      .select("listing_link")
      .eq("admin_id", _user.id);
    const existingUrls = new Set((existingProps ?? []).map((p) => p.listing_link));

    try {
      const results: BulkResult[] = [];

      for (const row of preview) {
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
      setPreview(null);
      const created = results.filter((r) => !r.error).length;
      const failed = results.filter((r) => r.error && !r.duplicate).length;
      if (failed === 0) {
        toast.success(`Uploaded ${created} propert${created === 1 ? "y" : "ies"}.`);
      } else {
        toast.error(`${failed} of ${results.length} failed — see results.`);
      }
    } catch (err: any) {
      toast.error("Error uploading: " + err.message);
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
                onInput={(e: WcInputEvent) => {
                  setCsvText(getEventValue(e));
                  setPreview(null);
                  setErrors([]);
                }}
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

            {preview && (
              <dl-card style={{ marginTop: "1rem" }}>
                <div style={{ padding: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                    <dl-heading level={3} style={{ margin: 0 }}>Preview: {preview.length} {preview.length === 1 ? "row" : "rows"}</dl-heading>
                    <dl-button variant="ghost" size="sm" onClick={() => setPreview(null)}>
                      Edit CSV
                    </dl-button>
                  </div>
                  <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: "0.375rem" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                      <thead style={{ background: "#f8fafc" }}>
                        <tr>
                          <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", borderBottom: "1px solid #e5e7eb" }}>Address</th>
                          <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", borderBottom: "1px solid #e5e7eb" }}>Price</th>
                          <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", borderBottom: "1px solid #e5e7eb" }}>MLS</th>
                          <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", borderBottom: "1px solid #e5e7eb" }}>Link</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.slice(0, 10).map((row, i) => (
                          <tr key={i}>
                            <td style={{ padding: "0.5rem 0.75rem", borderBottom: "1px solid #f1f5f9" }}>{row.street_address || "—"}</td>
                            <td style={{ padding: "0.5rem 0.75rem", borderBottom: "1px solid #f1f5f9" }}>${Number(row.listing_price).toLocaleString()}</td>
                            <td style={{ padding: "0.5rem 0.75rem", borderBottom: "1px solid #f1f5f9" }}>{row.mls_number || "—"}</td>
                            <td style={{ padding: "0.5rem 0.75rem", borderBottom: "1px solid #f1f5f9", maxWidth: "16rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.listing_link}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {preview.length > 10 && (
                      <div style={{ padding: "0.5rem 0.75rem", background: "#f8fafc", fontSize: "0.8rem", color: "#64748b" }}>
                        …and {preview.length - 10} more
                      </div>
                    )}
                  </div>
                </div>
              </dl-card>
            )}

            <div style={{ display: "flex", gap: "1rem", marginTop: "2rem" }}>
              {!preview ? (
                <dl-button variant="primary" size="md" full-width disabled={uploading || undefined} onClick={handlePreview}>
                  Preview CSV
                </dl-button>
              ) : (
                <dl-button variant="primary" size="md" full-width disabled={uploading || undefined} onClick={handleUpload}>
                  {uploading ? "Uploading..." : `Confirm upload (${preview.length})`}
                </dl-button>
              )}
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
