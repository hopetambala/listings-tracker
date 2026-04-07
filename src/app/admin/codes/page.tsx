"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/formatters";

interface CodeRow {
  id: string;
  code: string;
  property_id: string;
  street_address: string | null;
  listing_price: number;
  listing_link: string;
  status: string | null;
}

export default function AdminCodes() {
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/admin"); return; }

      // Fetch all codes created by this admin, join with property info
      const { data: codeRows } = await supabase
        .from("listings_tracker_access_codes")
        .select("id, code, property_id")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });

      if (!codeRows || codeRows.length === 0) { setLoading(false); return; }

      // Fetch associated properties
      const propIds = [...new Set(codeRows.map((c) => c.property_id))];
      const { data: props } = await supabase
        .from("listings_tracker_properties")
        .select("id, street_address, listing_price, listing_link, status")
        .in("id", propIds);

      const propMap = Object.fromEntries((props ?? []).map((p) => [p.id, p]));

      setCodes(
        codeRows.map((c) => ({
          id: c.id,
          code: c.code,
          property_id: c.property_id,
          street_address: propMap[c.property_id]?.street_address ?? null,
          listing_price: propMap[c.property_id]?.listing_price ?? 0,
          listing_link: propMap[c.property_id]?.listing_link ?? "",
          status: propMap[c.property_id]?.status ?? "active",
        }))
      );
      setLoading(false);
    }
    loadData();
  }, [router, supabase]);

  async function copyCode(id: string, code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch { }
  }

  if (loading) {
    return <main className="page page--centered"><dl-spinner /></main>;
  }

  const STATUS_COLOR: Record<string, string> = {
    active: "#1d4ed8", pending: "#92400e", sold: "#166534", withdrawn: "#374151",
  };

  return (
    <main className="page page--centered">
      <div className="cl-dlite-w-full" style={{ maxWidth: "60rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <dl-heading level={1}>Access Codes</dl-heading>
          <dl-button variant="ghost" size="sm" onClick={() => router.push("/admin/dashboard")}>← Dashboard</dl-button>
        </div>

        <dl-text color="secondary" style={{ display: "block", marginBottom: "1.5rem" }}>
          Share these codes with buyers to give them access to specific listings.
        </dl-text>

        {codes.length === 0 ? (
          <dl-card>
            <div style={{ padding: "2rem", textAlign: "center" }}>
              <dl-text color="secondary">No access codes yet. Create a property to generate one.</dl-text>
            </div>
          </dl-card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {codes.map((row) => (
              <dl-card key={row.id}>
                <div style={{ padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                      <dl-text style={{ fontWeight: 600 }}>{row.street_address || "No address"}</dl-text>
                      <span style={{
                        fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                        padding: "2px 8px", borderRadius: "9999px", background: "#f3f4f6",
                        color: STATUS_COLOR[row.status ?? "active"] ?? "#374151",
                      }}>
                        {row.status ?? "active"}
                      </span>
                    </div>
                    <dl-text size="300" color="secondary" style={{ marginTop: "0.25rem" }}>
                      ${formatPrice(row.listing_price)}
                      {row.listing_link && (
                        <> · <a href={row.listing_link} target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }}>View listing ↗</a></>
                      )}
                    </dl-text>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span style={{ fontFamily: "monospace", fontSize: "1.5rem", fontWeight: 800, letterSpacing: "0.1em", color: "#111827" }}>
                      {row.code}
                    </span>
                    <dl-button
                      variant={copiedId === row.id ? "primary" : "secondary"}
                      size="sm"
                      onClick={() => copyCode(row.id, row.code)}
                    >
                      {copiedId === row.id ? "Copied!" : "Copy"}
                    </dl-button>
                    <dl-button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/admin/properties/${row.property_id}`)}
                    >
                      Edit property
                    </dl-button>
                  </div>
                </div>
              </dl-card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
