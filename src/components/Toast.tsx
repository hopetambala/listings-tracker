"use client";

import { useEffect, useState } from "react";

export type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

type Listener = (toast: ToastItem) => void;

const listeners = new Set<Listener>();
let nextId = 1;

export function showToast(message: string, variant: ToastVariant = "info") {
  const toast: ToastItem = { id: nextId++, message, variant };
  for (const listener of listeners) listener(toast);
}

export const toast = {
  success: (msg: string) => showToast(msg, "success"),
  error: (msg: string) => showToast(msg, "error"),
  info: (msg: string) => showToast(msg, "info"),
};

const VARIANT_STYLES: Record<ToastVariant, { bg: string; color: string; border: string; icon: string }> = {
  success: { bg: "#ecfdf5", color: "#065f46", border: "#6ee7b7", icon: "✓" },
  error: { bg: "#fef2f2", color: "#991b1b", border: "#fca5a5", icon: "✕" },
  info: { bg: "#eff6ff", color: "#1e3a8a", border: "#93c5fd", icon: "ℹ" },
};

const DURATION_MS = 3500;

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const listener: Listener = (toast) => {
      setItems((prev) => [...prev, toast]);
      setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== toast.id));
      }, DURATION_MS);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: "fixed",
        bottom: "1rem",
        right: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        zIndex: 1100,
        pointerEvents: "none",
        maxWidth: "22rem",
      }}
    >
      {items.map((item) => {
        const style = VARIANT_STYLES[item.variant];
        return (
          <div
            key={item.id}
            role={item.variant === "error" ? "alert" : "status"}
            style={{
              pointerEvents: "auto",
              display: "flex",
              alignItems: "flex-start",
              gap: "0.625rem",
              padding: "0.75rem 1rem",
              background: style.bg,
              color: style.color,
              border: `1.5px solid ${style.border}`,
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              boxShadow: "0 8px 24px rgba(15, 23, 42, 0.15)",
              minWidth: "12rem",
              animation: "listingsTrackerToastIn 160ms ease-out",
            }}
          >
            <span style={{ fontWeight: 700, fontSize: "1rem", lineHeight: 1 }} aria-hidden>{style.icon}</span>
            <span>{item.message}</span>
          </div>
        );
      })}
      <style>{`
        @keyframes listingsTrackerToastIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
