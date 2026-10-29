"use client";

import React from "react";
import { X, Database, MessageSquare, AlertCircle, ExternalLink, ChevronRight } from "lucide-react";
import Link from "next/link";

export type ContextAnalysisOverlayProps = {
  open: boolean;
  onClose: () => void;
  type:
    | "order"
    | "customer"
    | "payment"
    | "appointment"
    | "email"
    | "attachments"
    | "reply"
    | "generic";
  chatId?: string;
  phoneNoteId?: string;
  customerId?: string;
  orderId?: string;

  title: string;
  summary: string;
  facts: Array<{
    label: string;
    value: string;
    source: "database" | "chat" | "mock" | "unknown";
    confidence?: number;
  }>;
  actions: Array<{
    label: string;
    kind: "primary" | "secondary" | "danger";
    href?: string;
    onClickKey?: string;
    onClick?: () => void;
    disabled?: boolean;
    preparedOnly?: boolean;
  }>;
};

export function ContextAnalysisOverlay({
  open,
  onClose,
  type,
  title,
  summary,
  facts,
  actions,
}: ContextAnalysisOverlayProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center lg:justify-end p-4 lg:pr-[15%]"
      style={{ backgroundColor: "rgba(15, 23, 42, 0.4)", backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      data-testid="communication-analysis-overlay"
    >
      <div
        className="bg-white flex flex-col w-full max-w-2xl max-h-[86vh] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 lg:slide-in-from-right-8 duration-200"
        style={{ borderRadius: "24px" }}
      >
        {/* Header */}
        <div className="bg-navy-900 text-white px-6 py-5 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[11px] font-bold tracking-widest uppercase text-navy-200 mb-1">
              {type === "order" ? "Auftrag im Chat-Kontext" :
               type === "customer" ? "Kunde im Chat-Kontext" :
               type === "payment" ? "Zahlung im Chat-Kontext" :
               type === "email" ? "E-Mail / Anhänge zum Chat" : "Kontext-Analyse"}
            </span>
            <h2 className="text-xl font-bold font-serif">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            data-testid="analysis-close-overlay"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto bg-neutral-gray-50 flex-1">
          <p className="text-[15px] leading-relaxed text-navy-800 mb-6 font-medium">
            {summary}
          </p>

          <div className="flex flex-col gap-3">
            {facts.map((fact, i) => (
              <div key={i} className="bg-white p-4 rounded-[16px] border border-neutral-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-2 shadow-sm">
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">
                    {fact.label}
                  </span>
                  <span className="text-[15px] font-bold text-navy-900">
                    {fact.value}
                  </span>
                </div>
                
                <div className="flex items-center gap-1.5 self-start md:self-center mt-2 md:mt-0">
                  {fact.source === "database" && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-green-50 text-green-700 px-2 py-1 rounded-md border border-green-200">
                      <Database size={12} /> Quelle: Datenbank
                    </span>
                  )}
                  {fact.source === "chat" && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-blue-50 text-blue-700 px-2 py-1 rounded-md border border-blue-200">
                      <MessageSquare size={12} /> Im Chat erwähnt
                    </span>
                  )}
                  {fact.source === "mock" && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-orange-50 text-orange-700 px-2 py-1 rounded-md border border-orange-200">
                      <AlertCircle size={12} /> Demo / vorbereitet
                    </span>
                  )}
                  {fact.source === "unknown" && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-red-50 text-red-700 px-2 py-1 rounded-md border border-red-200">
                      <AlertCircle size={12} /> Nicht sicher gefunden
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions Footer */}
        <div className="p-6 bg-white border-t border-neutral-gray-200 flex flex-col sm:flex-row gap-3 sm:items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-3 rounded-[12px] font-bold text-sm bg-neutral-gray-100 hover:bg-neutral-gray-200 text-navy-900 transition-colors"
          >
            Schließen
          </button>
          
          {actions.map((action, i) => {
            if (action.href) {
              return (
                <Link
                  key={i}
                  href={action.href}
                  className={`px-5 py-3 rounded-[12px] font-bold text-sm flex items-center justify-center gap-2 transition-colors ${
                    action.kind === "primary" ? "bg-navy-900 text-white hover:bg-navy-700 shadow-md" :
                    action.kind === "secondary" ? "bg-white border-2 border-navy-900 text-navy-900 hover:bg-navy-50" :
                    "bg-red-600 text-white hover:bg-red-700"
                  }`}
                  data-testid={action.kind === "secondary" && type === "order" ? "analysis-open-full-order" : undefined}
                >
                  {action.label} <ExternalLink size={16} />
                </Link>
              );
            }
            return (
              <button
                key={i}
                onClick={() => {
                  if (action.onClick) action.onClick();
                  else if (action.onClickKey === "close") onClose();
                  else alert(`Aktion ausgeführt: ${action.label}`);
                }}
                disabled={action.disabled}
                className={`px-5 py-3 rounded-[12px] font-bold text-sm flex items-center justify-center gap-2 transition-colors ${
                  action.disabled ? "opacity-50 cursor-not-allowed" : ""
                } ${
                  action.kind === "primary" ? "bg-gold-600 text-navy-900 hover:bg-gold-500 shadow-md" :
                  action.kind === "secondary" ? "bg-white border-2 border-navy-900 text-navy-900 hover:bg-navy-50" :
                  "bg-red-600 text-white hover:bg-red-700"
                }`}
              >
                {action.label} <ChevronRight size={16} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
