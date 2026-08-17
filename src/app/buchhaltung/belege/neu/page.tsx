"use client";

import { Camera, FileText, UploadCloud } from "lucide-react";
import { AppBackButton } from "@/components/ui/AppBackButton";

export default function BelegUploadPage() {
  return (
    <div className="min-h-screen bg-bg-app-soft p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <AppBackButton fallbackHref="/buchhaltung/kosten" label="Zurück" />
        <div className="bg-white rounded-3xl p-8 border shadow-xs text-center">
          <FileText className="w-16 h-16 text-navy-900 mx-auto mb-4" />
          <h1 className="text-2xl font-bold font-serif text-navy-900 mb-2">Beleg erfassen</h1>
          <p className="text-text-muted mb-8 max-w-md mx-auto">
            Die Beleg-Erfassung ist bis zum sicheren Server-Command-Vertrag vorübergehend nicht verfügbar.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button
              disabled
              title="Nicht verfügbar: sicherer Server-Command-Vertrag fehlt."
              className="flex items-center justify-center gap-2 bg-navy-900 text-white px-8 py-4 rounded-xl font-bold opacity-50 cursor-not-allowed"
            >
              <Camera className="w-5 h-5" />
              Foto aufnehmen
            </button>
            <button
              disabled
              title="Nicht verfügbar: sicherer Server-Command-Vertrag fehlt."
              className="flex items-center justify-center gap-2 bg-white border border-neutral-gray-200 text-navy-900 px-8 py-4 rounded-xl font-bold opacity-50 cursor-not-allowed"
            >
              <UploadCloud className="w-5 h-5" />
              Datei hochladen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
