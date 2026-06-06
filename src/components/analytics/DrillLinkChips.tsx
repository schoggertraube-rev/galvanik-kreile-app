"use client";

import Link from "next/link";
import type { LinkedArea } from "@/lib/analytics/kpiRegistry";
import {
  BarChart3, FlaskConical, Package, Truck, Send,
  Activity, ShieldCheck, Wallet, FileCheck, Download,
  CreditCard, Fuel, Receipt, Banknote,
} from "lucide-react";

const ICON_MAP: Record<string, React.ReactNode> = {
  "bar-chart-3": <BarChart3 style={{ width: 14, height: 14 }} />,
  "flask-conical": <FlaskConical style={{ width: 14, height: 14 }} />,
  "package": <Package style={{ width: 14, height: 14 }} />,
  "truck": <Truck style={{ width: 14, height: 14 }} />,
  "send": <Send style={{ width: 14, height: 14 }} />,
  "activity": <Activity style={{ width: 14, height: 14 }} />,
  "shield-check": <ShieldCheck style={{ width: 14, height: 14 }} />,
  "wallet": <Wallet style={{ width: 14, height: 14 }} />,
  "file-check": <FileCheck style={{ width: 14, height: 14 }} />,
  "download": <Download style={{ width: 14, height: 14 }} />,
  "credit-card": <CreditCard style={{ width: 14, height: 14 }} />,
  "fuel": <Fuel style={{ width: 14, height: 14 }} />,
  "receipt": <Receipt style={{ width: 14, height: 14 }} />,
  "banknote": <Banknote style={{ width: 14, height: 14 }} />,
};

interface DrillLinkChipsProps {
  links: LinkedArea[];
}

export function DrillLinkChips({ links }: DrillLinkChipsProps) {
  if (links.length === 0) return null;

  return (
    <div style={{ padding: "18px 22px", borderTop: "0.5px solid var(--neutral-gray-100, #ECE6D9)" }}>
      <div style={{
        fontSize: 10.5, fontWeight: 600,
        letterSpacing: 0.7, textTransform: "uppercase",
        color: "var(--text-muted, #7A7466)",
      }}>
        F \u00B7 Verkn\u00FCpfte Bereiche
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 11 }}>
        {links.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            style={{
              display: "inline-flex", alignItems: "center",
              gap: 6, padding: "7px 12px",
              background: "var(--bg-app-soft, #FAF6EC)",
              borderRadius: 20,
              fontSize: 12,
              color: "var(--navy-900, #0E1A2E)",
              textDecoration: "none",
              transition: "background 0.1s, box-shadow 0.1s",
              border: link.status === "future"
                ? "1px dashed var(--neutral-gray-300, #C8C2B5)"
                : "1px solid var(--neutral-gray-100, #ECE6D9)",
              opacity: link.status === "future" ? 0.55 : 1,
            }}
          >
            {ICON_MAP[link.icon] || null}
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
