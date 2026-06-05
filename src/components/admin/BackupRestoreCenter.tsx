"use client";

import React, { useState } from "react";
import { Download, Upload, Server, Clock, AlertTriangle, FileJson, CheckCircle2 } from "lucide-react";
import { useSync } from "@/lib/offline/SyncContext";

export function BackupRestoreCenter() {
  const { outboxItems } = useSync();
  const [exporting, setExporting] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>("Heute, 03:00 Uhr (Automatisch)");

  const handleExport = () => {
    setExporting(true);
    // Simulate export delay
    setTimeout(() => {
      setExporting(false);
      setLastBackup(new Date().toLocaleString("de-DE", { 
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" 
      }) + " (Manuell)");
      alert("Backup erfolgreich erstellt! In einer echten Umgebung würde nun ein Download einer .zip Datei starten.");
    }, 1500);
  };

  const handleImportClick = () => {
    alert("Wiederherstellung (Restore) ist im Demo-Modus deaktiviert, um versehentlichen Datenverlust zu vermeiden. Bitte kontaktieren Sie den Entwickler für eine echte Wiederherstellung.");
  };

  return (
    <div className="space-y-6">
      
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border-2 border-neutral-gray-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 text-blue-700 rounded-2xl">
              <Server size={24} />
            </div>
            <div>
              <h3 className="font-bold text-navy-900">Datenbank</h3>
              <p className="text-xs text-success-green font-bold flex items-center gap-1"><CheckCircle2 size={12}/> Verbunden & Aktiv</p>
            </div>
          </div>
          <p className="text-sm text-text-muted">Enthält alle Aufträge, Kunden, und Zeitstrahl-Ereignisse.</p>
        </div>

        <div className="bg-white border-2 border-neutral-gray-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-purple-100 text-purple-700 rounded-2xl">
              <FileJson size={24} />
            </div>
            <div>
              <h3 className="font-bold text-navy-900">Storage (Dateien)</h3>
              <p className="text-xs text-success-green font-bold flex items-center gap-1"><CheckCircle2 size={12}/> Intakt</p>
            </div>
          </div>
          <p className="text-sm text-text-muted">Enthält alle Fotos, PDF-Dokumente und Rechnungen.</p>
        </div>

        <div className={`border-2 rounded-3xl p-6 shadow-sm flex flex-col justify-between ${outboxItems.length > 0 ? 'bg-gold-50 border-gold-400' : 'bg-white border-neutral-gray-200'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-3 rounded-2xl ${outboxItems.length > 0 ? 'bg-gold-200 text-gold-800' : 'bg-gray-100 text-gray-500'}`}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="font-bold text-navy-900">Lokale Outbox</h3>
              <p className={`text-xs font-bold ${outboxItems.length > 0 ? 'text-gold-700' : 'text-success-green'}`}>
                {outboxItems.length} {outboxItems.length === 1 ? 'Eintrag' : 'Einträge'} wartend
              </p>
            </div>
          </div>
          <p className="text-sm text-text-muted">Unsynchronisierte lokale Änderungen auf diesem Gerät.</p>
        </div>
      </div>

      <div className="bg-white border-2 border-neutral-gray-200 rounded-3xl p-6 shadow-sm space-y-8">
        <div>
          <h2 className="text-xl font-bold text-navy-900 mb-2">Manuelle Sicherung (Export)</h2>
          <p className="text-sm text-text-muted mb-4 max-w-2xl">
            Erstellen Sie eine vollständige Kopie aller aktuellen Daten (Datenbank & Dateien). Diese kann sicher auf einem lokalen Laufwerk verwahrt werden.
          </p>
          <div className="flex items-center gap-4">
            <button 
              onClick={handleExport}
              disabled={exporting}
              className="px-6 py-3 bg-navy-900 hover:bg-navy-800 text-white font-bold rounded-xl flex items-center gap-2 disabled:opacity-70 transition-colors"
            >
              {exporting ? <Clock className="animate-spin" size={20} /> : <Download size={20} />}
              {exporting ? "Backup wird generiert..." : "Vollständiges Backup herunterladen"}
            </button>
            <span className="text-sm text-text-muted font-medium">
              Letztes Backup: <strong className="text-navy-900">{lastBackup || "Unbekannt"}</strong>
            </span>
          </div>
        </div>

        <div className="border-t border-neutral-gray-200 pt-8">
          <h2 className="text-xl font-bold text-danger-red mb-2">Wiederherstellung (Restore)</h2>
          <p className="text-sm text-text-muted mb-4 max-w-2xl">
            Warnung: Eine Wiederherstellung überschreibt die aktuellen Live-Daten. Dieser Vorgang ist irreversibel und darf nur in Notfällen durchgeführt werden.
          </p>
          <button 
            onClick={handleImportClick}
            className="px-6 py-3 bg-red-50 border-2 border-red-200 hover:bg-red-100 text-danger-red font-bold rounded-xl flex items-center gap-2 transition-colors"
          >
            <Upload size={20} />
            Backup-Datei hochladen & wiederherstellen
          </button>
        </div>
      </div>
    </div>
  );
}
