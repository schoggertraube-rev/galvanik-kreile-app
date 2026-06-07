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
        minHeight: "44px", // Touch target minimum
        padding: "0 16px",
        borderRadius: "12px",
        background: "var(--card, #ffffff)",
        border: "1px solid var(--line, #e2e8f0)",
        color: "var(--ink-soft, #475569)",
        fontSize: "13px",
        fontWeight: 600,
        cursor: "pointer",
        transition: "0.15s ease",
      }}
      className="hover:bg-slate-50 hover:border-slate-300"
    >
      <ArrowLeft size={16} />
      ← Zurück zur {label}
    </button>
  );
}
