"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Metrics {
  totalProperties: number;
  propsWithPhotos: number;
  propsWithPrices: number;
  soldProperties: number;
}

export default function AdminDashboard() {
  const [user, setUser] = useState<any>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/admin"); return; }
      setUser(user);

      // Fetch all property IDs for this admin
      const { data: props } = await supabase
        .from("listings_tracker_properties")
        .select("id, sold_price, status")
        .eq("admin_id", user.id);

      const ids = props?.map((p) => p.id) ?? [];
      const total = ids.length;
      const sold = props?.filter((p) => p.sold_price != null || p.status === "sold").length ?? 0;

      let propsWithPhotos = 0;
      let propsWithPrices = 0;

      if (ids.length > 0) {
        const { data: photoRows } = await supabase
          .from("listings_tracker_photos")
          .select("property_id")
          .in("property_id", ids);
        propsWithPhotos = new Set(photoRows?.map((r) => r.property_id)).size;

        const { data: priceRows } = await supabase
          .from("listings_tracker_prices")
          .select("property_id")
          .in("property_id", ids);
        propsWithPrices = new Set(priceRows?.map((r) => r.property_id)).size;
      }

      setMetrics({ totalProperties: total, propsWithPhotos, propsWithPrices, soldProperties: sold });
      setLoading(false);
    };
    checkAuth();
  }, [router, supabase.auth]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) {
    return <main className="page page--centered"><dl-spinner /></main>;
  }

  const statCards = [
    { label: "Total Properties", value: metrics?.totalProperties ?? 0, color: "#3b82f6" },
    { label: "With Photos", value: metrics?.propsWithPhotos ?? 0, color: "#8b5cf6" },
    { label: "Price Tracked", value: metrics?.propsWithPrices ?? 0, color: "#f59e0b" },
    { label: "Sold", value: metrics?.soldProperties ?? 0, color: "#22c55e" },
  ];

  return (
    <main className="page page--centered">
      <div className="cl-dlite-w-full" style={{ maxWidth: "50rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <dl-heading level={1}>Dashboard</dl-heading>
          <dl-button variant="ghost" size="sm" onClick={handleSignOut}>Sign Out</dl-button>
        </div>

        <dl-text color="secondary" style={{ display: "block", marginBottom: "1.5rem" }}>
          Signed in as <strong>{user?.email}</strong>
        </dl-text>

        {/* Metrics row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
          {statCards.map((s) => (
            <dl-card key={s.label}>
              <div style={{ padding: "1.25rem 1rem", textAlign: "center" }}>
                <div style={{ fontSize: "2rem", fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "0.35rem" }}>{s.label}</div>
              </div>
            </dl-card>
          ))}
        </div>

        {/* Navigation */}
        <dl-card>
          <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <dl-button variant="primary" full-width onClick={() => router.push("/admin/properties")}>
              Manage Properties
            </dl-button>
            <dl-button variant="secondary" full-width onClick={() => router.push("/admin/bulk-upload")}>
              Bulk Upload CSV
            </dl-button>
            <dl-button variant="secondary" full-width onClick={() => router.push("/admin/codes")}>
              Manage Access Codes
            </dl-button>
          </div>
        </dl-card>

        <div className="cl-dlite-text-center cl-dlite-sem-mt-600">
          <dl-button variant="ghost" size="sm" onClick={() => router.push("/")}>← Back to Home</dl-button>
        </div>
      </div>
    </main>
  );
}
