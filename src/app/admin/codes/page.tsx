"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/formatters";
import { getEventValue, WcInputEvent } from "@/dlite-design-system/wc-helpers";
import { toast } from "@/components/Toast";
import { EmptyState } from "@/components/EmptyState";

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
  target_price: number | null;
  buyer_label: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  active: "#1d4ed8", pending: "#92400e", sold: "#166534", withdrawn: "#374151",
};

export default function AdminCodes() {
  const [groups, setGroups] = useState<CodeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editTargetPrice, setEditTargetPrice] = useState("");
  const [editBuyerLabel, setEditBuyerLabel] = useState("");
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [editError, setEditError] = useState<{ code: string; msg: string } | null>(null);
  const router = useRouter();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/admin"); return; }

      const { data: codeRows } = await supabase
        .from("listings_tracker_access_codes")
        .select("id, code, property_id, target_price, buyer_label")
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

      // Use the first non-null target/label for each code.
      const metaByCode = new Map<string, { target_price: number | null; buyer_label: string | null }>();
      for (const c of codeRows) {
        const existing = metaByCode.get(c.code);
        metaByCode.set(c.code, {
          target_price: existing?.target_price ?? c.target_price ?? null,
          buyer_label: existing?.buyer_label ?? c.buyer_label ?? null,
        });
      }

      // Group by code, preserving first-seen order
      const groupMap = new Map<string, CodeRow[]>();
      rows.forEach((row) => {
        if (!groupMap.has(row.code)) groupMap.set(row.code, []);
        groupMap.get(row.code)!.push(row);
      });

      setGroups([...groupMap.entries()].map(([code, properties]) => {
        const meta = metaByCode.get(code) ?? { target_price: null, buyer_label: null };
        return { code, properties, target_price: meta.target_price, buyer_label: meta.buyer_label };
      }));
      setLoading(false);
    }
    loadData();
  }, [router, supabase]);

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 1500);
      toast.success(`Code ${code} copied.`);
    } catch {
      toast.error("Couldn't copy to clipboard.");
    }
  }

  function startEdit(group: CodeGroup) {
    setEditingCode(group.code);
    setEditTargetPrice(group.target_price != null ? String(group.target_price) : "");
    setEditBuyerLabel(group.buyer_label ?? "");
    setEditError(null);
  }

  async function saveEdit(code: string) {
    const parsedTarget = editTargetPrice.trim() ? parseFloat(editTargetPrice) : null;
    if (parsedTarget != null && (!Number.isFinite(parsedTarget) || parsedTarget <= 0)) {
      setEditError({ code, msg: "Enter a valid target price or leave blank." });
      return;
    }
    setSavingCode(code);
    setEditError(null);
    const labelValue = editBuyerLabel.trim() || null;
    const { error } = await supabase
      .from("listings_tracker_access_codes")
      .update({ target_price: parsedTarget, buyer_label: labelValue })
      .eq("code", code);
    if (error) {
      setEditError({ code, msg: error.message });
      toast.error("Couldn't save buyer details.");
      setSavingCode(null);
      return;
    }
    setGroups((prev) =>
      prev.map((g) =>
        g.code === code ? { ...g, target_price: parsedTarget, buyer_label: labelValue } : g
      )
    );
    setSavingCode(null);
    setEditingCode(null);
    toast.success("Buyer details saved.");
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
          <EmptyState
            icon="🔑"
            title="No access codes yet"
            description="Create a property and a 4-digit code will be generated for your buyer."
            action={
              <dl-button variant="primary" size="md" onClick={() => router.push("/admin/properties/new")}>
                + Create a property
              </dl-button>
            }
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {groups.map((group) => {
              const { code, properties, target_price, buyer_label } = group;
              const isEditing = editingCode === code;
              return (
              <dl-card key={code}>
                <div style={{ padding: "1.25rem 1.5rem" }}>
                  {/* Code header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.75rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "monospace", fontSize: "1.75rem", fontWeight: 800, letterSpacing: "0.15em", color: "#111827" }}>
                        {code}
                      </span>
                      <dl-text size="300" color="secondary">
                        {properties.length} {properties.length === 1 ? "property" : "properties"}
                      </dl-text>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <dl-button
                        variant="ghost"
                        size="sm"
                        onClick={() => (isEditing ? setEditingCode(null) : startEdit(group))}
                        disabled={savingCode === code || undefined}
                      >
                        {isEditing ? "Cancel" : "Edit buyer"}
                      </dl-button>
                      <dl-button
                        variant={copiedCode === code ? "primary" : "secondary"}
                        size="sm"
                        onClick={() => copyCode(code)}
                      >
                        {copiedCode === code ? "Copied!" : "Copy Code"}
                      </dl-button>
                    </div>
                  </div>

                  {/* Buyer meta: label + target */}
                  {!isEditing ? (
                    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center", marginBottom: "1rem" }}>
                      <dl-text size="300" color="secondary">
                        {buyer_label ? buyer_label : <em>No buyer label</em>}
                      </dl-text>
                      <dl-text size="300" color="secondary">
                        {target_price ? `Budget $${formatPrice(target_price)}` : <em>No target price</em>}
                      </dl-text>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        gap: "0.75rem",
                        flexWrap: "wrap",
                        alignItems: "flex-end",
                        marginBottom: "1rem",
                        padding: "0.75rem",
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "0.5rem",
                      }}
                    >
                      <div style={{ flex: "1 1 180px" }}>
                        <dl-text size="300" color="secondary">Buyer label</dl-text>
                        <dl-input
                          type="text"
                          placeholder="e.g. The Johnsons"
                          value={editBuyerLabel}
                          style={{ marginTop: "0.25rem" }}
                          onInput={(e: WcInputEvent) => setEditBuyerLabel(getEventValue(e))}
                        />
                      </div>
                      <div style={{ flex: "1 1 180px" }}>
                        <dl-text size="300" color="secondary">Target price</dl-text>
                        <dl-input
                          type="number"
                          placeholder="e.g. 950000"
                          value={editTargetPrice}
                          style={{ marginTop: "0.25rem" }}
                          onInput={(e: WcInputEvent) => setEditTargetPrice(getEventValue(e))}
                        />
                      </div>
                      <dl-button
                        variant="primary"
                        size="sm"
                        disabled={savingCode === code || undefined}
                        onClick={() => saveEdit(code)}
                      >
                        {savingCode === code ? "Saving..." : "Save"}
                      </dl-button>
                      {editError?.code === code && (
                        <dl-text size="300" color="danger" style={{ width: "100%" }}>
                          {editError.msg}
                        </dl-text>
                      )}
                    </div>
                  )}

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
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
