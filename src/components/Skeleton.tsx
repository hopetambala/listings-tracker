import type { CSSProperties } from "react";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: CSSProperties;
}

export function Skeleton({ width = "100%", height = "1rem", borderRadius = "0.375rem", style }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "block",
        width,
        height,
        borderRadius,
        background: "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%)",
        backgroundSize: "200% 100%",
        animation: "listingsTrackerSkeletonShimmer 1.3s ease-in-out infinite",
        ...style,
      }}
    />
  );
}

export function ListingCardSkeleton() {
  return (
    <dl-card>
      <Skeleton height="220px" borderRadius="0" />
      <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        <Skeleton width="65%" height="1.5rem" />
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Skeleton width="6rem" height="1.25rem" borderRadius="9999px" />
          <Skeleton width="6rem" height="1.25rem" borderRadius="9999px" />
        </div>
        <Skeleton width="90%" height="1rem" />
      </div>
    </dl-card>
  );
}

export function ListingCardSkeletonGrid({ count = 3 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading listings"
      style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <ListingCardSkeleton key={i} />
      ))}
      <style>{`
        @keyframes listingsTrackerSkeletonShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

export function SummarySkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading market summary"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: "0.75rem",
        marginBottom: "1.5rem",
      }}
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          style={{
            padding: "0.875rem 1rem",
            background: "white",
            border: "1.5px solid #e2e8f0",
            borderRadius: "var(--tk-dlite-semantic-border-radius-md, 8px)",
            display: "flex",
            flexDirection: "column",
            gap: "0.375rem",
          }}
        >
          <Skeleton width="50%" height="0.75rem" />
          <Skeleton width="80%" height="1.75rem" />
          <Skeleton width="60%" height="0.75rem" />
        </div>
      ))}
    </div>
  );
}
