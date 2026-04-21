"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { formatPrice } from "@/lib/formatters";
import { getEventValue, WcInputEvent } from "@/dlite-design-system/wc-helpers";
import { toast } from "@/components/Toast";
import { EmptyState } from "@/components/EmptyState";
import { ListingCardSkeletonGrid } from "@/components/Skeleton";

type Property = Database["public"]["Tables"]["listings_tracker_properties"]["Row"];

const STATUS_STYLES: Record<string, { bg: string; border: string; color: string; label: string }> = {
  active:    { bg: "#dbeafe", border: "#3b82f6", color: "#1d4ed8", label: "Active" },
  pending:   { bg: "#fef3c7", border: "#f59e0b", color: "#92400e", label: "Pending" },
  sold:      { bg: "#dcfce7", border: "#22c55e", color: "#166534", label: "Sold" },
  withdrawn: { bg: "#f3f4f6", border: "#9ca3af", color: "#374151", label: "Withdrawn" },
};

function StatusBadge({ status }: { status: string | null }) {
  const s = STATUS_STYLES[status ?? "active"] ?? STATUS_STYLES.active;
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: "9999px",
      fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
      background: s.bg, border: `1.5px solid ${s.border}`, color: s.color,
    }}>
      {s.label}
    </span>
  );
}

