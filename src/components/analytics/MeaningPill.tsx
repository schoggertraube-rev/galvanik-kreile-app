"use client";

import type { MeaningLevel } from "@/lib/analytics/plainLanguage";
import { MEANING_LABELS } from "@/lib/analytics/plainLanguage";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

const COLORS: Record<MeaningLevel, { bg: string; text: string }> = {
  gut:        { bg: "var(--success-green-soft, #DDE9D3)", text: "var(--success-green, #5A8F4D)" },
  beobachten: { bg: "var(--accent-orange-soft, #FBE8D2)", text: "var(--accent-orange, #E8943C)" },
  kritisch:   { bg: "rgba(209,79,61,0.1)", text: "var(--danger-red, #D14F3D)" },
};

interface MeaningPillProps {
  level: MeaningLevel;
  className?: string;
}

export function MeaningPill({ level, className }: MeaningPillProps) {
  const c = COLORS[level];
  const Icon = level === "gut" ? CheckCircle2 : AlertTriangle;

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        fontWeight: 600,
        padding: "4px 9px",
        borderRadius: 20,
        backgroundColor: c.bg,
        color: c.text,
        whiteSpace: "nowrap",
      }}
    >
      <Icon style={{ width: 13, height: 13 }} />
      {MEANING_LABELS[level]}
    </span>
  );
}
