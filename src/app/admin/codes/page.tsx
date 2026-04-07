"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
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

interface CodeGroup {
  code: string;
  properties: CodeRow[];
}

const STATUS_COLOR: Record<string, string> = {
  active: "#1d4ed8", pending: "#92400e", sold: "#166534", withdrawn: "#374151",
};

export default function AdminCodes() {
  const [groups, setGroups] = useState<CodeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const router = useRouter();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/admin"); return; }

      const { data: codeRows } = await supabase
        .from("listings_tracker_access_codes")
        .select("id, code, property_id")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });

      if (!codeRows || codeRows.length === 0) { setLoading(false); return; }

      const propIds = [...new Set(codeRows.map((c) => c.property_id))];
      const { data: props } = await supabase
        .from("listings_tracker_properties")
        .select("id, street_address, listing_price, listing_link, status")
        .in("id", propIds);

      const propMap = Object.fromEntries((props ?? []).map((p) => [p.id, p]));

      const rows: CodeRow[] = codeRows.map((c) => ({
        id: c.id,
        code: c.code,
        property_id: c.property_id,
        street_address: propMap[c.property_id]?.street_address ?? null,
        listing_price: propMap[c.property_id]?.listing_price ?? 0,
        listing_link: propMap[c.property_id]?.listing_link ?? "",
        status: propMap[c.property_id]?.status ?? "active",
      }));

      // Group by code, preserving first-seen order
      const groupMap = new Map<string, CodeRow[]>();
      rows.forEach((row) => {
        if (!groupMap.has(row.code)) groupMap.set(row.code, []);
        groupMap.get(row.code)!.push(row);
      });

      setGroups([...groupMap.entries()].map(([code, properties]) => ({ code, properties })));
      setLoading(false);
    }
    loadData();
  }, [router, supabase]);

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 1500);
    } catch { }
  }

  if (loading) {
    return <main className="page page--centered"><dl-spinner /></main>;
  }

  return (
    <main className="page page--centered">
      <div className="cl-dlite-w-full" style={{ maxWidth: "60rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <dl-heading level={1}>Access Codes</dl-heading>
          <dl-button variant="ghost" size="sm" onClick={() => router.push("/admin/dashboard")}>← Dashboard</dl-button>
        </div>

        <dl-text color="secondary" style={{ display: "block", marginBottom: "1.5rem" }}>
          Share a code with a buyer to give them access to all properties under it.
          Assign multiple properties to the same code when creating a property.
        </dl-text>

        {groups.length === 0 ? (
          <dl-card>
            <div style={{ padding: "2rem", textAlign: "center" }}>
              <dl-text color="secondary">No access codes yet. Create a property to generate one.</dl-text>
            </div>
          </dl-card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {groups.map(({ code, properties }) => (
              <dl-card key={code}>
                <div style={{ padding: "1.25rem 1.5rem" }}>
                  {/* Code header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                      <span style={{ fontFamily: "monospace", fontSize: "1.75rem", fontWeight: 800, letterSpacing: "0.15em", color: "#111827" }}>
                        {code}
                      </span>
                      <dl-text size="300" color="secondary">
                        {properties.length} {properties.length === 1 ? "property" : "properties"}
                      </dl-text>
                    </div>
                    <dl-button
                      variant={copiedCode === code ? "primary" : "secondary"}
                      size="sm"
                      onClick={() => copyCode(code)}
                    >
                      {copiedCode === code ? "Copied!" : "Copy Code"}
                    </dl-button>
                  </div>

                  {/* Property list */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {properties.map((row) => (
                      <div
                        key={row.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "1rem",
                          padding: "0.6rem 0.75rem",
                          background: "#f9fafb",
                          borderRadius: "0.375rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                            <dl-text style={{ fontWeight: 600 }}>{row.street_address || "No address"}</dl-text>
                            <span style={{
                              fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                              padding: "1px 7px", borderRadius: "9999px", background: "#f3f4f6",
                              color: STATUS_COLOR[row.status ?? "active"] ?? "#374151",
                            }}>
                              {row.status ?? "active"}
                            </span>
                          </div>
                          <dl-text size="300" color="secondary">
                            ${formatPrice(row.listing_price)}
                            {row.listing_link && (
                              <> · <a href={row.listing_link} target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }}>View listing ↗</a></>
                            )}
                          </dl-text>
                        </div>
                        <dl-button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/admin/properties/${row.property_id}`)}
                        >
                          Edit →
                        </dl-button>
                      </div>
                    ))}
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
