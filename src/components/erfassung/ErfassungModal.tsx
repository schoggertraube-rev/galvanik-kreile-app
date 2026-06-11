"use client";

import { useErfassung } from "./ErfassungProvider";
import { X } from "lucide-react";
import { ManualWizard } from "./ManualFlow/ManualWizard";
import { ScanResult } from "./ScanFlow/ScanResult";
import { ScanUpload } from "./ScanFlow/ScanUpload";
import { InquiryToQuote } from "./InquiryFlow/InquiryToQuote";

export function ErfassungModal() {
  const { flow, contextData, closeErfassung } = useErfassung();

  const renderFlow = () => {
    switch (flow) {
      case "manual":
        return <ManualWizard />;
      case "scan":
        if (contextData?.scanResult) {
          return <ScanResult data={contextData.scanResult} />;
        }
        return <ScanUpload />;
      case "inquiry":
        return <InquiryToQuote data={contextData} />;
      case "phone":
        return <div>Telefon Flow (additiv, nicht im Haupt-Modal)</div>;
      default:
        return <div>Unbekannter Flow</div>;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-white/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        
        {/* Header (optional, if flows provide their own headers this can be minimized) */}
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={closeErfassung}
            className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto">
          {renderFlow()}
        </div>
      </div>
    </div>
  );
}