export default function AdminProperties() {
  const [_user, setUser] = useState<any>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingField, setEditingField] = useState<{ id: string; field: "status" | "price" } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; msg: string } | null>(null);
  const [markSoldId, setMarkSoldId] = useState<string | null>(null);
  const [soldPrice, setSoldPrice] = useState("");
  const [soldDate, setSoldDate] = useState("");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/admin");
        return;
      }
      setUser(user);

      const { data, error } = await supabase
        .from("listings_tracker_properties")
        .select("*")
        .eq("admin_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching properties:", error);
      } else {
        setProperties(data || []);
      }
      setLoading(false);
    }
    loadData();
  }, [router, supabase]);

  async function deleteProperty(id: string) {
    if (!confirm("Are you sure you want to delete this property?")) return;
    const { error } = await supabase.from("listings_tracker_properties").delete().eq("id", id);
    if (error) {
      setRowError({ id, msg: error.message });
      toast.error("Couldn't delete — see row for details.");
    } else {
      setProperties((prev) => prev.filter((p) => p.id !== id));
      toast.success("Property deleted.");
    }
  }

  async function saveStatus(id: string, newStatus: string) {
    setSavingId(id);
    setRowError(null);
    const { error } = await supabase
      .from("listings_tracker_properties")
      .update({ status: newStatus })
      .eq("id", id);
    if (error) {
      setRowError({ id, msg: error.message });
      toast.error("Couldn't update status.");
    } else {
      setProperties((prev) => prev.map((p) => (p.id === id ? { ...p, status: newStatus } : p)));
      toast.success("Status updated.");
    }
    setSavingId(null);
    setEditingField(null);
  }

  async function savePrice(id: string, newPrice: string) {
    const parsed = parseFloat(newPrice);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setRowError({ id, msg: "Enter a valid price." });
      return;
    }
    setSavingId(id);
    setRowError(null);
    const { error: propErr } = await supabase
      .from("listings_tracker_properties")
      .update({ listing_price: parsed })
      .eq("id", id);
    if (propErr) {
      setRowError({ id, msg: propErr.message });
      setSavingId(null);
      return;
    }
    // Also append a history entry so the chart reflects the change.
    const { error: priceErr } = await supabase
      .from("listings_tracker_prices")
      .insert({ property_id: id, price: parsed });
    if (priceErr) {
      setRowError({ id, msg: priceErr.message });
      toast.error("Saved price but couldn't record history.");
    } else {
      setProperties((prev) => prev.map((p) => (p.id === id ? { ...p, listing_price: parsed } : p)));
      toast.success("Price updated.");
    }
    setSavingId(null);
    setEditingField(null);
  }

  function openMarkSold(prop: Property) {
    setMarkSoldId(prop.id);
    setSoldPrice(String(prop.listing_price));
    setSoldDate(new Date().toISOString().slice(0, 10));
    setRowError(null);
  }

  async function confirmMarkSold(id: string) {
    const parsed = parseFloat(soldPrice);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setRowError({ id, msg: "Enter a valid sold price." });
      return;
    }
    setSavingId(id);
    setRowError(null);
    const { error: propErr } = await supabase
      .from("listings_tracker_properties")
      .update({ status: "sold", sold_price: parsed })
      .eq("id", id);
    if (propErr) {
      setRowError({ id, msg: propErr.message });
      toast.error("Couldn't mark as sold.");
      setSavingId(null);
      return;
    }
    const { error: priceErr } = await supabase
      .from("listings_tracker_prices")
      .insert({
        property_id: id,
        price: parsed,
        recorded_at: soldDate ? new Date(soldDate).toISOString() : new Date().toISOString(),
      });
    if (priceErr) {
      setRowError({ id, msg: priceErr.message });
      toast.error("Marked sold but couldn't record history.");
    } else {
      setProperties((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: "sold", sold_price: parsed } : p))
      );
      setMarkSoldId(null);
      toast.success(`Marked sold at $${formatPrice(parsed)}.`);
    }
    setSavingId(null);
  }

  if (loading) {
    return (
      <main className="page page--centered">
        <div className="cl-dlite-w-full" style={{ maxWidth: "60rem" }}>
          <dl-heading level={1} style={{ marginBottom: "1.5rem" }}>Properties</dl-heading>
          <ListingCardSkeletonGrid count={3} />
        </div>
      </main>
    );
  }

  return (
    <main className="page page--centered">
      <div className="cl-dlite-w-full" style={{ maxWidth: "60rem" }}>
        <div className="cl-dlite-flex cl-dlite-items-center cl-dlite-justify-between cl-dlite-sem-mb-600">
          <dl-heading level={1}>Properties</dl-heading>
          <dl-button variant="primary" onClick={() => router.push("/admin/properties/new")}>
            + Add Property
          </dl-button>
        </div>

        {properties.length === 0 ? (
          <EmptyState
            icon="🏡"
            title="No properties yet"
            description="Create your first listing and we'll generate a shareable 4-digit code for a buyer."
            action={
              <dl-button variant="primary" size="md" onClick={() => router.push("/admin/properties/new")}>
                + Add your first property
              </dl-button>
            }
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {properties.map((prop) => {
              const isSold = prop.status === "sold";
              const editing = editingField?.id === prop.id ? editingField.field : null;
              return (
                <dl-card key={prop.id}>
                  <div style={{ padding: "1.25rem 1.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <dl-heading level={3}>{prop.street_address || "No address"}</dl-heading>

                        {/* Status + price row with inline editing */}
                        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginTop: "0.5rem", flexWrap: "wrap" }}>
                          {editing === "status" ? (
                            <select
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => saveStatus(prop.id, editValue)}
                              disabled={savingId === prop.id}
                              style={{ padding: "0.2rem 0.5rem", border: "1px solid #e5e7eb", borderRadius: "0.375rem", fontSize: "0.8rem" }}
                            >
                              <option value="active">Active</option>
                              <option value="pending">Pending</option>
                              <option value="sold">Sold</option>
                              <option value="withdrawn">Withdrawn</option>
                            </select>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingField({ id: prop.id, field: "status" });
                                setEditValue(prop.status ?? "active");
                              }}
                              title="Click to change status"
                              style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                            >
                              <StatusBadge status={prop.status} />
                            </button>
                          )}

                          {editing === "price" ? (
                            <input
                              autoFocus
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => savePrice(prop.id, editValue)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                if (e.key === "Escape") setEditingField(null);
                              }}
                              disabled={savingId === prop.id}
                              style={{ width: "140px", padding: "0.2rem 0.5rem", border: "1px solid #e5e7eb", borderRadius: "0.375rem", fontSize: "0.875rem" }}
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingField({ id: prop.id, field: "price" });
                                setEditValue(String(prop.listing_price));
                              }}
                              title="Click to edit price"
                              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#0f172a", fontSize: "0.95rem", fontWeight: 600 }}
                            >
                              ${formatPrice(prop.listing_price)}
                            </button>
                          )}

                          {isSold && prop.sold_price != null && (
                            <dl-text size="300" color="secondary">
                              Sold ${formatPrice(prop.sold_price)}
                            </dl-text>
                          )}

                          <dl-text size="300" color="secondary">
                            MLS: {prop.mls_number || "N/A"}
                          </dl-text>
                        </div>

                        {prop.notes && (
                          <dl-text size="300" style={{ display: "block", marginTop: "0.5rem" }}>
                            {prop.notes}
                          </dl-text>
                        )}

                        {rowError?.id === prop.id && (
                          <dl-text size="300" color="danger" style={{ display: "block", marginTop: "0.5rem" }}>
                            {rowError.msg}
                          </dl-text>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        {!isSold && (
                          <dl-button variant="primary" size="sm" onClick={() => openMarkSold(prop)}>
                            Mark sold
                          </dl-button>
                        )}
                        <dl-button variant="secondary" size="sm" onClick={() => router.push(`/admin/properties/${prop.id}`)}>
                          Edit
                        </dl-button>
                        <dl-button variant="danger" size="sm" onClick={() => deleteProperty(prop.id)}>
                          Delete
                        </dl-button>
                      </div>
                    </div>

                    {/* Mark-sold popover */}
                    {markSoldId === prop.id && (
                      <div
                        role="dialog"
                        aria-label="Mark property as sold"
                        style={{
                          marginTop: "1rem",
                          padding: "1rem",
                          background: "#f0fdf4",
                          border: "1.5px solid #86efac",
                          borderRadius: "0.5rem",
                          display: "flex",
                          gap: "0.75rem",
                          alignItems: "flex-end",
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ flex: "1 1 140px" }}>
                          <dl-text size="300" color="secondary">Sold price</dl-text>
                          <dl-input
                            type="number"
                            value={soldPrice}
                            style={{ marginTop: "0.25rem" }}
                            onInput={(e: WcInputEvent) => setSoldPrice(getEventValue(e))}
                          />
                        </div>
                        <div style={{ flex: "1 1 140px" }}>
                          <dl-text size="300" color="secondary">Sold date</dl-text>
                          <input
                            type="date"
                            value={soldDate}
                            onChange={(e) => setSoldDate(e.target.value)}
                            max={new Date().toISOString().split("T")[0]}
                            style={{ marginTop: "0.25rem", width: "100%", padding: "0.4rem 0.6rem", border: "1px solid #e5e7eb", borderRadius: "0.375rem", fontSize: "0.875rem", boxSizing: "border-box" }}
                          />
                        </div>
                        <dl-button variant="primary" size="sm" disabled={savingId === prop.id || undefined} onClick={() => confirmMarkSold(prop.id)}>
                          {savingId === prop.id ? "Saving..." : "Confirm sold"}
                        </dl-button>
                        <dl-button variant="ghost" size="sm" onClick={() => setMarkSoldId(null)} disabled={savingId === prop.id || undefined}>
                          Cancel
                        </dl-button>
                      </div>
                    )}
                  </div>
                </dl-card>
              );
            })}
          </div>
        )}

        <div className="cl-dlite-text-center cl-dlite-sem-mt-600">
          <dl-button variant="ghost" size="sm" onClick={() => router.push("/admin/dashboard")}>
            ← Back to Dashboard
          </dl-button>
        </div>
      </div>
    </main>
  );
}
