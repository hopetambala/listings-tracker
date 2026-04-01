"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { generateCode } from "@/lib/api/code-utils";
import { parseCSV, getCSVTemplate } from "@/lib/api/csv-parser";
import { getEventValue } from "@/dlite-design-system/wc-helpers";

interface BulkResult {
  property_id: string;
  code: string;
  street_address?: string;
  listing_price: number;
  error?: string;
}

export default function BulkUpload() {
  const [user, setUser] = useState<any>(null);
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
      if (!user) {
        router.push("/admin");
        return;
      }
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

    try {
      const results: BulkResult[] = [];

      for (const row of parseResult.data) {
        try {
          const code = generateCode();

          const { data: propData, error: propError } = await supabase
            .from("listings_tracker_properties")
            .insert({
              admin_id: user.id,
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
            .insert({
              property_id: propData.id,
              code,
              created_by: user.id,
            });

          if (codeError) throw codeError;

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

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      alert("Code copied to clipboard!");
    } catch { }
  }

  if (loading) {
    return (
      <main className="page page--centered">
        <dl-spinner />
      </main>
    );
  }

  return (
    <main className="page page--centered">
      <div className="cl-dlite-w-full" style={{ maxWidth: "60rem" }}>
        <dl-heading level={1} className="cl-dlite-sem-mb-400">
          Bulk Upload Properties
        </dl-heading>
        <dl-text color="secondary" className="cl-dlite-sem-mb-600">
          Upload multiple properties at once using CSV format
        </dl-text>

        {results.length === 0 ? (
          <>
            <div style={{ marginBottom: "2rem" }}>
              <dl-button
                variant="secondary"
                size="sm"
                onClick={() => setShowTemplate(!showTemplate)}
              >
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
                style={{
                  marginTop: "0.5rem",
                  minHeight: "200px",
                  fontFamily: "monospace",
                  fontSize: "0.875rem",
                }}
                onInput={(e: any) => setCsvText(getEventValue(e))}
              />
            </div>

            {errors.length > 0 && (
              <dl-card style={{ marginTop: "1rem", backgroundColor: "#fee" }}>
                <div style={{ padding: "1rem" }}>
                  <dl-heading level={3}>Errors in CSV</dl-heading>
                  <ul style={{ marginTop: "1rem", marginLeft: "1.5rem" }}>
                    {errors.map((err, i) => (
                      <li key={i}>
                        <dl-text size="300">
                          Row {err.row}: {err.error}
                        </dl-text>
                      </li>
                    ))}
                  </ul>
                </div>
              </dl-card>
            )}

            <div style={{ display: "flex", gap: "1rem", marginTop: "2rem" }}>
              <dl-button
                variant="primary"
                size="md"
                full-width
                disabled={uploading || undefined}
                onClick={handleUpload}
              >
                {uploading ? "Uploading..." : "Upload Properties"}
              </dl-button>
              <dl-button
                variant="secondary"
                size="md"
                full-width
                onClick={() => router.push("/admin/dashboard")}
              >
                Cancel
              </dl-button>
            </div>
          </>
        ) : (
          <>
            <dl-card style={{ marginBottom: "1rem" }}>
              <div style={{ padding: "1rem" }}>
                <dl-heading level={2}>Upload Complete!</dl-heading>
                <dl-text style={{ marginTop: "1rem" }}>
                  {results.filter((r) => !r.error).length} properties created successfully
                </dl-text>
              </div>
            </dl-card>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
              {results.map((result, i) => (
                <dl-card key={i}>
                  <div style={{ padding: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <dl-text size="300" color={result.error ? "tertiary" : "primary"}>
                          {result.street_address || "No address"} - ${result.listing_price}
                        </dl-text>
                        {result.error && (
                          <dl-text size="200" color="tertiary" style={{ marginTop: "0.5rem" }}>
                            Error: {result.error}
                          </dl-text>
                        )}
                      </div>
                      {!result.error && (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <dl-text size="300" style={{ fontWeight: "bold", fontSize: "1.2rem" }}>
                            {result.code}
                          </dl-text>
                          <dl-button
                            variant="secondary"
                            size="sm"
                            onClick={() => copyCode(result.code)}
                          >
                            Copy
                          </dl-button>
                        </div>
                      )}
                    </div>
                  </div>
                </dl-card>
              ))}
            </div>

            <div style={{ display: "flex", gap: "1rem" }}>
              <dl-button
                variant="primary"
                size="md"
                full-width
                onClick={() => {
                  setResults([]);
                  setCsvText("");
                }}
              >
                Upload More
              </dl-button>
              <dl-button
                variant="secondary"
                size="md"
                full-width
                onClick={() => router.push("/admin/dashboard")}
              >
                Done
              </dl-button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
