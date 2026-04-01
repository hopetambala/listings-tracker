"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { getEventValue } from "@/dlite-design-system/wc-helpers";

type Property = Database["public"]["Tables"]["listings_tracker_properties"]["Row"];
type Price = Database["public"]["Tables"]["listings_tracker_prices"]["Row"];
type Photo = Database["public"]["Tables"]["listings_tracker_photos"]["Row"];

export default function PropertyDetail() {
  const [property, setProperty] = useState<Property | null>(null);
  const [prices, setPrices] = useState<Price[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [newPrice, setNewPrice] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const router = useRouter();
  const params = useParams();
  const propertyId = params.id as string;
  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      // Verify code is valid
      const stored = localStorage.getItem("listings_tracker_session");
      if (!stored) {
        router.push("/");
        return;
      }

      try {
        const { code } = JSON.parse(stored);

        // Fetch property
        const { data: prop, error: propError } = await supabase
          .from("listings_tracker_properties")
          .select("*")
          .eq("id", propertyId)
          .single();

        if (propError || !prop) {
          router.push("/properties");
          return;
        }

        // Verify user has access via code
        const { data: codeData } = await supabase
          .from("listings_tracker_access_codes")
          .select("*")
          .eq("code", code)
          .eq("property_id", propertyId)
          .single();

        if (!codeData) {
          router.push("/properties");
          return;
        }

        setProperty(prop);

        // Fetch prices
        const { data: pricesData } = await supabase
          .from("listings_tracker_prices")
          .select("*")
          .eq("property_id", propertyId)
          .order("recorded_at", { ascending: false });
        setPrices(pricesData || []);

        // Fetch photos
        const { data: photosData } = await supabase
          .from("listings_tracker_photos")
          .select("*")
          .eq("property_id", propertyId)
          .order("display_order", { ascending: true });
        setPhotos(photosData || []);
      } catch (err) {
        router.push("/");
      }

      setLoading(false);
    }
    loadData();
  }, [router, propertyId, supabase]);

  async function handleAddPrice() {
    if (!newPrice) {
      alert("Please enter a price");
      return;
    }

    setUploading(true);
    try {
      const { error } = await supabase.from("listings_tracker_prices").insert({
        property_id: propertyId,
        price: parseFloat(newPrice),
      });

      if (error) throw error;

      // Reload prices
      const { data } = await supabase
        .from("listings_tracker_prices")
        .select("*")
        .eq("property_id", propertyId)
        .order("recorded_at", { ascending: false });
      setPrices(data || []);
      setNewPrice("");
    } catch (err: any) {
      alert("Error adding price: " + err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleFileChange(e: any) {
    const files = Array.from(e.target.files || []) as File[];
    setSelectedFiles(files);
  }

  async function handleUploadPhotos() {
    if (selectedFiles.length === 0) {
      alert("Please select at least one file");
      return;
    }

    setUploading(true);
    try {
      const uploadedPhotos: Photo[] = [];

      // Upload all files
      for (const file of selectedFiles) {
        const filename = `${propertyId}/${Date.now()}-${Math.random()}-${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from("listings-tracker-photos")
          .upload(filename, file);

        if (uploadError) {
          console.error("Storage upload error:", uploadError);
          throw new Error(`Storage error: ${uploadError.message}`);
        }

        // Get public URL
        const { data } = supabase.storage
          .from("listings-tracker-photos")
          .getPublicUrl(filename);

        // Insert photo record
        const { data: photoRecord, error: dbError } = await supabase
          .from("listings_tracker_photos")
          .insert({
            property_id: propertyId,
            photo_url: data.publicUrl,
            display_order: photos.length + uploadedPhotos.length,
          })
          .select()
          .single();

        if (dbError) {
          console.error("DB insert error:", dbError);
          throw new Error(`Database error: ${dbError.message}`);
        }
        if (photoRecord) uploadedPhotos.push(photoRecord);
      }

      // Update photos list
      setPhotos([...photos, ...uploadedPhotos]);
      setSelectedFiles([]);

      // Reset file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    } catch (err: any) {
      alert("Error uploading photos: " + err.message);
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <main className="page page--centered">
        <dl-spinner />
      </main>
    );
  }

  if (!property) {
    return (
      <main className="page page--centered">
        <dl-heading level={1}>Property not found</dl-heading>
      </main>
    );
  }

  const currentPrice = prices.length > 0 ? prices[0].price : property.listing_price;
  const priceChange = currentPrice - property.listing_price;
  const priceChangePercent = ((priceChange / property.listing_price) * 100).toFixed(1);

  return (
    <main className="page page--centered">
      <div className="cl-dlite-w-full" style={{ maxWidth: "60rem" }}>
        <div className="cl-dlite-flex cl-dlite-items-center cl-dlite-justify-between cl-dlite-sem-mb-600">
          <dl-heading level={1}>{property.street_address || "Listing"}</dl-heading>
          <dl-button variant="ghost" size="sm" onClick={() => router.push("/properties")}>
            ← Back
          </dl-button>
        </div>

        {/* Overview Card */}
        <dl-card style={{ marginBottom: "2rem" }}>
          <div style={{ padding: "1.5rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
              <div>
                <dl-text size="300" color="secondary">MLS Number</dl-text>
                <dl-text style={{ marginTop: "0.5rem" }}>
                  {property.mls_number || "N/A"}
                </dl-text>
              </div>
              <div>
                <dl-text size="300" color="secondary">Listed Price</dl-text>
                <dl-text style={{ marginTop: "0.5rem" }}>
                  ${property.listing_price}
                </dl-text>
              </div>
              <div>
                <dl-text size="300" color="secondary">Current Price</dl-text>
                <dl-text style={{ marginTop: "0.5rem", fontSize: "1.2rem", fontWeight: "bold" }}>
                  ${currentPrice}
                </dl-text>
              </div>
              <div>
                <dl-text size="300" color="secondary">Change</dl-text>
                <dl-text style={{ marginTop: "0.5rem", color: priceChange >= 0 ? "#4ade80" : "#ef4444" }}>
                  {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(0)} ({priceChangePercent}%)
                </dl-text>
              </div>
              {property.sold_price && (
                <>
                  <div>
                    <dl-text size="300" color="secondary">Sold Price</dl-text>
                    <dl-text style={{ marginTop: "0.5rem" }}>
                      ${property.sold_price}
                    </dl-text>
                  </div>
                </>
              )}
            </div>
          </div>
        </dl-card>

        {/* Add Price Section */}
        <dl-card style={{ marginBottom: "2rem" }}>
          <div style={{ padding: "1.5rem" }}>
            <dl-heading level={2} style={{ marginBottom: "1rem" }}>
              Track Price
            </dl-heading>
            <div style={{ display: "flex", gap: "1rem" }}>
              <dl-input
                type="number"
                placeholder="Enter current price"
                value={newPrice}
                style={{ flex: 1 }}
                onInput={(e: any) => setNewPrice(getEventValue(e))}
              />
              <dl-button
                variant="primary"
                disabled={uploading || undefined}
                onClick={handleAddPrice}
              >
                {uploading ? "Adding..." : "Add Price"}
              </dl-button>
            </div>
          </div>
        </dl-card>

        {/* Price History */}
        {prices.length > 0 && (
          <dl-card style={{ marginBottom: "2rem" }}>
            <div style={{ padding: "1.5rem" }}>
              <dl-heading level={2} style={{ marginBottom: "1rem" }}>
                Price History
              </dl-heading>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {prices.slice(0, 10).map((price, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", paddingBottom: "0.5rem", borderBottom: "1px solid #ddd" }}>
                    <dl-text size="300">${price.price}</dl-text>
                    <dl-text size="300" color="secondary">
                      {new Date(price.recorded_at).toLocaleDateString()}
                    </dl-text>
                  </div>
                ))}
              </div>
            </div>
          </dl-card>
        )}

        {/* Photos Section */}
        <dl-card style={{ marginBottom: "2rem" }}>
          <div style={{ padding: "1.5rem" }}>
            <dl-heading level={2} style={{ marginBottom: "1rem" }}>
              Photos
            </dl-heading>
            <div style={{ marginBottom: "1.5rem", display: "flex", gap: "1rem", alignItems: "center" }}>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                style={{
                  padding: "0.5rem",
                  border: "1px solid #e0e0e0",
                  borderRadius: "0.375rem",
                  flex: 1,
                }}
              />
              {selectedFiles.length > 0 && (
                <dl-text size="300" color="secondary">
                  {selectedFiles.length} file{selectedFiles.length !== 1 ? "s" : ""} selected
                </dl-text>
              )}
              <dl-button
                variant="primary"
                disabled={uploading || selectedFiles.length === 0 || undefined}
                onClick={handleUploadPhotos}
              >
                {uploading ? "Uploading..." : "Upload"}
              </dl-button>
            </div>

            {photos.length === 0 ? (
              <dl-text color="secondary">No photos yet.</dl-text>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "1rem" }}>
                {photos.map((photo) => (
                  <a key={photo.id} href={photo.photo_url} target="_blank" rel="noopener noreferrer" style={{ cursor: "pointer" }}>
                    <img
                      src={photo.photo_url}
                      alt="Property"
                      style={{ width: "100%", height: "150px", objectFit: "cover", borderRadius: "4px" }}
                    />
                  </a>
                ))}
              </div>
            )}
          </div>
        </dl-card>

        <div className="cl-dlite-text-center">
          <dl-button variant="ghost" size="sm" onClick={() => router.push("/properties")}>
            ← Back to Properties
          </dl-button>
        </div>
      </div>
    </main>
  );
}
