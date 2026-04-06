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
  const [savingNotes, setSavingNotes] = useState(false);
  const [editingLink, setEditingLink] = useState(false);
  const [newLink, setNewLink] = useState("");
  const [savingLink, setSavingLink] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [settingKeyPhoto, setSettingKeyPhoto] = useState(false);
  const router = useRouter();
  const params = useParams();
  const propertyId = params.id as string;
  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      const stored = localStorage.getItem("listings_tracker_session");
      if (!stored) {
        router.push("/");
        return;
      }

      try {
        const { code } = JSON.parse(stored);

        const { data: prop, error: propError } = await supabase
          .from("listings_tracker_properties")
          .select("*")
          .eq("id", propertyId)
          .single();

        if (propError || !prop) {
          router.push("/properties");
          return;
        }

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

        const { data: pricesData } = await supabase
          .from("listings_tracker_prices")
          .select("*")
          .eq("property_id", propertyId)
          .order("recorded_at", { ascending: false });
        setPrices(pricesData || []);

        const { data: photosData } = await supabase
          .from("listings_tracker_photos")
          .select("*")
          .eq("property_id", propertyId)
          .order("display_order", { ascending: true });
        setPhotos(photosData || []);
      } catch {
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
      for (const file of selectedFiles) {
        const filename = `${propertyId}/${Date.now()}-${Math.random()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("listings-tracker-photos")
          .upload(filename, file);
        if (uploadError) throw new Error(`Storage error: ${uploadError.message}`);

        const { data } = supabase.storage
          .from("listings-tracker-photos")
          .getPublicUrl(filename);

        const { data: photoRecord, error: dbError } = await supabase
          .from("listings_tracker_photos")
          .insert({
            property_id: propertyId,
            photo_url: data.publicUrl,
            display_order: photos.length + uploadedPhotos.length,
          })
          .select()
          .single();
        if (dbError) throw new Error(`Database error: ${dbError.message}`);
        if (photoRecord) uploadedPhotos.push(photoRecord);
      }
      setPhotos([...photos, ...uploadedPhotos]);
      setSelectedFiles([]);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    } catch (err: any) {
      alert("Error uploading photos: " + err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSetKeyPhoto(photoId: string) {
    setSettingKeyPhoto(true);
    try {
      // Clear any existing key photo for this property
      await supabase
        .from("listings_tracker_photos")
        .update({ is_key_photo: false })
        .eq("property_id", propertyId);

      // Set the new key photo
      const { error } = await supabase
        .from("listings_tracker_photos")
        .update({ is_key_photo: true })
        .eq("id", photoId);
      if (error) throw error;

      setPhotos(photos.map((p) => ({ ...p, is_key_photo: p.id === photoId })));
    } catch (err: any) {
      alert("Error setting key photo: " + err.message);
    } finally {
      setSettingKeyPhoto(false);
    }
  }

  const openGallery = (index: number) => {
    setGalleryIndex(index);
    setGalleryOpen(true);
  };

  const nextPhoto = () => setGalleryIndex((prev) => (prev + 1) % photos.length);
  const prevPhoto = () => setGalleryIndex((prev) => (prev - 1 + photos.length) % photos.length);

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

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          {editingAddress ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <dl-input
                label="Address"
                value={newAddress}
                onInput={(e: any) => setNewAddress(getEventValue(e))}
              />
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <dl-button variant="primary" size="sm" onClick={handleUpdateAddress} disabled={savingAddress} full-width>
                  {savingAddress ? "Saving..." : "Save"}
                </dl-button>
                <dl-button variant="secondary" size="sm" onClick={() => { setEditingAddress(false); setNewAddress(property.street_address || ""); }} disabled={savingAddress} full-width>
                  Cancel
                </dl-button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1, flexWrap: "wrap" }}>
              <dl-heading level={1} style={{ wordBreak: "break-word", margin: 0 }}>
                {property.street_address || "Listing"}
              </dl-heading>
              <dl-button variant="ghost" size="sm" onClick={() => setEditingAddress(true)}>
                Edit
              </dl-button>
            </div>
          )}
          <dl-button variant="ghost" size="sm" onClick={() => router.push("/properties")}>
            ← Back
          </dl-button>
        </div>

        {/* Overview */}
        <dl-card style={{ marginBottom: "1.5rem" }}>
          <div style={{ padding: "1.5rem" }}>
            <div className="form-grid">
              <div>
                <dl-text size="300" color="secondary">MLS Number</dl-text>
                <dl-text style={{ marginTop: "0.25rem" }}>{property.mls_number || "N/A"}</dl-text>
              </div>
              <div>
                <dl-text size="300" color="secondary">Listed Price</dl-text>
                <dl-text style={{ marginTop: "0.25rem" }}>${formatPrice(property.listing_price)}</dl-text>
              </div>
              <div>
                <dl-text size="300" color="secondary">Current Price</dl-text>
                <dl-text style={{ marginTop: "0.25rem", fontSize: "1.1rem", fontWeight: "bold" }}>
                  ${formatPrice(currentPrice)}
                </dl-text>
              </div>
              <div>
                <dl-text size="300" color="secondary">Change</dl-text>
                <dl-text style={{ marginTop: "0.25rem", color: priceChange >= 0 ? "#4ade80" : "#ef4444" }}>
                  {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(0)} ({priceChangePercent}%)
                </dl-text>
              </div>
              {property.sold_price && (
                <div>
                  <dl-text size="300" color="secondary">Sold Price</dl-text>
                  <dl-text style={{ marginTop: "0.25rem" }}>${formatPrice(property.sold_price)}</dl-text>
                </div>
              )}
            </div>
          </div>
        </dl-card>

        {/* Listing Link */}
        <dl-card style={{ marginBottom: "1.5rem" }}>
          <div style={{ padding: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
              <dl-heading level={2} style={{ margin: 0 }}>Listing Link</dl-heading>
              {!editingLink && (
                <dl-button variant="ghost" size="sm" onClick={() => setEditingLink(true)}>Edit</dl-button>
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
                  <dl-button variant="primary" size="sm" onClick={handleUpdateLink} disabled={savingLink} full-width>
                    {savingLink ? "Saving..." : "Save"}
                  </dl-button>
                  <dl-button variant="secondary" size="sm" onClick={() => { setEditingLink(false); setNewLink(property.listing_link || ""); }} disabled={savingLink} full-width>
                    Cancel
                  </dl-button>
                </div>
              </div>
            ) : property.listing_link ? (
              <a
                href={property.listing_link}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "inherit", wordBreak: "break-all", fontSize: "0.875rem" }}
              >
                {property.listing_link}
              </a>
            ) : (
              <dl-text color="secondary">No listing link yet.</dl-text>
            )}
          </div>
        </dl-card>

        {/* Price Tracking + History */}
        <dl-card style={{ marginBottom: "1.5rem" }}>
          <div style={{ padding: "1.5rem" }}>
            <dl-heading level={2} style={{ marginBottom: "1rem" }}>Price History</dl-heading>
            <div className="form-row" style={{ marginBottom: prices.length > 0 ? "1.25rem" : 0 }}>
              <dl-input
                type="number"
                placeholder="Enter current price"
                value={newPrice}
                style={{ flex: 1 }}
                onInput={(e: any) => setNewPrice(getEventValue(e))}
              />
              <dl-button variant="primary" disabled={uploading || undefined} onClick={handleAddPrice}>
                {uploading ? "Adding..." : "Add Price"}
              </dl-button>
            </div>
            {prices.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {prices.slice(0, 10).map((price, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", paddingBottom: "0.5rem", borderBottom: "1px solid #e5e7eb" }}>
                    <dl-text size="300">${formatPrice(price.price)}</dl-text>
                    <dl-text size="300" color="secondary">
                      {new Date(price.recorded_at).toLocaleDateString()}
                    </dl-text>
                  </div>
                ))}
              </div>
            )}
          </div>
        </dl-card>

        {/* Notes */}
        <dl-card style={{ marginBottom: "1.5rem" }}>
          <div style={{ padding: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
              <dl-heading level={2} style={{ margin: 0 }}>Notes</dl-heading>
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
                    boxSizing: "border-box",
                  }}
                />
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <dl-button variant="primary" size="sm" onClick={handleUpdateNotes} disabled={savingNotes} full-width>
                    {savingNotes ? "Saving..." : "Save"}
                  </dl-button>
                  <dl-button variant="secondary" size="sm" onClick={() => { setEditingNotes(false); setNewNotes(property.notes || ""); }} disabled={savingNotes} full-width>
                    Cancel
                  </dl-button>
                </div>
              </div>
            ) : property.notes ? (
              <dl-text style={{ whiteSpace: "pre-wrap", wordWrap: "break-word" }}>{property.notes}</dl-text>
            ) : (
              <dl-text color="secondary">No notes yet.</dl-text>
            )}
          </div>
        </dl-card>

        {/* Photos */}
        <dl-card style={{ marginBottom: "1.5rem" }}>
          <div style={{ padding: "1.5rem" }}>
            <dl-heading level={2} style={{ marginBottom: "1rem" }}>Photos</dl-heading>
            <div style={{ marginBottom: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                style={{ padding: "0.5rem", border: "1px solid #e0e0e0", borderRadius: "0.375rem", width: "100%" }}
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
                  <div key={photo.id} style={{ position: "relative", borderRadius: "6px", overflow: "hidden" }}>
                    <img
                      src={photo.photo_url}
                      alt="Property"
                      onClick={() => openGallery(index)}
                      style={{
                        width: "100%",
                        height: "150px",
                        objectFit: "cover",
                        display: "block",
                        cursor: "pointer",
                        transition: "opacity 0.2s",
                      }}
                      onMouseEnter={(e) => ((e.target as HTMLImageElement).style.opacity = "0.85")}
                      onMouseLeave={(e) => ((e.target as HTMLImageElement).style.opacity = "1")}
                    />
                    {/* Key photo badge */}
                    {photo.is_key_photo && (
                      <div style={{
                        position: "absolute",
                        top: "6px",
                        left: "6px",
                        background: "rgba(0,0,0,0.65)",
                        color: "#facc15",
                        borderRadius: "4px",
                        padding: "2px 6px",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        letterSpacing: "0.03em",
                        pointerEvents: "none",
                      }}>
                        ★ Key Photo
                      </div>
                    )}
                    {/* Set as key photo button */}
                    {!photo.is_key_photo && (
                      <button
                        onClick={() => handleSetKeyPhoto(photo.id)}
                        disabled={settingKeyPhoto}
                        style={{
                          position: "absolute",
                          bottom: "6px",
                          left: "50%",
                          transform: "translateX(-50%)",
                          background: "rgba(0,0,0,0.65)",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          padding: "4px 8px",
                          fontSize: "0.7rem",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Set as key photo
                      </button>
                    )}
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
            inset: 0,
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
                padding: "0.25rem 0.5rem",
              }}
            >
              ✕
            </button>

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

            <div style={{ display: "flex", alignItems: "center", gap: "2rem", marginTop: "1.5rem", color: "white" }}>
              <button
                onClick={prevPhoto}
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "1px solid rgba(255,255,255,0.4)",
                  color: "white",
                  padding: "0.6rem 1.25rem",
                  borderRadius: "0.375rem",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                }}
              >
                ← Prev
              </button>
              <span style={{ fontSize: "0.875rem" }}>{galleryIndex + 1} / {photos.length}</span>
              <button
                onClick={nextPhoto}
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "1px solid rgba(255,255,255,0.4)",
                  color: "white",
                  padding: "0.6rem 1.25rem",
                  borderRadius: "0.375rem",
                  cursor: "pointer",
                  fontSize: "0.9rem",
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
