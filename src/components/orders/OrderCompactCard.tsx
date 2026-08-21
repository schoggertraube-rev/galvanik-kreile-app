import React from "react";
import { ChevronRight } from "lucide-react";

export type UrgencyType = "ok" | "soon" | "wait" | "crit" | "unknown";

interface OrderCompactCardProps {
  id: string;
  orderNumber: string;
  customerName: string;
  article: string;
  surface: string;
  badgeText?: string;
  urgency: UrgencyType;
  dueValue: string;
  dueLabel: string;
  onClick: () => void;
  onAdvance?: (e: React.MouseEvent) => void;
}

export function OrderCompactCard({
  id,
  orderNumber,
  customerName,
  article,
  surface,
  badgeText,
  urgency,
  dueValue,
  dueLabel,
  onClick,
  onAdvance
}: OrderCompactCardProps) {
  const isCrit = urgency === "crit";
  const isWait = urgency === "wait";
  const isUnknown = urgency === "unknown";

  return (
    <div
      data-order-id={id}
      data-testid="order-compact-card"
      onClick={onClick}
      className={`
        w-full group cursor-pointer border rounded-xl bg-white
        transition-all duration-200 hover:shadow-md hover:border-gold-400
        flex items-center px-4 py-2.5 gap-4 min-w-0
        ${isCrit ? 'border-danger-red-soft bg-danger-red-soft/10' : isUnknown ? 'border-slate-300 bg-slate-50' : 'border-neutral-gray-200'}
        ${isWait ? 'opacity-70' : ''}
      `}
      style={{ minWidth: 0, wordBreak: "break-word", overflowWrap: "break-word", whiteSpace: "normal" }}
    >
      {/* Left: Number & Customer */}
      <div className="flex flex-col flex-[1] min-w-0">
        <div className="text-[11px] font-bold text-navy-900 truncate">
          {orderNumber || "Fehlt"}
        </div>
        <div className="text-[12px] font-medium text-text-muted truncate">
          {customerName || "Kunde nicht hinterlegt"}
        </div>
      </div>

      {/* Center: Article & Surface */}
      <div className="flex flex-col flex-[1.5] min-w-0">
        <div className="text-[13px] font-bold text-navy-900 line-clamp-2 leading-tight">
          {article || "Artikel nicht hinterlegt"}
        </div>
        <div className="text-[11px] font-medium text-text-muted truncate mt-0.5">
          {surface || "Oberfläche nicht hinterlegt"}
        </div>
      </div>

      {/* Right: Status & Due */}
      <div className="flex flex-col items-end flex-[0.8] min-w-0 shrink-0 gap-0.5">
        <div className="text-[10px] uppercase font-bold tracking-wider truncate text-right w-full">
          {isCrit ? (
            <span className="text-danger-red">{badgeText || "KRITISCH"}</span>
          ) : isWait ? (
            <span className="text-gold-800">{badgeText || "WARTEND"}</span>
          ) : isUnknown ? (
            <span className="text-slate-600">{badgeText || "TERMIN NICHT ERFASST"}</span>
          ) : (
            <span className="text-success-green">{badgeText || "IM PLAN"}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-right w-full justify-end">
          <div className="flex flex-col items-end">
            <span className="text-[9px] text-text-muted uppercase leading-none">{dueLabel || "Fällig"}</span>
            <span className={`text-[12px] font-black leading-tight ${isCrit ? "text-danger-red" : "text-navy-900"}`}>
              {dueValue || "--"}
            </span>
          </div>
          {onAdvance ? (
            <button
              onClick={onAdvance}
              className="ml-2 w-7 h-7 rounded-full bg-success-green hover:bg-success-green-hover text-white flex items-center justify-center shrink-0 shadow-sm transition-transform hover:scale-110"
              title="Bearbeitung starten / Weitergeben"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <ChevronRight className="w-4 h-4 text-neutral-gray-300 ml-1 shrink-0 group-hover:text-gold-600 transition-colors" />
          )}
        </div>
      </div>
    </div>
  );
}
