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
        className="cl-dlite-flex cl-dlite-flex-col cl-dlite-items-center cl-dlite-text-center cl-dlite-sem-px-600 cl-dlite-sem-py-800 cl-dlite-sem-gap-300"
      >
        <div
          aria-hidden
          className="cl-dlite-flex cl-dlite-items-center cl-dlite-justify-center cl-dlite-sem-bg-sunken"
          style={{ width: "3.5rem", height: "3.5rem", borderRadius: "9999px", fontSize: "1.75rem" }}
        >
          {icon}
        </div>
        <dl-heading level={3} style={{ margin: 0 }}>{title}</dl-heading>
        {description && (
          <dl-text color="secondary" style={{ maxWidth: "28rem", display: "block" }}>
            {description}
          </dl-text>
        )}
        {action && <div className="cl-dlite-sem-mt-200">{action}</div>}
      </div>
    </dl-card>
  );
}
