"use client";

import React, { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { X, Camera, Edit3, Upload, Phone, UserPlus, Send, Copy, FileText } from "lucide-react";
import { AppActionTile } from "./AppActionTile";
import { ShortcutType } from "./AppShortcutContext";

interface AppShortcutOverlayProps {
  type: ShortcutType;
  onClose: () => void;
}

export function AppShortcutOverlay({ type, onClose }: AppShortcutOverlayProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Prevent background scrolling
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  const handleAction = (href: string) => {
    onClose();
    // Pass the current pathname as returnTo context
    const url = new URL(href, window.location.origin);
    url.searchParams.set("returnTo", pathname);
    router.push(url.pathname + url.search);
  };

  let title = "";
  let content = null;

  switch (type) {
    case "new_order":
      title = "Neuer Auftrag";
      content = (
        <>
          <AppActionTile
            icon={<Camera className="w-6 h-6" />}
            title="Foto / Kamera"
            description="Lieferschein oder Werkstück direkt fotografieren (AI-Erfassung)."
            contextChip="Schnell"
            onClick={() => handleAction("/scan")}
          />
          <AppActionTile
            icon={<Edit3 className="w-6 h-6" />}
            title="Manuell anlegen"
            description="Klassische Eingabe aller Auftragsdaten ohne Vorlage."
            onClick={() => handleAction("/warendurchlauf/neu")}
          />
          <AppActionTile
            icon={<Upload className="w-6 h-6" />}
            title="Datei hochladen"
            description="PDF-Lieferschein oder Excel-Liste importieren."
            onClick={() => alert("Upload wird später angebunden (Demo).")}
          />
          <AppActionTile
            icon={<Phone className="w-6 h-6" />}
            title="Aus Telefonnotiz"
            description="Einen Auftrag aus einer vorherigen Telefonnotiz ableiten."
            contextChip="Büro"
            onClick={() => handleAction("/kommunikation")}
          />
        </>
      );
      break;

    case "new_customer":
      title = "Neuer Kunde";
      content = (
        <>
          <AppActionTile
            icon={<Camera className="w-6 h-6" />}
            title="Visitenkarte scannen"
            description="Kontaktdaten automatisch per Foto auslesen lassen."
            contextChip="Schnell"
            onClick={() => handleAction("/scan?type=customer")}
          />
          <AppActionTile
            icon={<UserPlus className="w-6 h-6" />}
            title="Manuell anlegen"
            description="Kundendaten per Formular eingeben."
            onClick={() => alert("Manuelle Kundenanlage wird angebunden.")}
          />
          <AppActionTile
            icon={<Copy className="w-6 h-6" />}
            title="Aus Auftrag übernehmen"
            description="Einen bestehenden Gast-Auftrag zu einem festen Kunden wandeln."
            onClick={() => alert("Wandlung wird angebunden.")}
          />
          <AppActionTile
            icon={<Send className="w-6 h-6" />}
            title="Aus Kommunikation"
            description="Kundendaten aus E-Mail oder Telefonnotiz übernehmen."
            contextChip="Büro"
            onClick={() => handleAction("/kommunikation")}
          />
        </>
      );
      break;

    case "new_document":
      title = "Neues Dokument";
      content = (
        <>
          <AppActionTile
            icon={<Camera className="w-6 h-6" />}
            title="Foto / Scan aufnehmen"
            description="Dokument direkt mit der Kamera abfotografieren."
            contextChip="Schnell"
            onClick={() => handleAction("/buchhaltung/belege/neu")}
          />
          <AppActionTile
            icon={<Upload className="w-6 h-6" />}
            title="Datei hochladen"
            description="Vorhandenes PDF oder Bild aus dem Dateisystem wählen."
            onClick={() => handleAction("/buchhaltung/belege/neu")}
          />
        </>
      );
      break;

    default:
      content = <p>Typ nicht konfiguriert.</p>;
  }

  return (
    <div className="fixed inset-0 z-9999 flex flex-col">
      {/* Blurred background */}
      <div 
        className="absolute inset-0 bg-navy-900/40 backdrop-blur-md transition-opacity" 
        onClick={onClose}
      />
      
      {/* Drawer content (bottom up on mobile, centered on desktop) */}
      <div className="relative mt-auto md:m-auto w-full max-w-3xl bg-bg-app rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-200">
        <div className="p-6 md:p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl md:text-3xl font-black font-serif text-navy-900">{title}</h2>
            <button 
              onClick={onClose}
              className="flex items-center justify-center bg-neutral-gray-200 hover:bg-error-red hover:text-white text-navy-900 rounded-full transition-colors"
              style={{ width: "44px", height: "44px" }}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <p className="text-text-muted mb-8 text-sm md:text-base">
            Bitte wähle aus, wie du fortfahren möchtest.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {content}
          </div>
        </div>
      </div>
    </div>
  );
}
