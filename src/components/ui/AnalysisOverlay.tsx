"use client";

/**
 * AnalysisOverlay — standardized modal for all detail tiles.
 *
 * Mirrors the HTML Showcase layout with sections:
 *   A · Hero (main value + change pill + sparkline + meta)
 *   B · Trend chart (Chart.js line/area or custom)
 *   C · Composition (itemized rows: Belege, Aufträge, etc.)
 *   D · Cross-KPI cards (ratio cards)
 *   E · Insight (observation + recommendation)
 *   F · Linked areas (chip links)
 *
 * Any section is optional — pass null/undefined to skip.
 */

import { DetailOverlay } from "./DetailOverlay";
import { ArrowRight, Info, Lightbulb } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";
import { AnalysisChart } from "./AnalysisChart";
import { PreviewDrawer } from "./PreviewDrawer";
import { useState } from "react";

// ── Types ────────────────────────────────────────────────────────────

export interface HeroSection {
  kicker: string;             // e.g. "Was kostet dich Energie"
  value: string;              // e.g. "9.800 €"
  changePill?: {
    text: string;             // "+12,5 % mehr als Vormonat"
    variant: "red" | "amber" | "teal" | "gray";
  };
  meta?: string;              // "Juni 2026 · 3 Belege · 98 % vom Budget"
  sparkValues?: number[];     // Mini sparkline data
}

export interface TrendSection {
  title?: string;             // Section kicker, default "B · So entwickelt es sich"
  children?: ReactNode;       // Chart.js component or custom chart
  readAs?: string;            // "So liest du das: ..."
  chartType?: "line" | "bar";
  chartData?: Array<Record<string, unknown>>;
}

export interface CompositionRow {
  avatar: string;             // Initial letter
  avatarColor: string;        // CSS color
  name: string;
  meta?: string;
  amount?: string;
  href?: string;
  previewText?: string;       // Dynamischer Text für PreviewDrawer
  onClick?: () => void;
}

export interface CompositionSection {
  title?: string;
  rows: CompositionRow[];
  footerLink?: { label: string; href?: string; onClick?: () => void };
}

export interface CrossKpiCard {
  label: string;
  value: string;
  delta?: string;
  deltaColor?: string;        // e.g. "var(--neg)" or "var(--warn)"
  accentColor?: string;       // top border color
}

export interface InsightSection {
  body: string;               // HTML or plain text
  actions?: { label: string }[];
}

export interface EmptyState {
  title: string;
  description: string;
  actionLabel: string;
  actionHref?: string;
  onAction?: () => void;
}

export interface AnalysisOverlayProps {
  open: boolean;
  onClose: () => void;
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  accentBg?: string;          // Header gradient background

  tabs?: { id: string; label: string; count?: number; alert?: boolean }[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;

  isEmpty?: boolean;
  emptyState?: EmptyState;

  hero?: HeroSection;
  trend?: TrendSection;
  composition?: CompositionSection;
  crossKpi?: CrossKpiCard[];
  insight?: InsightSection;
  l7Data?: {
    affectedAccounts: { id: string; label: string }[];
    affectedCostCenters: { id: string; label: string }[];
    periodImpact: string;
    liquidityImpact: string;
    taxImpactEur: number;
  };
  linkedAreas?: { label: string; href: string; previewText?: string }[];
}

// ── Pill color maps ──────────────────────────────────────────────────

const PILL_STYLES: Record<string, string> = {
  red: "background: var(--negbg, rgba(248,113,113,.12)); color: var(--neg, #D14F3D);",
  amber: "background: var(--warnbg, rgba(251,191,36,.12)); color: var(--warn, #B45309);",
  teal: "background: var(--posbg, rgba(52,211,153,.12)); color: var(--pos, #059669);",
  gray: "background: var(--sf2, #EBE8E0); color: var(--ink2, #615F58);",
};

// ── Sparkline SVG ────────────────────────────────────────────────────

function MiniSparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 150, h = 54, p = 4;
  const mn = Math.min(...values), mx = Math.max(...values), rng = (mx - mn) || 1;
  const pts = values.map((v, i) => [
    p + i * (w - 2 * p) / (values.length - 1),
    h - p - (v - mn) / rng * (h - 2 * p),
  ]);
  const d = pts.map((pt, i) => `${i ? "L" : "M"}${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`).join(" ");
  const area = `${d} L${(w - p).toFixed(1)} ${h - p} L${p} ${h - p} Z`;
  const last = pts[pts.length - 1];

