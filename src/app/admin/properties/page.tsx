"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { formatPrice } from "@/lib/formatters";

type Property = Database["public"]["Tables"]["listings_tracker_properties"]["Row"];

export default function AdminProperties() {
  const [_user, setUser] = useState<any>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
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

      // Fetch properties
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

    const { error } = await supabase
      .from("listings_tracker_properties")
      .delete()
      .eq("id", id);

    if (error) {
      alert("Error deleting property: " + error.message);
    } else {
      setProperties((prev) => prev.filter((p) => p.id !== id));
    }
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
        <div className="cl-dlite-flex cl-dlite-items-center cl-dlite-justify-between cl-dlite-sem-mb-600">
          <dl-heading level={1}>Properties</dl-heading>
          <dl-button variant="primary" onClick={() => router.push("/admin/properties/new")}>
            + Add Property
          </dl-button>
        </div>

        {properties.length === 0 ? (
          <dl-card>
            <div style={{ padding: "2rem", textAlign: "center" }}>
              <dl-text color="secondary">No properties yet. Create one to get started.</dl-text>
            </div>
          </dl-card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {properties.map((prop) => (
              <dl-card key={prop.id}>
                <div style={{ padding: "1.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div style={{ flex: 1 }}>
                      <dl-heading level={3}>{prop.street_address || "No address"}</dl-heading>
                      <dl-text color="secondary" size="300" style={{ marginTop: "0.5rem" }}>
                        MLS: {prop.mls_number || "N/A"} | Listed: ${formatPrice(prop.listing_price)}
                        {prop.sold_price && ` | Sold: $${formatPrice(prop.sold_price)}`}
                      </dl-text>
                      {prop.notes && (
                        <dl-text size="300" style={{ marginTop: "0.5rem" }}>
                          {prop.notes}
                        </dl-text>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <dl-button
                        variant="secondary"
                        size="sm"
                        onClick={() => router.push(`/admin/properties/${prop.id}`)}
                      >
                        Edit
                      </dl-button>
                      <dl-button
                        variant="danger"
                        size="sm"
                        onClick={() => deleteProperty(prop.id)}
                      >
                        Delete
                      </dl-button>
                    </div>
                  </div>
                </div>
              </dl-card>
            ))}
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
