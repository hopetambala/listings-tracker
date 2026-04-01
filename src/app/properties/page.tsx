"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type Property = Database["public"]["Tables"]["listings_tracker_properties"]["Row"];
type Photo = Database["public"]["Tables"]["listings_tracker_photos"]["Row"];

export default function UserProperties() {
  const [code, setCode] = useState("");
  const [properties, setProperties] = useState<Property[]>([]);
  const [heroImages, setHeroImages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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

        // Find ALL properties for this code
        const { data: codeRows, error: codeError } = await supabase
          .from("listings_tracker_access_codes")
          .select("property_id")
          .eq("code", storedCode);

        if (codeError || !codeRows || codeRows.length === 0) {
          setError("No properties found for this code. Please check your code and try again.");
          setLoading(false);
          return;
        }

        const propertyIds = codeRows.map((r) => r.property_id);

        // Fetch all matching properties
        const { data: propsData, error: propError } = await supabase
          .from("listings_tracker_properties")
          .select("*")
          .in("id", propertyIds)
          .order("created_at", { ascending: false });

        if (propError || !propsData) {
          setError("Failed to load properties. Please try again.");
          setLoading(false);
          return;
        }

        setProperties(propsData);

        // Fetch first photo for each property (hero images)
        const heroMap: Record<string, string> = {};
        await Promise.all(
          propsData.map(async (prop) => {
            const { data: photosData } = await supabase
              .from("listings_tracker_photos")
              .select("photo_url")
              .eq("property_id", prop.id)
              .order("display_order", { ascending: true })
              .limit(1);
            if (photosData && photosData.length > 0) {
              heroMap[prop.id] = photosData[0].photo_url;
            }
          })
        );
        setHeroImages(heroMap);
      } catch (err) {
        setError("Something went wrong. Please try again.");
        setLoading(false);
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

  if (error) {
    return (
      <main className="page page--centered">
        <div className="cl-dlite-text-center">
          <dl-heading level={2}>Something went wrong</dl-heading>
          <dl-text color="secondary" style={{ margin: "1rem 0", display: "block" }}>{error}</dl-text>
          <dl-button
            variant="primary"
            size="md"
            onClick={() => {
              localStorage.removeItem("listings_tracker_session");
              router.push("/");
            }}
          >
            Try a Different Code
          </dl-button>
        </div>
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
                {heroImages[prop.id] && (
                  <img
                    src={heroImages[prop.id]}
                    alt={prop.street_address || "Property"}
                    style={{
                      width: "100%",
                      height: "220px",
                      objectFit: "cover",
                      display: "block",
                      borderRadius: "var(--tk-dlite-semantic-border-radius-md) var(--tk-dlite-semantic-border-radius-md) 0 0",
                    }}
                  />
                )}
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
