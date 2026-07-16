"use client";

import React from "react";
import { Download, Upload, Server, AlertTriangle, FileJson } from "lucide-react";
import { useSync } from "@/lib/offline/SyncContext";

export function BackupRestoreCenter() {
  const { outboxItems, outboxError } = useSync();

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
              <p className="text-xs text-amber-700 font-bold">Status nicht verifiziert</p>
            </div>
          </div>
          <p className="text-sm text-text-muted">Diese Ansicht besitzt noch keinen autorisierten Health-/Backup-Nachweis der Datenbank.</p>
        </div>

        <div className="bg-white border-2 border-neutral-gray-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-purple-100 text-purple-700 rounded-2xl">
              <FileJson size={24} />
            </div>
            <div>
              <h3 className="font-bold text-navy-900">Storage (Dateien)</h3>
              <p className="text-xs text-amber-700 font-bold">Status nicht verifiziert</p>
            </div>
          </div>
          <p className="text-sm text-text-muted">Dateibestand, Vollständigkeit und Wiederherstellbarkeit sind hier noch nicht serverseitig belegt.</p>
        </div>

        <div className={`border-2 rounded-3xl p-6 shadow-sm flex flex-col justify-between ${outboxItems.length > 0 ? 'bg-gold-50 border-gold-400' : 'bg-white border-neutral-gray-200'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-3 rounded-2xl ${outboxItems.length > 0 ? 'bg-gold-200 text-gold-800' : 'bg-gray-100 text-gray-500'}`}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="font-bold text-navy-900">Lokale Outbox</h3>
              <p className={`text-xs font-bold ${outboxItems.length > 0 ? 'text-gold-700' : 'text-success-green'}`}>
                {outboxError ? "Status nicht lesbar" : `${outboxItems.length} ${outboxItems.length === 1 ? 'Eintrag' : 'Einträge'} wartend`}
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
            Ein vollständiger Export benötigt einen autorisierten, tenant-gebundenen Export-Job, Integritätsmanifest und Abschlussbeleg. Dieser Vertrag ist noch nicht angebunden.
          </p>
          <div className="flex items-center gap-4">
            <button 
              disabled
              className="px-6 py-3 bg-navy-900 hover:bg-navy-800 text-white font-bold rounded-xl flex items-center gap-2 disabled:opacity-70 transition-colors"
            >
              <Download size={20} />
              Export noch nicht angebunden
            </button>
            <span className="text-sm text-text-muted font-medium">
              Letzter verifizierter Backup-Beleg: <strong className="text-navy-900">nicht vorhanden</strong>
            </span>
          </div>
        </div>

        <div className="border-t border-neutral-gray-200 pt-8">
          <h2 className="text-xl font-bold text-danger-red mb-2">Wiederherstellung (Restore)</h2>
          <p className="text-sm text-text-muted mb-4 max-w-2xl">
            Restore bleibt gesperrt, bis ein freigegebener Runbook-, Vier-Augen-, Integritäts- und Audit-Vertrag implementiert ist.
          </p>
          <button 
            disabled
            className="px-6 py-3 bg-red-50 border-2 border-red-200 text-danger-red font-bold rounded-xl flex items-center gap-2 opacity-60 cursor-not-allowed"
          >
            <Upload size={20} />
            Restore noch nicht angebunden
          </button>
        </div>
      </div>
    </div>
  );
}
