"use client";

import { useState } from "react";
import Image from "next/image";
import { UploadCloud, X, Loader2 } from "lucide-react";
import { AiBadge } from "./AiBadge";

type ItemPhotoAnalysis = {
  material: string | null;
  schaeden: string | null;
  masse: string | null;
  confidence: number;
};

type ItemPhotoUploadResponse = {
  url: string;
  analysis: ItemPhotoAnalysis | null;
};

interface ItemPhotoUploaderProps {
  itemId: string;
  onUploadComplete: (url: string, analysis?: ItemPhotoAnalysis | null) => void;
  onRemove: (url: string) => void;
  photos: string[];
}

export function ItemPhotoUploader({ itemId, onUploadComplete, onRemove, photos }: ItemPhotoUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [analysisHint, setAnalysisHint] = useState<ItemPhotoAnalysis | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Only handle first file for simplicity in this MVP version
    const file = files[0];
    if (file.size > 10 * 1024 * 1024) {
      alert("Datei ist zu groß (max 10MB)");
      return;
    }

    setIsUploading(true);
    setAnalysisHint(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("itemId", itemId);
      formData.append("tenantId", "galvanik-kreile");

      const res = await fetch("/api/erfassung/item-photo-upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      const data: ItemPhotoUploadResponse = await res.json();
      
      if (data.analysis) {
        setAnalysisHint(data.analysis);
      }
      
      onUploadComplete(data.url, data.analysis);
      
    } catch (err) {
      console.error(err);
      alert("Fehler beim Hochladen");
    } finally {
      setIsUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-3">
      {/* Thumbnails */}
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((url, i) => (
            <div key={i} className="relative group w-16 h-16 rounded-md border border-gray-200 overflow-hidden">
              <Image src={url} alt="Teile Foto" fill unoptimized sizes="64px" className="object-cover" />
              <button
                type="button"
                onClick={() => onRemove(url)}
                className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* AI Hint Box */}
      {analysisHint && (
        <div className="bg-purple-50 border border-purple-100 rounded-md p-3 text-sm">
          <div className="flex items-center gap-2 mb-1">
            <AiBadge text="KI-Analyse" />
            <span className="font-medium text-purple-900">Vorschlag für dieses Teil</span>
          </div>
          <div className="text-purple-800 space-y-1 mt-2">
            {analysisHint.material && <p><strong>Material:</strong> {analysisHint.material}</p>}
            {analysisHint.schaeden && <p><strong>Schäden:</strong> {analysisHint.schaeden}</p>}
            {analysisHint.masse && <p><strong>Maße:</strong> {analysisHint.masse}</p>}
          </div>
        </div>
      )}

      {/* Upload Button */}
      {photos.length < 6 && (
        <label className="flex items-center justify-center w-full h-16 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 hover:border-gray-400 transition-colors">
          <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Lade hoch...
              </>
            ) : (
              <>
                <UploadCloud className="w-5 h-5 text-gray-400" />
                Foto hinzufügen
              </>
            )}
          </div>
          <input
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,image/heic,application/pdf"
            onChange={handleFileChange}
            disabled={isUploading}
          />
        </label>
      )}
    </div>
  );
}
