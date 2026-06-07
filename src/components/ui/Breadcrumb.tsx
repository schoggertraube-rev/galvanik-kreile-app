import Link from "next/link";
import React from "react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav
      style={{
        fontSize: "12px",
        color: "var(--ink-faint, #94a3b8)",
        fontWeight: 600,
        marginBottom: "8px",
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
      }}
      aria-label="Breadcrumb"
    >
      {items.map((item, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center" }}>
          {i > 0 && <span style={{ margin: "0 6px" }}>›</span>}
          {item.href ? (
            <Link
              href={item.href}
              className="hover:text-blue-600 hover:underline transition-colors"
              style={{
                color: "var(--ink-faint, #94a3b8)",
                textDecoration: "none",
                minHeight: "24px", // Slight padding for better touch
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              {item.label}
            </Link>
          ) : (
            <span style={{ color: "var(--ink, #0f172a)" }}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
