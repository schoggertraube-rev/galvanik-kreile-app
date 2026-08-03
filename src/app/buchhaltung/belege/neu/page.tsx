"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Camera, UploadCloud, FileText, Loader2 } from "lucide-react";
import { AppBackButton } from "@/components/ui/AppBackButton";
import { createClient } from "@/lib/supabase/client";

export default function BelegUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "ocr" | "done">("idle");
  const [progressText, setProgressText] = useState("");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const processFile = async (file: File) => {
    try {
      setStatus("uploading");
      setProgressText("Lade Beleg hoch...");
      
      const supabase = createClient();
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      const datePath = new Date().toISOString().substring(0, 7).replace('-', '/'); // YYYY/MM
      const storagePath = `${datePath}/${fileName}`;
      
      const { error } = await supabase.storage
        .from("belege")
        .upload(storagePath, file, { upsert: false });
        
      if (error) throw error;
      
      setStatus("ocr");
      setProgressText("OCR-Erkennung läuft...");
      
      // We will create the OCR action later, for now we mock the call
      const res = await fetch("/api/ocr-process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath })
      });
      
      if (!res.ok) throw new Error("OCR fehlgeschlagen");
      const result = await res.json();
      
      setStatus("done");
      setProgressText("Erfolgreich erkannt!");
      
      // Navigate to the new beleg
      setTimeout(() => {
        router.push(`/buchhaltung/belege/${result.belegId}`);
      }, 1000);
      
    } catch (err: unknown) {
      console.error(err);
      const message = err && typeof err === "object" && "message" in err ? String(err.message) : undefined;
      alert("Fehler: " + message);
      setStatus("idle");
    }
  };

  return (
    <div className="min-h-screen bg-bg-app-soft p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <AppBackButton fallbackHref="/buchhaltung/kosten" label="Zurück" />
        
        <div className="bg-white rounded-3xl p-8 border shadow-xs text-center">
          <FileText className="w-16 h-16 text-navy-900 mx-auto mb-4" />
          <h1 className="text-2xl font-bold font-serif text-navy-900 mb-2">Beleg erfassen</h1>
          <p className="text-text-muted mb-8 max-w-md mx-auto">
            Fotografiere einen Beleg oder lade ein PDF hoch. Die Daten werden automatisch via OCR ausgelesen.
          </p>

          {status === "idle" && (
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button 
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center justify-center gap-2 bg-navy-900 text-white px-8 py-4 rounded-xl font-bold hover:bg-navy-800 transition-colors"
              >
                <Camera className="w-5 h-5" />
                Foto aufnehmen
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 bg-white border border-neutral-gray-200 text-navy-900 px-8 py-4 rounded-xl font-bold hover:bg-neutral-gray-50 transition-colors"
              >
                <UploadCloud className="w-5 h-5" />
                Datei hochladen
              </button>
            </div>
          )}

          {status !== "idle" && (
            <div className="py-8 flex flex-col items-center">
              <Loader2 className="w-12 h-12 text-navy-900 animate-spin mb-4" />
              <p className="text-lg font-bold text-navy-900">{progressText}</p>
            </div>
          )}

          <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
            className="hidden" 
            ref={cameraInputRef} 
            onChange={handleFileChange} 
          />
          <input 
            type="file" 
            accept="image/*,application/pdf" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
          />
        </div>
      </div>
    </div>
  );
}