  return (
    <svg width={150} height={54} viewBox={`0 0 ${w} ${h}`} style={{ flexShrink: 0 }}>
      <path d={area} fill="rgba(232,148,60,0.14)" />
      <path d={d} fill="none" stroke="#E8943C" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={3} fill="#E8943C" />
    </svg>
  );
}

// ── Main Component ───────────────────────────────────────────────────

export function AnalysisOverlay({
  open, onClose, icon, title, subtitle, accentBg,
  tabs, activeTab, onTabChange,
  hero, trend, composition, crossKpi, insight, l7Data, linkedAreas,
}: AnalysisOverlayProps) {
  const [previewDrawer, setPreviewDrawer] = useState<{ open: boolean; href: string; label: string; previewText?: string }>({ open: false, href: "", label: "" });

  return (
    <DetailOverlay open={open} onClose={onClose} title={undefined}>
      {/* 🔴 Category Header Strip 🔴 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 14, padding: "18px 22px",
        background: accentBg || "linear-gradient(180deg, var(--warnbg, rgba(251,191,36,.12)), transparent)",
        borderBottom: "0.5px solid var(--line, rgba(20,18,12,.08))",
        marginTop: -20, marginLeft: -20, marginRight: -20, marginBottom: 0,
        width: "calc(100% + 40px)",
      }}>
        {icon && (
          <div style={{
            width: 46, height: 46, borderRadius: 13,
            background: "var(--surface, #fff)", boxShadow: "0 1px 2px rgba(20,18,12,.05), 0 4px 16px rgba(20,18,12,.05)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, fontSize: 22,
          }}>
            {icon}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 650 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 13, color: "var(--text2, #615F58)", marginTop: 2 }}>{subtitle}</div>}
        </div>
      </div>

      {/* 🔴 Tabs (Ebene 7) 🔴 */}
      {tabs && tabs.length > 0 && (
        <div style={{
          display: "flex", gap: 20, borderBottom: "0.5px solid var(--line, rgba(20,18,12,.08))",
          padding: "0 2px", marginBottom: 12, overflowX: "auto"
        }}>
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <div 
                key={tab.id}
                onClick={() => onTabChange && onTabChange(tab.id)}
                style={{
                  padding: "14px 4px", fontSize: 13.5, fontWeight: isActive ? 650 : 500,
                  color: isActive ? "var(--text, #1B1A16)" : "var(--text3, #928F86)",
                  borderBottom: isActive ? "2px solid var(--text, #1B1A16)" : "2px solid transparent",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                  whiteSpace: "nowrap"
                }}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span style={{ 
                    background: tab.alert ? "var(--red-bg, #FEE2E2)" : "var(--surface2, #F3F1EC)", 
                    color: tab.alert ? "var(--red, #DC2626)" : "var(--text2, #615F58)",
                    padding: "2px 6px", borderRadius: 10, fontSize: 11, fontWeight: 700 
                  }}>
                    {tab.count}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── A · Hero Section ── */}
      {hero && (
        <div style={{ padding: "18px 0", borderBottom: "0.5px solid var(--line, rgba(20,18,12,.08))" }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.7, textTransform: "uppercase", color: "var(--text3, #928F86)" }}>
            {hero.kicker}
          </div>
          <div style={{ display: "flex", gap: 18, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", marginTop: 10 }}>
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 34, fontWeight: 680, lineHeight: 1, letterSpacing: -0.5 }}>{hero.value}</span>
                {hero.changePill && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "3px 9px", borderRadius: 20, fontSize: 11.5, fontWeight: 600,
                    ...Object.fromEntries(PILL_STYLES[hero.changePill.variant].split(";").filter(Boolean).map(s => {
                      const [k, v] = s.split(":").map(x => x.trim());
                      return [k.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v];
                    })),
                  }}>
                    {hero.changePill.text}
                  </span>
                )}
              </div>
              {hero.meta && (
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--text3, #928F86)", marginTop: 9 }}>
                  {hero.meta}
                </div>
              )}
            </div>
            {hero.sparkValues && hero.sparkValues.length > 1 && (
              <MiniSparkline values={hero.sparkValues} />
            )}
          </div>
        </div>
      )}

      {/* 🔴 B · Trend / Chart Section 🔴 */}
      {trend && (
        <div style={{ padding: "18px 0", borderBottom: "0.5px solid var(--line, rgba(20,18,12,.08))" }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.7, textTransform: "uppercase", color: "var(--text3, #928F86)" }}>
            {trend.title || "B · So entwickelt es sich"}
          </div>
          <div style={{ background: "var(--surface3, #FAF8F3)", borderRadius: 10, padding: "14px 14px 10px", marginTop: 10 }}>
            {trend.chartData ? (
              <AnalysisChart data={trend.chartData} />
            ) : (
              trend.children
            )}
          </div>
          {trend.readAs && (
            <div style={{
              fontSize: 12.5, color: "var(--blue, #0C447C)", background: "var(--blue-bg, #E7F1FB)",
              borderRadius: 7, padding: "9px 12px", marginTop: 10,
              display: "flex", gap: 8, alignItems: "flex-start",
            }}>
              <Info style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1 }} />
              <span>{trend.readAs}</span>
            </div>
          )}
        </div>
      )}

      {/* 🔴 C · Composition Section 🔴 */}
      {composition && composition.rows.length > 0 && (
        <div style={{ padding: "18px 0", borderBottom: "0.5px solid var(--line, rgba(20,18,12,.08))" }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.7, textTransform: "uppercase", color: "var(--text3, #928F86)" }}>
            {composition.title || `C · Woraus besteht der Betrag · ${composition.rows.length} Posten`}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 11 }}>
            {composition.rows.map((row, i) => {
              const inner = (
                <>
                  <div style={{
                    width: 34, height: 34, borderRadius: 9,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 600, flexShrink: 0,
                    background: row.avatarColor + "22", color: row.avatarColor,
                  }}>
                    {row.avatar}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{row.name}</div>
                    {row.meta && <div style={{ fontSize: 11.5, color: "var(--text3, #928F86)" }}>{row.meta}</div>}
                  </div>
                  {row.amount && (
                    <div style={{ marginLeft: "auto", fontWeight: 650, fontSize: 14, whiteSpace: "nowrap" }}>
                      {row.amount}
                    </div>
                  )}
                  {(row.href || row.onClick) && <ArrowRight style={{ width: 14, height: 14, color: "var(--text3, #928F86)" }} />}
                </>
              );

              const wrapperStyle = {
                display: "flex", alignItems: "center", gap: 12, padding: "11px 13px",
                background: "var(--surface3, #FAF8F3)", borderRadius: 10, transition: "background 0.1s",
                cursor: (row.href || row.onClick) ? "pointer" : "default",
                textDecoration: "none", color: "inherit"
              };

              if (row.href) {
                return (
                  <Link key={i} href={row.href} style={wrapperStyle} onClick={(e) => {
                    if (row.previewText) {
                      e.preventDefault();
                      setPreviewDrawer({ open: true, href: row.href || "", label: row.name, previewText: row.previewText });
                    } else if (row.onClick) {
                      row.onClick();
                    }
                  }}>
                    {inner}
                  </Link>
                );
              }
              return (
                <div key={i} style={wrapperStyle} onClick={() => {
                  if (row.previewText) {
                    setPreviewDrawer({ open: true, href: row.href || "", label: row.name, previewText: row.previewText });
                  } else if (row.onClick) {
                    row.onClick();
                  }
                }}>
                  {inner}
                </div>
              );
            })}
          </div>
          {composition.footerLink && (
            <div style={{ marginTop: 14, textAlign: "center" }}>
              {composition.footerLink.href ? (
                <Link
                  href={composition.footerLink.href}
                  style={{
                    background: "var(--surface, #fff)", border: "1px solid var(--line2, rgba(20,18,12,.16))",
                    borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600,
                    cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
                    color: "var(--text, #1B1A16)", textDecoration: "none",
                  }}
                >
                  {composition.footerLink.label} <ArrowRight style={{ width: 14, height: 14 }} />
                </Link>
              ) : composition.footerLink.onClick ? (
                <button
                  onClick={composition.footerLink.onClick}
                  style={{
                    background: "var(--surface, #fff)", border: "1px solid var(--line2, rgba(20,18,12,.16))",
                    borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600,
                    cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
                    color: "var(--text, #1B1A16)",
                  }}
                >
                  {composition.footerLink.label} <ArrowRight style={{ width: 14, height: 14 }} />
                </button>
              ) : (
                <span className="text-sm text-text-muted">{composition.footerLink.label} · nicht angebunden</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── D · Cross-KPI Cards ── */}
      {crossKpi && crossKpi.length > 0 && (
        <div style={{ padding: "18px 0", borderBottom: "0.5px solid var(--line, rgba(20,18,12,.08))" }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.7, textTransform: "uppercase", color: "var(--blue, #0C447C)" }}>
            D · Was die Zahl im Verhältnis bedeutet
          </div>
          <div style={{ display: "flex", gap: 12, overflowX: "auto", marginTop: 11, paddingBottom: 4 }}>
            {crossKpi.map((card, i) => (
              <div key={i} style={{
                flex: "0 0 184px", background: "var(--surface, #fff)", borderRadius: 10,
                padding: "13px 14px", boxShadow: "0 1px 2px rgba(20,18,12,.05), 0 4px 16px rgba(20,18,12,.05)",
                borderTop: `3px solid ${card.accentColor || "var(--blue-st, #2F86D8)"}`,
              }}>
                <div style={{ fontSize: 11.5, color: "var(--text2, #615F58)", marginBottom: 5 }}>{card.label}</div>
                <div style={{ fontSize: 23, fontWeight: 680, letterSpacing: -0.3 }}>{card.value}</div>
                {card.delta && (
                  <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 2, color: card.deltaColor || "var(--text2)" }}>
                    {card.delta}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{
            fontSize: 12.5, color: "var(--blue, #0C447C)", background: "var(--blue-bg, #E7F1FB)",
            borderRadius: 7, padding: "9px 12px", marginTop: 10,
            display: "flex", gap: 8, alignItems: "flex-start",
          }}>
            <Info style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1 }} />
            <span>So liest du das: Diese Karten setzen den Wert ins Verhältnis zu anderen Kennzahlen, damit eine einzelne Zahl Bedeutung bekommt.</span>
          </div>
        </div>
      )}

      {/* ── E · Insight ── */}
      {insight && (
        <div style={{ padding: "18px 0", borderBottom: "0.5px solid var(--line, rgba(20,18,12,.08))" }}>
          <div style={{
            background: "linear-gradient(180deg, var(--violet-bg, #EEEDFD), var(--surface3, #FAF8F3))",
            borderRadius: 10, padding: "16px 18px",
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
              color: "var(--violet, #3C3489)", marginBottom: 10,
            }}>
              <Lightbulb style={{ width: 16, height: 16 }} />
              E · Einschätzung
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.65 }} dangerouslySetInnerHTML={{ __html: insight.body }} />
            {insight.actions && insight.actions.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 13 }}>
                {insight.actions.map((a, i) => (
                  <span key={i} aria-disabled="true" style={{
                    background: "var(--surface, #fff)", border: "0.5px solid var(--line2, rgba(20,18,12,.16))",
                    borderRadius: 7, padding: "7px 12px", fontSize: 12.5,
                    display: "inline-flex", alignItems: "center", gap: 7,
                    fontFamily: "inherit",
                  }}>
                    {a.label} · Hinweis
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── G · Wirtschaftliche Wirkung (L7) ── */}
      {l7Data && (
        <div style={{ padding: "18px 0", borderBottom: "0.5px solid var(--line, rgba(20,18,12,.08))" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
            color: "var(--blue, #0C447C)", marginBottom: 10,
          }}>
            G · Wirtschaftliche Wirkung (L7)
          </div>
          <div style={{
            background: "var(--surface3, #FAF8F3)",
            borderRadius: "16px",
            padding: 16,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink2, #615F58)", marginBottom: 4 }}>
                Betroffene Konten
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {l7Data.affectedAccounts.map((acc) => (
                  <a key={acc.id} href={`/buchhaltung/belege?konto=${acc.id}`} style={{
                    fontSize: 12, fontWeight: 500, color: "var(--blue, #0C447C)",
                    background: "var(--blue-bg, #E7F1FB)", padding: "2px 8px", borderRadius: 6, textDecoration: "none"
                  }}>{acc.label}</a>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink2, #615F58)", marginBottom: 4 }}>
                Kostenstellen
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {l7Data.affectedCostCenters.map((cc) => (
                  <span key={cc.id} style={{
                    fontSize: 12, fontWeight: 500, color: "var(--text, #1B1A16)",
                    background: "var(--surface, #fff)", border: "1px solid var(--line2, rgba(20,18,12,.16))", padding: "2px 8px", borderRadius: 6,
                  }}>{cc.label}</span>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink2, #615F58)", marginBottom: 4 }}>
                Periodenwirkung
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text, #1B1A16)" }}>
                {l7Data.periodImpact}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink2, #615F58)", marginBottom: 4 }}>
                Liquiditätswirkung
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text, #1B1A16)" }}>
                {l7Data.liquidityImpact}
              </div>
            </div>
            <div style={{ gridColumn: "1 / -1", borderTop: "1px dashed var(--line2, rgba(20,18,12,.16))", paddingTop: 12, marginTop: -4 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink2, #615F58)", marginBottom: 2 }}>
                Steuerwirkung (USt-Effekt)
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--pos, #059669)" }}>
                {l7Data.taxImpactEur > 0 ? "+" : ""}{l7Data.taxImpactEur.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── F · Linked Areas ── */}
      {linkedAreas && linkedAreas.length > 0 && (
        <div style={{ padding: "18px 0" }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.7, textTransform: "uppercase", color: "var(--text3, #928F86)" }}>
            F · Verknüpfte Bereiche
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 11 }}>
            {linkedAreas.map((link, i) => {
              const style = {
                display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px",
                background: "var(--surface3, #FAF8F3)", borderRadius: 20, fontSize: 12,
                color: "var(--text, #1B1A16)", textDecoration: "none",
                border: "0.5px solid var(--line, rgba(20,18,12,.08))",
                minHeight: "44px", cursor: "pointer",
              };
              return link.previewText ? (
                <button
                  key={i}
                  onClick={() => setPreviewDrawer({ open: true, href: link.href, label: link.label, previewText: link.previewText })}
                  style={style}
                >
                  {link.label}
                </button>
              ) : (
                <Link key={i} href={link.href} style={style}>{link.label}</Link>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Drawer for linked areas and rows */}
      {previewDrawer.open && (
        <PreviewDrawer
          open={previewDrawer.open}
          onClose={() => setPreviewDrawer({ open: false, href: "", label: "" })}
          title={previewDrawer.label}
          fullOpenHref={previewDrawer.href}
        >
          <div className="flex flex-col gap-4">
            <div className="inline-flex items-center self-start bg-neutral-gray-100 text-navy-900 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider mb-2">
              {title}
            </div>
            {previewDrawer.previewText ? (
              <div className="text-sm leading-relaxed text-text-muted mb-4 whitespace-pre-wrap">
                {previewDrawer.previewText}
              </div>
            ) : (
              <p className="text-sm text-text-muted">Für diesen Bereich liegen keine bestätigten Vorschaudaten vor.</p>
            )}
            <p className="text-xs text-text-muted mt-2 border-t pt-4">
              Für tiefere Analysen und Bearbeitungsmöglichkeiten klicken Sie bitte auf &quot;Vollständig öffnen&quot;.
            </p>
          </div>
        </PreviewDrawer>
      )}
    </DetailOverlay>
  );
}
