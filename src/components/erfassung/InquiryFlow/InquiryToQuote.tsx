"use client";

import { useErfassung } from "../ErfassungProvider";
import { Mail, ArrowRight, User, Package } from "lucide-react";
import { AiBadge } from "../shared/AiBadge";
import type { ErfassungPrefill } from "../ErfassungProvider";

type InquiryItem = {
  quantity?: number | string;
  name?: string;
  surfaceRequested?: string;
};

type InquiryExtraction = {
  customer?: (Record<string, unknown> & {
    companyName?: string;
    name?: string;
    email?: string;
    phone?: string;
  }) | null;
  items?: InquiryItem[] | null;
  behaviorNote?: { text?: string } | null;
};

type InquiryToQuoteData = ErfassungPrefill & {
  id?: string | null;
  text?: string;
  customer?: Record<string, unknown> | null;
  extracted?: InquiryExtraction | null;
};

export function InquiryToQuote({ data }: { data?: InquiryToQuoteData }) {
  const { openErfassung, closeErfassung } = useErfassung();
  const inquiryData = data!;

  const handleCreateQuote = () => {
    // Open manual wizard prefilled with inquiry extraction and isQuote = true
    openErfassung({
      mode: "order",
      intent: "create_quote",
      prefill: { customer: inquiryData.customer, order: { title: "KV-Anfrage aus Web" }, rawText: inquiryData.text },
      source: "inquiry",
      sourceRef: inquiryData.id
    });
  };

  const ext: InquiryExtraction = data?.extracted ?? {};
  const items = ext.items ?? [];

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
          <Mail className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">KV-Anfrage erstellen</h2>
          <p className="text-gray-500">Aus eingehender Nachricht</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm mb-8">
        <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">Erkannte Auftragsdaten</span>
          <AiBadge />
        </div>
        <div className="p-5 space-y-6">
          {/* Customer */}
          <div className="flex items-start gap-3">
            <User className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-gray-900">
                {ext.customer?.companyName || ext.customer?.name || "Unbekannter Kunde"}
              </div>
              <div className="text-sm text-gray-500">
                {ext.customer?.email} {ext.customer?.phone ? `• ${ext.customer?.phone}` : ""}
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="flex items-start gap-3">
            <Package className="w-5 h-5 text-gray-400 mt-0.5" />
            <div className="w-full">
              <div className="text-sm font-medium text-gray-900 mb-2">Teile</div>
              {items.length > 0 ? (
                <ul className="space-y-2">
                  {items.map((item, i) => (
                    <li key={i} className="text-sm text-gray-700 bg-gray-50 p-2 rounded flex justify-between">
                      <span>{item.quantity}x {item.name}</span>
                      <span className="text-gray-500">{item.surfaceRequested}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500 italic">Keine konkreten Teile extrahiert</p>
              )}
            </div>
          </div>
          
          {/* Behavior Note */}
          {ext.behaviorNote?.text && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mt-4">
              <div className="text-xs font-bold text-yellow-800 uppercase tracking-wider mb-1">Verhaltenshinweis erkannt</div>
              <p className="text-sm text-yellow-900">{ext.behaviorNote.text}</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={closeErfassung}
          className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Abbrechen
        </button>
        <button
          onClick={handleCreateQuote}
          className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-sm"
        >
          Zur KV-Anlage <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
