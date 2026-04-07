"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { getEventValue, WcInputEvent } from "@/dlite-design-system/wc-helpers";
import { formatPrice } from "@/lib/formatters";

type Property = Database["public"]["Tables"]["listings_tracker_properties"]["Row"];
type Price = Database["public"]["Tables"]["listings_tracker_prices"]["Row"];
type Photo = Database["public"]["Tables"]["listings_tracker_photos"]["Row"];

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ["active", "pending", "sold", "withdrawn"] as const;
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
      display: "inline-block", padding: "3px 12px", borderRadius: "9999px",
      fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
      background: s.bg, border: `1.5px solid ${s.border}`, color: s.color,
    }}>
      {s.label}
    </span>
  );
}

function InlineError({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <dl-text color="danger" size="300" style={{ marginTop: "0.5rem", display: "block" }}>
      {msg}
    </dl-text>
  );
}

function PriceChart({ prices }: { prices: Price[] }) {
  if (prices.length < 2) return null;
  const sorted = [...prices].reverse(); // chronological order
  const vals = sorted.map((p) => p.price);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const W = 400, H = 80, PAD = 6;
  const pts = sorted
    .map((p, i) => {
      const x = PAD + (i / (sorted.length - 1)) * (W - PAD * 2);
      const y = PAD + (1 - (p.price - min) / range) * (H - PAD * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const isUp = sorted[sorted.length - 1].price >= sorted[0].price;
  const color = isUp ? "#22c55e" : "#ef4444";
  return (
    <div style={{ marginTop: "1rem" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {sorted.map((p, i) => {
          const x = PAD + (i / (sorted.length - 1)) * (W - PAD * 2);
          const y = PAD + (1 - (p.price - min) / range) * (H - PAD * 2);
          return <circle key={i} cx={x} cy={y} r="3.5" fill={color} />;
        })}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "#9ca3af", marginTop: "2px" }}>
        <span>${formatPrice(min)}</span>
        <span>${formatPrice(max)}</span>
      </div>
    </div>
  );
}

function getStoragePath(url: string): string {
  const marker = "/listings-tracker-photos/";
  const idx = url.indexOf(marker);
  return idx >= 0 ? decodeURIComponent(url.slice(idx + marker.length)) : url;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PropertyDetail() {
  const [property, setProperty] = useState<Property | null>(null);
  const [prices, setPrices] = useState<Price[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);

  // Address editing
  const [editingAddress, setEditingAddress] = useState(false);
  const [newAddress, setNewAddress] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressError, setAddressError] = useState("");

  // Status editing
  const [editingStatus, setEditingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  // Notes editing
  const [editingNotes, setEditingNotes] = useState(false);
  const [newNotes, setNewNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesError, setNotesError] = useState("");

  // Link editing
  const [editingLink, setEditingLink] = useState(false);
  const [newLink, setNewLink] = useState("");
  const [savingLink, setSavingLink] = useState(false);
  const [linkError, setLinkError] = useState("");

  // Price tracking
  const [newPrice, setNewPrice] = useState("");
  const [priceDate, setPriceDate] = useState("");
  const [addingPrice, setAddingPrice] = useState(false);
  const [priceError, setPriceError] = useState("");

  // Photo upload
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");

  // Photo actions
  const [settingKeyPhoto, setSettingKeyPhoto] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [photoActionError, setPhotoActionError] = useState("");

  // Photo captions
  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null);
  const [captionText, setCaptionText] = useState("");
  const [savingCaption, setSavingCaption] = useState(false);

  // Gallery
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const router = useRouter();
  const params = useParams();
  const propertyId = params.id as string;
  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      const stored = localStorage.getItem("listings_tracker_session");
      if (!stored) { router.push("/"); return; }
      try {
        const { code } = JSON.parse(stored);
        const { data: prop, error: propError } = await supabase
          .from("listings_tracker_properties").select("*").eq("id", propertyId).single();
        if (propError || !prop) { router.push("/properties"); return; }
        const { data: codeData } = await supabase
          .from("listings_tracker_access_codes").select("*").eq("code", code).eq("property_id", propertyId).single();
        if (!codeData) { router.push("/properties"); return; }
        setProperty(prop);
        setNewAddress(prop.street_address || "");
        setNewNotes(prop.notes || "");
        setNewLink(prop.listing_link || "");
        setNewStatus(prop.status ?? "active");
        const { data: pricesData } = await supabase
          .from("listings_tracker_prices").select("*").eq("property_id", propertyId).order("recorded_at", { ascending: false });
        setPrices(pricesData || []);
        const { data: photosData } = await supabase
          .from("listings_tracker_photos").select("*").eq("property_id", propertyId).order("display_order", { ascending: true });
        setPhotos(photosData || []);
      } catch { router.push("/"); }
      setLoading(false);
    }
    loadData();
  }, [router, propertyId, supabase]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleUpdateAddress() {
    if (!newAddress.trim()) { setAddressError("Address cannot be empty."); return; }
    setSavingAddress(true); setAddressError("");
    try {
      const { error } = await supabase.from("listings_tracker_properties").update({ street_address: newAddress }).eq("id", propertyId);
      if (error) throw error;
      setProperty({ ...property!, street_address: newAddress });
      setEditingAddress(false);
    } catch (err: any) { setAddressError(err.message); }
    finally { setSavingAddress(false); }
  }

  async function handleUpdateStatus() {
    setSavingStatus(true);
    try {
      const { error } = await supabase.from("listings_tracker_properties").update({ status: newStatus }).eq("id", propertyId);
      if (error) throw error;
      setProperty({ ...property!, status: newStatus });
      setEditingStatus(false);
    } catch { /* silent — status is non-critical */ }
    finally { setSavingStatus(false); }
  }

  async function handleUpdateNotes() {
    setSavingNotes(true); setNotesError("");
    try {
      const { error } = await supabase.from("listings_tracker_properties").update({ notes: newNotes }).eq("id", propertyId);
      if (error) throw error;
      setProperty({ ...property!, notes: newNotes });
      setEditingNotes(false);
    } catch (err: any) { setNotesError(err.message); }
    finally { setSavingNotes(false); }
  }

  async function handleUpdateLink() {
    if (!newLink.trim()) { setLinkError("Please enter a valid URL."); return; }
    setSavingLink(true); setLinkError("");
    try {
      const { error } = await supabase.from("listings_tracker_properties").update({ listing_link: newLink }).eq("id", propertyId);
      if (error) throw error;
      setProperty({ ...property!, listing_link: newLink });
      setEditingLink(false);
    } catch (err: any) { setLinkError(err.message); }
    finally { setSavingLink(false); }
  }

  async function handleAddPrice() {
    if (!newPrice) { setPriceError("Please enter a price."); return; }
    setAddingPrice(true); setPriceError("");
    try {
      const insertPayload: any = { property_id: propertyId, price: parseFloat(newPrice) };
      if (priceDate) insertPayload.recorded_at = priceDate;
      const { error } = await supabase.from("listings_tracker_prices").insert(insertPayload);
      if (error) throw error;
      const { data } = await supabase.from("listings_tracker_prices").select("*").eq("property_id", propertyId).order("recorded_at", { ascending: false });
      setPrices(data || []);
      setNewPrice("");
      setPriceDate("");
    } catch (err: any) { setPriceError(err.message); }
    finally { setAddingPrice(false); }
  }

  async function handleFileChange(e: any) {
    setSelectedFiles(Array.from(e.target.files || []) as File[]);
    setPhotoError("");
  }

  async function handleUploadPhotos() {
    if (selectedFiles.length === 0) { setPhotoError("Please select at least one file."); return; }
    setUploading(true); setPhotoError("");
    try {
      const uploaded: Photo[] = [];
      for (const file of selectedFiles) {
        const filename = `${propertyId}/${Date.now()}-${Math.random()}-${file.name}`;
        const { error: uploadError } = await supabase.storage.from("listings-tracker-photos").upload(filename, file);
        if (uploadError) throw new Error(`Storage error: ${uploadError.message}`);
        const { data } = supabase.storage.from("listings-tracker-photos").getPublicUrl(filename);
        const { data: photoRecord, error: dbError } = await supabase
          .from("listings_tracker_photos")
          .insert({ property_id: propertyId, photo_url: data.publicUrl, display_order: photos.length + uploaded.length })
          .select().single();
        if (dbError) throw new Error(`Database error: ${dbError.message}`);
        if (photoRecord) uploaded.push(photoRecord);
      }
      setPhotos([...photos, ...uploaded]);
      setSelectedFiles([]);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    } catch (err: any) { setPhotoError(err.message); }
    finally { setUploading(false); }
  }

  async function handleDeletePhoto(photo: Photo) {
    if (!confirm("Delete this photo?")) return;
    setDeletingPhotoId(photo.id); setPhotoActionError("");
    try {
      const path = getStoragePath(photo.photo_url);
      const { error: storageError } = await supabase.storage.from("listings-tracker-photos").remove([path]);
      if (storageError) throw new Error(`Storage error: ${storageError.message}`);
      const { error } = await supabase.from("listings_tracker_photos").delete().eq("id", photo.id);
      if (error) throw error;
      setPhotos(photos.filter((p) => p.id !== photo.id));
    } catch (err: any) { setPhotoActionError(err.message); }
    finally { setDeletingPhotoId(null); }
  }

  async function handleSetKeyPhoto(photoId: string) {
    setSettingKeyPhoto(true); setPhotoActionError("");
    try {
      const { error: clearError } = await supabase.from("listings_tracker_photos").update({ is_key_photo: false }).eq("property_id", propertyId);
      if (clearError) throw clearError;
      const { error } = await supabase.from("listings_tracker_photos").update({ is_key_photo: true }).eq("id", photoId);
      if (error) throw error;
      setPhotos(photos.map((p) => ({ ...p, is_key_photo: p.id === photoId })));
    } catch (err: any) { setPhotoActionError(err.message); }
    finally { setSettingKeyPhoto(false); }
  }

  async function handleMovePhoto(photoId: string, direction: "up" | "down") {
    const idx = photos.findIndex((p) => p.id === photoId);
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === photos.length - 1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const curr = photos[idx];
    const swap = photos[swapIdx];
    setPhotoActionError("");
    try {
      const { error: e1 } = await supabase.from("listings_tracker_photos").update({ display_order: swap.display_order }).eq("id", curr.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("listings_tracker_photos").update({ display_order: curr.display_order }).eq("id", swap.id);
      if (e2) throw e2;
      const updated = [...photos];
      updated[idx] = { ...curr, display_order: swap.display_order };
      updated[swapIdx] = { ...swap, display_order: curr.display_order };
      setPhotos(updated.sort((a, b) => a.display_order - b.display_order));
    } catch (err: any) { setPhotoActionError(err.message); }
  }

  async function handleSaveCaption(photoId: string) {
    setSavingCaption(true);
    try {
      const { error } = await supabase.from("listings_tracker_photos").update({ notes: captionText || null }).eq("id", photoId);
      if (error) throw error;
      setPhotos(photos.map((p) => p.id === photoId ? { ...p, notes: captionText || null } : p));
      setEditingCaptionId(null);
    } catch { /* silent */ }
    finally { setSavingCaption(false); }
  }

  const openGallery = (index: number) => { setGalleryIndex(index); setGalleryOpen(true); };
  const nextPhoto = () => setGalleryIndex((p) => (p + 1) % photos.length);
  const prevPhoto = () => setGalleryIndex((p) => (p - 1 + photos.length) % photos.length);

  if (loading) {
    return <main className="page page--centered"><dl-spinner /></main>;
  }
  if (!property) {
    return <main className="page page--centered"><dl-heading level={1}>Property not found</dl-heading></main>;
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
              <dl-input label="Address" value={newAddress} onInput={(e: WcInputEvent) => setNewAddress(getEventValue(e))} />
              <InlineError msg={addressError} />
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <dl-button variant="primary" size="sm" onClick={handleUpdateAddress} disabled={savingAddress} full-width>
                  {savingAddress ? "Saving..." : "Save"}
                </dl-button>
                <dl-button variant="secondary" size="sm" onClick={() => { setEditingAddress(false); setNewAddress(property.street_address || ""); setAddressError(""); }} disabled={savingAddress} full-width>
                  Cancel
                </dl-button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1, flexWrap: "wrap" }}>
              <dl-heading level={1} style={{ wordBreak: "break-word", margin: 0 }}>
                {property.street_address || "Listing"}
              </dl-heading>
              <dl-button variant="ghost" size="sm" onClick={() => setEditingAddress(true)}>Edit</dl-button>
            </div>
          )}
          <dl-button variant="ghost" size="sm" onClick={() => router.push("/properties")}>← Back</dl-button>
        </div>

        {/* Status row */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          {editingStatus ? (
            <>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                style={{ padding: "0.3rem 0.6rem", border: "1px solid #e5e7eb", borderRadius: "0.375rem", fontSize: "0.875rem" }}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{STATUS_STYLES[s].label}</option>
                ))}
              </select>
              <dl-button variant="primary" size="sm" onClick={handleUpdateStatus} disabled={savingStatus}>
                {savingStatus ? "..." : "Save"}
              </dl-button>
              <dl-button variant="ghost" size="sm" onClick={() => { setEditingStatus(false); setNewStatus(property.status ?? "active"); }}>
                Cancel
              </dl-button>
            </>
          ) : (
            <>
              <StatusBadge status={property.status} />
              <dl-button variant="ghost" size="sm" onClick={() => setEditingStatus(true)}>Change status</dl-button>
            </>
          )}
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
              {!editingLink && <dl-button variant="ghost" size="sm" onClick={() => setEditingLink(true)}>Edit</dl-button>}
            </div>
            {editingLink ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <dl-input label="URL" type="url" value={newLink} onInput={(e: WcInputEvent) => setNewLink(getEventValue(e))} placeholder="https://www.zillow.com/..." full-width />
                <InlineError msg={linkError} />
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <dl-button variant="primary" size="sm" onClick={handleUpdateLink} disabled={savingLink} full-width>{savingLink ? "Saving..." : "Save"}</dl-button>
                  <dl-button variant="secondary" size="sm" onClick={() => { setEditingLink(false); setNewLink(property.listing_link || ""); setLinkError(""); }} disabled={savingLink} full-width>Cancel</dl-button>
                </div>
              </div>
            ) : property.listing_link ? (
              <a href={property.listing_link} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", wordBreak: "break-all", fontSize: "0.875rem" }}>
                {property.listing_link}
              </a>
            ) : (
              <dl-text color="secondary">No listing link yet.</dl-text>
            )}
          </div>
        </dl-card>

        {/* Price History */}
        <dl-card style={{ marginBottom: "1.5rem" }}>
          <div style={{ padding: "1.5rem" }}>
            <dl-heading level={2} style={{ marginBottom: "1rem" }}>Price History</dl-heading>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: prices.length > 0 ? "1.25rem" : 0 }}>
              <dl-input
                type="number"
                placeholder="Enter price"
                value={newPrice}
                style={{ flex: 1, minWidth: "120px" }}
                onInput={(e: WcInputEvent) => { setNewPrice(getEventValue(e)); setPriceError(""); }}
              />
              <input
                type="date"
                value={priceDate}
                onChange={(e) => setPriceDate(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                title="Backdate this price entry (optional)"
                style={{ padding: "0.4rem 0.6rem", border: "1px solid #e5e7eb", borderRadius: "0.375rem", fontSize: "0.875rem" }}
              />
              <dl-button variant="primary" disabled={addingPrice || undefined} onClick={handleAddPrice}>
                {addingPrice ? "Adding..." : "Add Price"}
              </dl-button>
            </div>
            <InlineError msg={priceError} />
            {prices.length > 0 && (
              <>
                <PriceChart prices={prices} />
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1rem" }}>
                  {prices.slice(0, 10).map((price, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", paddingBottom: "0.5rem", borderBottom: "1px solid #e5e7eb" }}>
                      <dl-text size="300">${formatPrice(price.price)}</dl-text>
                      <dl-text size="300" color="secondary">{new Date(price.recorded_at).toLocaleDateString()}</dl-text>
                    </div>
                  ))}
                </div>
              </>
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
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Add any notes about this property..."
                  style={{ width: "100%", padding: "0.75rem", border: "1px solid #e0e0e0", borderRadius: "0.375rem", fontFamily: "inherit", fontSize: "0.875rem", resize: "vertical", minHeight: "120px", boxSizing: "border-box" }}
                />
                <InlineError msg={notesError} />
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <dl-button variant="primary" size="sm" onClick={handleUpdateNotes} disabled={savingNotes} full-width>{savingNotes ? "Saving..." : "Save"}</dl-button>
                  <dl-button variant="secondary" size="sm" onClick={() => { setEditingNotes(false); setNewNotes(property.notes || ""); setNotesError(""); }} disabled={savingNotes} full-width>Cancel</dl-button>
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
                type="file" multiple accept="image/*" onChange={handleFileChange}
                style={{ padding: "0.5rem", border: "1px solid #e0e0e0", borderRadius: "0.375rem", width: "100%" }}
              />
              {selectedFiles.length > 0 && (
                <dl-text size="300" color="secondary">
                  {selectedFiles.length} file{selectedFiles.length !== 1 ? "s" : ""} selected
                </dl-text>
              )}
              <dl-button variant="primary" disabled={uploading || selectedFiles.length === 0 || undefined} onClick={handleUploadPhotos} full-width>
                {uploading ? "Uploading..." : "Upload"}
              </dl-button>
              <InlineError msg={photoError} />
            </div>

            <InlineError msg={photoActionError} />

            {photos.length === 0 ? (
              <dl-text color="secondary">No photos yet.</dl-text>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "1rem" }}>
                {photos.map((photo, index) => (
                  <div key={photo.id} style={{ position: "relative", borderRadius: "6px", overflow: "hidden", border: photo.is_key_photo ? "2px solid #f59e0b" : "2px solid transparent" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.photo_url}
                      alt={photo.notes || "Property"}
                      onClick={() => openGallery(index)}
                      style={{ width: "100%", height: "150px", objectFit: "cover", display: "block", cursor: "pointer" }}
                    />

                    {/* Key photo badge */}
                    {photo.is_key_photo && (
                      <div style={{ position: "absolute", top: "6px", left: "6px", background: "rgba(0,0,0,0.65)", color: "#facc15", borderRadius: "4px", padding: "2px 6px", fontSize: "0.7rem", fontWeight: 700, pointerEvents: "none" }}>
                        ★ Key Photo
                      </div>
                    )}

                    {/* Reorder arrows */}
                    <div style={{ position: "absolute", top: "6px", right: "6px", display: "flex", flexDirection: "column", gap: "2px" }}>
                      {index > 0 && (
                        <button onClick={() => handleMovePhoto(photo.id, "up")} title="Move up" style={{ background: "rgba(0,0,0,0.55)", border: "none", color: "white", borderRadius: "3px", padding: "2px 5px", cursor: "pointer", fontSize: "0.7rem", lineHeight: 1 }}>▲</button>
                      )}
                      {index < photos.length - 1 && (
                        <button onClick={() => handleMovePhoto(photo.id, "down")} title="Move down" style={{ background: "rgba(0,0,0,0.55)", border: "none", color: "white", borderRadius: "3px", padding: "2px 5px", cursor: "pointer", fontSize: "0.7rem", lineHeight: 1 }}>▼</button>
                      )}
                    </div>

                    {/* Bottom action bar */}
                    <div style={{ display: "flex", gap: "4px", padding: "5px 6px", background: "rgba(0,0,0,0.55)" }}>
                      {!photo.is_key_photo && (
                        <button
                          onClick={() => handleSetKeyPhoto(photo.id)}
                          disabled={settingKeyPhoto}
                          style={{ flex: 1, background: "none", border: "1px solid rgba(255,255,255,0.5)", color: "white", borderRadius: "3px", padding: "3px 0", fontSize: "0.65rem", cursor: "pointer", whiteSpace: "nowrap" }}
                        >
                          Set key
                        </button>
                      )}
                      <button
                        onClick={() => handleDeletePhoto(photo)}
                        disabled={deletingPhotoId === photo.id}
                        style={{ background: "none", border: "1px solid rgba(255,100,100,0.7)", color: "#fca5a5", borderRadius: "3px", padding: "3px 7px", fontSize: "0.65rem", cursor: "pointer" }}
                      >
                        {deletingPhotoId === photo.id ? "…" : "✕"}
                      </button>
                    </div>

                    {/* Caption */}
                    {editingCaptionId === photo.id ? (
                      <div style={{ padding: "4px 6px", background: "#f9fafb" }}>
                        <input
                          value={captionText}
                          onChange={(e) => setCaptionText(e.target.value)}
                          placeholder="Add caption..."
                          style={{ width: "100%", fontSize: "0.75rem", border: "1px solid #e5e7eb", borderRadius: "3px", padding: "2px 5px", boxSizing: "border-box" }}
                          autoFocus
                        />
                        <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
                          <button onClick={() => handleSaveCaption(photo.id)} disabled={savingCaption} style={{ flex: 1, fontSize: "0.7rem", padding: "2px 4px", cursor: "pointer", background: "#3b82f6", color: "white", border: "none", borderRadius: "3px" }}>Save</button>
                          <button onClick={() => setEditingCaptionId(null)} style={{ flex: 1, fontSize: "0.7rem", padding: "2px 4px", cursor: "pointer", background: "#e5e7eb", border: "none", borderRadius: "3px" }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => { setEditingCaptionId(photo.id); setCaptionText(photo.notes || ""); }}
                        style={{ padding: "4px 6px", fontSize: "0.75rem", color: photo.notes ? "#374151" : "#9ca3af", cursor: "pointer", minHeight: "24px", background: "#f9fafb" }}
                        title="Click to edit caption"
                      >
                        {photo.notes || "Add caption..."}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </dl-card>

        <div className="cl-dlite-text-center">
          <dl-button variant="ghost" size="sm" onClick={() => router.push("/properties")}>← Back to Properties</dl-button>
        </div>
      </div>

      {/* Gallery Modal */}
      {galleryOpen && photos.length > 0 && (
        <div
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }}
          onClick={() => setGalleryOpen(false)}
        >
          <div
            style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh", display: "flex", flexDirection: "column", alignItems: "center" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setGalleryOpen(false)} style={{ position: "absolute", top: "-2.5rem", right: 0, background: "none", border: "none", color: "white", fontSize: "2rem", cursor: "pointer", padding: "0.25rem 0.5rem" }}>✕</button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[galleryIndex].photo_url}
              alt={photos[galleryIndex].notes || `Photo ${galleryIndex + 1}`}
              style={{ maxWidth: "100%", maxHeight: "calc(90vh - 100px)", objectFit: "contain", borderRadius: "0.5rem" }}
            />
            {photos[galleryIndex].notes && (
              <div style={{ color: "white", fontSize: "0.875rem", marginTop: "0.75rem", textAlign: "center", opacity: 0.85 }}>
                {photos[galleryIndex].notes}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: "2rem", marginTop: "1rem", color: "white" }}>
              <button onClick={prevPhoto} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.4)", color: "white", padding: "0.6rem 1.25rem", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.9rem" }}>← Prev</button>
              <span style={{ fontSize: "0.875rem" }}>{galleryIndex + 1} / {photos.length}</span>
              <button onClick={nextPhoto} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.4)", color: "white", padding: "0.6rem 1.25rem", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.9rem" }}>Next →</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
