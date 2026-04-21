import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon = "🏠", title, description, action }: EmptyStateProps) {
  return (
    <dl-card>
      <div
        style={{
          padding: "2.5rem 1.5rem",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.75rem",
        }}
      >
        <div
          aria-hidden
          style={{
            width: "3.5rem",
            height: "3.5rem",
            borderRadius: "9999px",
            background: "#f1f5f9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.75rem",
          }}
        >
          {icon}
        </div>
        <dl-heading level={3} style={{ margin: 0 }}>{title}</dl-heading>
        {description && (
          <dl-text color="secondary" style={{ maxWidth: "28rem", display: "block" }}>
            {description}
          </dl-text>
        )}
        {action && <div style={{ marginTop: "0.5rem" }}>{action}</div>}
      </div>
    </dl-card>
  );
}
