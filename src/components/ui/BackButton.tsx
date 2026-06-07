"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
  label: string;
  href?: string;
}

export function BackButton({ label, href }: BackButtonProps) {
  const router = useRouter();
  
  return (
    <button
      onClick={() => (href ? router.push(href) : router.back())}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        height: "44px",
        padding: "0 16px",
        borderRadius: "12px",
        background: "#FBE9F1",
        border: "1px solid rgba(194, 24, 91, 0.2)",
        color: "#C2185B",
        fontSize: "13px",
        fontWeight: 600,
        cursor: "pointer",
        transition: "0.15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "#C2185B";
        e.currentTarget.style.color = "#ffffff";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "#FBE9F1";
        e.currentTarget.style.color = "#C2185B";
      }}
    >
      <ArrowLeft size={16} />
      Zurück zur {label}
    </button>
  );
}
