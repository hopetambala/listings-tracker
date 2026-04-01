"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type Property = Database["public"]["Tables"]["listings_tracker_properties"]["Row"];

export default function UserProperties() {
  const [code, setCode] = useState("");
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      // Check localStorage for code
      const stored = localStorage.getItem("listings_tracker_session");
      if (!stored) {
        router.push("/");
        return;
      }

      try {
        const { code: storedCode, expiry } = JSON.parse(stored);

        // Check if expired
        if (Date.now() > expiry) {
          localStorage.removeItem("listings_tracker_session");
          router.push("/");
          return;
        }

        setCode(storedCode);

        // Find property by code
        const { data: codeData, error: codeError } = await supabase
          .from("listings_tracker_access_codes")
          .select("property_id")
          .eq("code", storedCode)
          .single();

        if (codeError || !codeData) {
          router.push("/");
          return;
        }

        // Fetch property (this will be limited to all properties from that admin)
        // For now, we fetch the single property
        const { data: prop, error: propError } = await supabase
          .from("listings_tracker_properties")
          .select("*")
          .eq("id", codeData.property_id)
          .single();

        if (propError || !prop) {
          router.push("/");
          return;
        }

        setProperties([prop]);
      } catch (err) {
        router.push("/");
      }

      setLoading(false);
    }
    loadData();
  }, [router, supabase]);

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
          <dl-heading level={1}>Listings</dl-heading>
        </div>

        {properties.length === 0 ? (
          <dl-card>
            <div style={{ padding: "2rem", textAlign: "center" }}>
              <dl-text color="secondary">No properties available with this code.</dl-text>
            </div>
          </dl-card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {properties.map((prop) => (
              <dl-card key={prop.id} style={{ cursor: "pointer" }} onClick={() => router.push(`/property/${prop.id}`)}>
                <div style={{ padding: "1.5rem" }}>
                  <dl-heading level={3}>{prop.street_address || "No address"}</dl-heading>
                  <dl-text color="secondary" size="300" style={{ marginTop: "0.5rem" }}>
                    MLS: {prop.mls_number || "N/A"} | Listed at: ${prop.listing_price}
                    {prop.sold_price && ` | Sold: $${prop.sold_price}`}
                  </dl-text>
                  {prop.notes && (
                    <dl-text size="300" style={{ marginTop: "0.5rem" }}>
                      {prop.notes}
                    </dl-text>
                  )}
                </div>
              </dl-card>
            ))}
          </div>
        )}

        <div className="cl-dlite-text-center cl-dlite-sem-mt-600">
          <dl-button
            variant="ghost"
            size="sm"
            onClick={() => {
              localStorage.removeItem("listings_tracker_session");
              router.push("/");
            }}
          >
            Sign Out
          </dl-button>
        </div>
      </div>
    </main>
  );
}
