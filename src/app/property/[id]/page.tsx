"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { getEventValue } from "@/dlite-design-system/wc-helpers";
import { formatPrice } from "@/lib/formatters";

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
  const [editingAddress, setEditingAddress] = useState(false);
  const [newAddress, setNewAddress] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [newNotes, setNewNotes] = useState("");
  const [editingLink, setEditingLink] = useState(false);
  const [newLink, setNewLink] = useState("");
  const [savingLink, setSavingLink] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
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
        setNewAddress(prop.street_address || "");
        setNewNotes(prop.notes || "");
        setNewLink(prop.listing_link || "");

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

  async function handleUpdateAddress() {
    if (!newAddress.trim()) {
      alert("Please enter an address");
      return;
    }

    setSavingAddress(true);
    try {
      const { error } = await supabase
        .from("listings_tracker_properties")
        .update({ street_address: newAddress })
        .eq("id", propertyId);

      if (error) throw error;

      setProperty({ ...property!, street_address: newAddress });
      setEditingAddress(false);
    } catch (err: any) {
      alert("Error updating address: " + err.message);
    } finally {
      setSavingAddress(false);
    }
  }

  async function handleUpdateNotes() {
    setSavingNotes(true);
    try {
      const { error } = await supabase
        .from("listings_tracker_properties")
        .update({ notes: newNotes })
        .eq("id", propertyId);

      if (error) throw error;

      setProperty({ ...property!, notes: newNotes });
      setEditingNotes(false);
    } catch (err: any) {
      alert("Error updating notes: " + err.message);
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleUpdateLink() {
    if (!newLink.trim()) {
      alert("Please enter a valid URL");
      return;
    }

    setSavingLink(true);
    try {
      const { error } = await supabase
        .from("listings_tracker_properties")
        .update({ listing_link: newLink })
        .eq("id", propertyId);

      if (error) throw error;

      setProperty({ ...property!, listing_link: newLink });
      setEditingLink(false);
    } catch (err: any) {
      alert("Error updating link: " + err.message);
    } finally {
      setSavingLink(false);
    }
  }

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

  const openGallery = (index: number) => {
    setGalleryIndex(index);
    setGalleryOpen(true);
  };

  const nextPhoto = () => {
    setGalleryIndex((prev) => (prev + 1) % photos.length);
  };

  const prevPhoto = () => {
    setGalleryIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

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
      <div className="cl-dlite-w-full" style={{ maxWidth: "60rem", padding: "0 1rem" }}>
        <div className="header-row" style={{ marginBottom: "1.5rem" }}>
          {editingAddress ? (
            <div style={{ width: "100%", display: "flex", gap: "0.5rem", flexDirection: "column", alignItems: "stretch" }}>
              <dl-input
                label="Address"
                value={newAddress}
                onInput={(e: any) => setNewAddress(getEventValue(e))}
              />
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <dl-button
                  variant="primary"
                  size="sm"
                  onClick={handleUpdateAddress}
                  disabled={savingAddress}
                  full-width
                >
                  {savingAddress ? "Saving..." : "Save"}
                </dl-button>
                <dl-button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setEditingAddress(false);
                    setNewAddress(property.street_address || "");
                  }}
                  disabled={savingAddress}
                  full-width
                >
                  Cancel
                </dl-button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", flex: 1, flexWrap: "wrap" }}>
              <dl-heading level={1} style={{ wordBreak: "break-word" }}>{property.street_address || "Listing"}</dl-heading>
              <dl-button variant="ghost" size="sm" onClick={() => setEditingAddress(true)}>
                Edit
              </dl-button>
            </div>
          )}
          <dl-button variant="ghost" size="sm" onClick={() => router.push("/properties")}>
            ← Back
          </dl-button>
        </div>

        {/* Overview Card */}
        <dl-card style={{ marginBottom: "2rem" }}>
          <div style={{ padding: "1.5rem" }}>
            <div className="form-grid">
              <div>
                <dl-text size="300" color="secondary">MLS Number</dl-text>
                <dl-text style={{ marginTop: "0.5rem" }}>
                  {property.mls_number || "N/A"}
                </dl-text>
              </div>
              <div>
                <dl-text size="300" color="secondary">Listed Price</dl-text>
                <dl-text style={{ marginTop: "0.5rem" }}>
                  ${formatPrice(property.listing_price)}
                </dl-text>
              </div>
              <div>
                <dl-text size="300" color="secondary">Current Price</dl-text>
                <dl-text style={{ marginTop: "0.5rem", fontSize: "1.2rem", fontWeight: "bold" }}>
                  ${formatPrice(currentPrice)}
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
                      ${formatPrice(property.sold_price)}
                    </dl-text>
                  </div>
                </>
              )}
            </div>
          </div>
        </dl-card>

        {/* Listing Link Section */}
        <dl-card style={{ marginBottom: "2rem" }}>
          <div style={{ padding: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
              <dl-heading level={2} style={{ margin: 0 }}>
                Listing Link
              </dl-heading>
              {!editingLink && (
                <dl-button variant="ghost" size="sm" onClick={() => setEditingLink(true)}>
                  Edit
                </dl-button>
              )}
            </div>
            {editingLink ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <dl-input
                  label="URL"
                  type="url"
                  value={newLink}
                  onInput={(e: any) => setNewLink(getEventValue(e))}
                  placeholder="https://www.zillow.com/..."
                  full-width
                />
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <dl-button
                    variant="primary"
                    size="sm"
                    onClick={handleUpdateLink}
                    disabled={savingLink}
                    full-width
                  >
                    {savingLink ? "Saving..." : "Save"}
                  </dl-button>
                  <dl-button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setEditingLink(false);
                      setNewLink(property.listing_link || "");
                    }}
                    disabled={savingLink}
                    full-width
                  >
                    Cancel
                  </dl-button>
                </div>
              </div>
            ) : (
              <div>
                {property.listing_link ? (
                  <dl-button
                    variant="ghost"
                    style={{ justifyContent: "flex-start", wordBreak: "break-all" }}
                    onClick={() => window.open(property.listing_link, '_blank')}
                  >
                    {property.listing_link}
                  </dl-button>
                ) : (
                  <dl-text color="secondary">No listing link yet.</dl-text>
                )}
              </div>
            )}
          </div>
        </dl-card>

        {/* Add Price Section */}
        <dl-card style={{ marginBottom: "2rem" }}>
          <div style={{ padding: "1.5rem" }}>
            <dl-heading level={2} style={{ marginBottom: "1rem" }}>
              Track Price
            </dl-heading>
            <div className="form-row">
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
                    <dl-text size="300">${formatPrice(price.price)}</dl-text>
                    <dl-text size="300" color="secondary">
                      {new Date(price.recorded_at).toLocaleDateString()}
                    </dl-text>
                  </div>
                ))}
              </div>
            </div>
          </dl-card>
        )}

        {/* Notes Section */}
        <dl-card style={{ marginBottom: "2rem" }}>
          <div style={{ padding: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
              <dl-heading level={2} style={{ margin: 0 }}>
                Notes
              </dl-heading>
              {!editingNotes && (
                <dl-button variant="ghost" size="sm" onClick={() => setEditingNotes(true)}>
                  {property.notes ? "Edit" : "Add"}
                </dl-button>
              )}
            </div>
            {editingNotes ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Add any notes about this property..."
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #e0e0e0",
                    borderRadius: "0.375rem",
                    fontFamily: "inherit",
                    fontSize: "0.875rem",
                    resize: "vertical",
                    minHeight: "120px",
                  }}
                />
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <dl-button
                    variant="primary"
                    size="sm"
                    onClick={handleUpdateNotes}
                    disabled={savingNotes}
                    full-width
                  >
                    {savingNotes ? "Saving..." : "Save"}
                  </dl-button>
                  <dl-button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setEditingNotes(false);
                      setNewNotes(property.notes || "");
                    }}
                    disabled={savingNotes}
                    full-width
                  >
                    Cancel
                  </dl-button>
                </div>
              </div>
            ) : (
              <div>
                {property.notes ? (
                  <dl-text style={{ whiteSpace: "pre-wrap", wordWrap: "break-word" }}>
                    {property.notes}
                  </dl-text>
                ) : (
                  <dl-text color="secondary">No notes yet.</dl-text>
                )}
              </div>
            )}
          </div>
        </dl-card>

        {/* Photos Section */}
        <dl-card style={{ marginBottom: "2rem" }}>
          <div style={{ padding: "1.5rem" }}>
            <dl-heading level={2} style={{ marginBottom: "1rem" }}>
              Photos
            </dl-heading>
            <div style={{ marginBottom: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                style={{
                  padding: "0.5rem",
                  border: "1px solid #e0e0e0",
                  borderRadius: "0.375rem",
                  width: "100%",
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
                full-width
              >
                {uploading ? "Uploading..." : "Upload"}
              </dl-button>
            </div>

            {photos.length === 0 ? (
              <dl-text color="secondary">No photos yet.</dl-text>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "1rem" }}>
                {photos.map((photo, index) => (
                  <div
                    key={photo.id}
                    onClick={() => openGallery(index)}
                    style={{ cursor: "pointer", position: "relative", overflow: "hidden", borderRadius: "4px" }}
                  >
                    <img
                      src={photo.photo_url}
                      alt="Property"
                      style={{
                        width: "100%",
                        height: "150px",
                        objectFit: "cover",
                        borderRadius: "4px",
                        transition: "transform 0.2s",
                      }}
                      onMouseEnter={(e) => ((e.target as HTMLImageElement).style.transform = "scale(1.05)")}
                      onMouseLeave={(e) => ((e.target as HTMLImageElement).style.transform = "scale(1)")}
                    />
                  </div>
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

      {/* Photo Gallery Modal */}
      {galleryOpen && photos.length > 0 && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
          onClick={() => setGalleryOpen(false)}
        >
          <div
            style={{
              position: "relative",
              maxWidth: "90vw",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setGalleryOpen(false)}
              style={{
                position: "absolute",
                top: "-2.5rem",
                right: 0,
                background: "none",
                border: "none",
                color: "white",
                fontSize: "2rem",
                cursor: "pointer",
                padding: "0.5rem",
              }}
            >
              ✕
            </button>

            {/* Image */}
            <img
              src={photos[galleryIndex].photo_url}
              alt={`Photo ${galleryIndex + 1}`}
              style={{
                maxWidth: "100%",
                maxHeight: "calc(90vh - 80px)",
                objectFit: "contain",
                borderRadius: "0.5rem",
              }}
            />

            {/* Controls */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "2rem",
                marginTop: "1.5rem",
                color: "white",
              }}
            >
              <button
                onClick={prevPhoto}
                style={{
                  background: "rgba(255, 255, 255, 0.2)",
                  border: "1px solid white",
                  color: "white",
                  padding: "0.75rem 1.5rem",
                  borderRadius: "0.375rem",
                  cursor: "pointer",
                  fontSize: "1rem",
                }}
              >
                ← Prev
              </button>

              <div style={{ fontSize: "0.875rem" }}>
                {galleryIndex + 1} of {photos.length}
              </div>

              <button
                onClick={nextPhoto}
                style={{
                  background: "rgba(255, 255, 255, 0.2)",
                  border: "1px solid white",
                  color: "white",
                  padding: "0.75rem 1.5rem",
                  borderRadius: "0.375rem",
                  cursor: "pointer",
                  fontSize: "1rem",
                }}
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
