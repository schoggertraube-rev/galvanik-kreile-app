"use client";
import Image from "next/image";
import { CameraOff, X } from "lucide-react";
type ItemPhotoAnalysis = { material: string | null; schaeden: string | null; masse: string | null; confidence: number };
interface ItemPhotoUploaderProps { itemId: string; onUploadComplete: (url: string, analysis?: ItemPhotoAnalysis | null) => void; onRemove: (url: string) => void; photos: string[]; }
export function ItemPhotoUploader({ itemId, onUploadComplete, onRemove, photos }: ItemPhotoUploaderProps) {
  void itemId; void onUploadComplete;
  return <div className="space-y-3">{photos.length > 0 && <div className="flex flex-wrap gap-2">{photos.map((url, index) => <div key={index} className="relative group w-16 h-16 rounded-md border border-gray-200 overflow-hidden"><Image src={url} alt="Teile Foto" fill unoptimized sizes="64px" className="object-cover" /><button type="button" onClick={() => onRemove(url)} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button></div>)}</div>}<button disabled title="Nicht verfügbar: sicherer Server-Command-Vertrag fehlt." className="flex items-center justify-center gap-2 w-full h-16 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 font-medium opacity-50 cursor-not-allowed"><CameraOff className="w-5 h-5" /> Foto hinzufügen nicht verfügbar</button></div>;
}
