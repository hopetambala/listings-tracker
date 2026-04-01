"use client";

import "./register";

/**
 * Client-side provider that registers dlite web components.
 * Wrap your app content with this in the root layout.
 */
export default function DliteProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
