"use client";

import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";
import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { 
  Database, Users, History, FileText, FlaskConical, 
  ScanLine, Camera, CheckCircle2, AlertTriangle, ArrowRight, Upload, Info
} from 'lucide-react';
import { DetailOverlay } from '@/components/ui/DetailOverlay';

type ImportFile = {
  name: string;
  size: number;
  type: string;
  category: string;
  status: 'Bereit zur Prüfung' | 'Fehlerhaft' | 'Dublettenverdacht';
};

export function AdminImportClient() {
  const [activeOverlay, setActiveOverlay] = useState<string | null>(null);
  const [importQueue, setImportQueue] = useState<ImportFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('Unklassifiziert');

  const closeOverlay = () => setActiveOverlay(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, category: string) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles: ImportFile[] = Array.from(files).map(file => ({
      name: file.name,
      size: file.size,
      type: file.type || 'Unbekannt',
      category: category,
      status: 'Bereit zur Prüfung'
    }));

    setImportQueue(prev => [...prev, ...newFiles]);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerFileInput = (category: string) => {
    setSelectedCategory(category);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8 font-sans antialiased text-navy-900 min-h-screen bg-[#F0EBE0]">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-navy-900 mb-2 font-serif flex items-center gap-3">
          <Database className="w-8 h-8" />
          Datenimport & Bestand
        </h1>
        <p className="text-text-muted text-sm md:text-base">Zentrale für den sicheren Import von Altdaten, PDFs und Scans (Admin/Developer).</p>
      </header>

      {/* Versteckter File-Input für die Mock-Logik */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={(e) => handleFileSelect(e, selectedCategory)} 
        className="hidden" 
        multiple
        accept=".pdf,.csv,.xlsx,.xls,.png,.jpg,.jpeg"
      />

      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-navy-900 font-serif">Import-Module</h2>
          <span className="bg-accent-orange/10 text-accent-orange text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">Demo / Lokal</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          
          {/* 1. Kunden importieren */}
          <button onClick={() => setActiveOverlay("import_customers")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-navy-900/10 rounded-xl flex items-center justify-center text-navy-900">
                  <Users className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Kunden importieren</h3>
              <p className="text-sm text-text-muted font-medium">Stammdaten aus CSV/Excel</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Modul öffnen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* 2. Auftragshistorie importieren */}
          <button onClick={() => setActiveOverlay("import_history")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-accent-orange/10 rounded-xl flex items-center justify-center text-accent-orange">
                  <History className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Auftragshistorie</h3>
              <p className="text-sm text-text-muted font-medium">Alte Vorgänge (PDF/CSV)</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Modul öffnen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* 3. Preislisten / Kalkulation */}
          <button onClick={() => setActiveOverlay("import_prices")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-success-green/10 rounded-xl flex items-center justify-center text-success-green">
                  <FileText className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Preislisten & Kalkulation</h3>
              <p className="text-sm text-text-muted font-medium">Zuschläge, Pauschalen</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Modul öffnen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* 4. Bäder & Chemie-Stammdaten */}
          <button onClick={() => setActiveOverlay("import_baths")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-[#107C41]/10 rounded-xl flex items-center justify-center text-[#107C41]">
                  <FlaskConical className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Bäder & Chemie</h3>
              <p className="text-sm text-text-muted font-medium">Stammdaten, Sollwerte</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Modul öffnen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* 5. Dokumente klassifizieren */}
          <button onClick={() => setActiveOverlay("import_docs")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-neutral-gray-100 rounded-xl flex items-center justify-center text-navy-900">
                  <ScanLine className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Dokumente klassifizieren</h3>
              <p className="text-sm text-text-muted font-medium">Bulk-Upload (PDFs/Bilder)</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Modul öffnen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* 6. Foto/Scan-Erfassung */}
          <button onClick={() => setActiveOverlay("import_scan")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-[#2563EB]/10 rounded-xl flex items-center justify-center text-[#2563EB]">
                  <Camera className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Foto / Scan-Erfassung</h3>
              <p className="text-sm text-text-muted font-medium">Kamera-Direktimport</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Modul öffnen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* 7. Import-Prüfung */}
          <button onClick={() => setActiveOverlay("import_queue")} className="text-left bg-navy-900 rounded-2xl p-5 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer md:col-span-2 lg:col-span-3">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-white">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                {importQueue.length > 0 && (
                  <span className="bg-accent-orange text-white text-sm font-bold px-3 py-1 rounded-full">
                    {importQueue.length} {importQueue.length === 1 ? 'Datei' : 'Dateien'} offen
                  </span>
                )}
              </div>
              <h3 className="font-bold text-white text-lg mb-1">Import-Prüfung (Warteschlange)</h3>
              <p className="text-sm text-white/70 font-medium">Prüfe Daten auf Fehler und Dubletten, bevor sie in die Datenbank geschrieben werden.</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-white/80 group-hover:text-white transition-colors">
              Warteschlange öffnen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

        </div>
      </div>

      {/* Detail Overlays */}
      
      {/* 1: Kunden importieren */}
      <DetailOverlay open={activeOverlay === "import_customers"} onClose={closeOverlay} title="Kunden importieren" subtitle="Alte Kundenstämme aus CSV, Excel oder Scans übertragen.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-warning-yellow/10 border border-warning-yellow/30 rounded-xl p-4 flex gap-3">
            <Info className="w-5 h-5 text-warning-yellow shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-navy-900">Import noch nicht in Datenbank schreibend</h4>
              <p className="text-sm text-text-muted">Dateien werden aktuell nur in die lokale Prüf-Warteschlange geladen.</p>
            </div>
          </div>
          
          <div className="bg-bg-app-soft p-4 rounded-xl border border-neutral-gray-200">
            <h4 className="font-bold mb-2">Erwartete CSV/Excel Felder:</h4>
            <div className="flex flex-wrap gap-2 text-xs font-mono">
              <span className="bg-white px-2 py-1 rounded border border-neutral-gray-200">Kundennummer</span>
              <span className="bg-white px-2 py-1 rounded border border-neutral-gray-200">Name/Firma*</span>
              <span className="bg-white px-2 py-1 rounded border border-neutral-gray-200">Adresse</span>
              <span className="bg-white px-2 py-1 rounded border border-neutral-gray-200">Telefon</span>
              <span className="bg-white px-2 py-1 rounded border border-neutral-gray-200">E-Mail</span>
              <span className="bg-white px-2 py-1 rounded border border-neutral-gray-200">Ansprechpartner</span>
              <span className="bg-white px-2 py-1 rounded border border-neutral-gray-200">Notizen</span>
            </div>
          </div>
          
          <button 
            onClick={() => triggerFileInput("Kunden")}
            className="w-full border-2 border-dashed border-navy-900/30 rounded-xl p-8 flex flex-col items-center justify-center text-navy-900 hover:bg-white hover:border-navy-900/60 transition-colors"
          >
            <Upload className="w-8 h-8 text-navy-900 mb-3" />
            <span className="font-bold text-lg">Dateien hier auswählen</span>
            <span className="text-sm text-text-muted mt-1">.csv, .xlsx, .pdf (nur lokal)</span>
          </button>
        </div>
      </DetailOverlay>

      {/* 2: Auftragshistorie importieren */}
      <DetailOverlay open={activeOverlay === "import_history"} onClose={closeOverlay} title="Auftragshistorie importieren" subtitle="Alte Vorgänge in die neue Datenbankstruktur mappen.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-bg-app-soft p-4 rounded-xl border border-neutral-gray-200">
            <h4 className="font-bold mb-2">Erwartete Datenpunkte:</h4>
            <ul className="list-disc pl-5 space-y-1 text-sm text-text-muted">
              <li>Auftragsnummer (zur Verknüpfung)</li>
              <li>Kunde (Name oder ID)</li>
              <li>Datum (Eingang/Ausgang)</li>
              <li>Leistung & Material/Oberfläche</li>
              <li>Preis</li>
              <li>Reklamationen (falls vorhanden)</li>
            </ul>
          </div>
          
          <button 
            onClick={() => triggerFileInput("Auftragshistorie")}
            className="w-full border-2 border-dashed border-navy-900/30 rounded-xl p-8 flex flex-col items-center justify-center text-navy-900 hover:bg-white hover:border-navy-900/60 transition-colors"
          >
            <Upload className="w-8 h-8 text-navy-900 mb-3" />
            <span className="font-bold text-lg">Archivdaten auswählen</span>
            <span className="text-sm text-text-muted mt-1">.csv, .xlsx, .zip (nur lokal)</span>
          </button>
        </div>
      </DetailOverlay>

      {/* 3: Preislisten / Kalkulation */}
      <DetailOverlay open={activeOverlay === "import_prices"} onClose={closeOverlay} title="Preislisten & Kalkulation" subtitle="Übernahme von Pauschalen, Zuschlägen und Basispreisen.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-white border border-neutral-gray-200 rounded-xl overflow-hidden mb-4">
            <div className="p-3 bg-navy-900 text-white font-bold text-sm">Beispielstruktur: Preisliste</div>
            <div className="p-4 space-y-2 text-sm overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-text-muted border-b border-neutral-gray-100">
                    <th className="pb-2">Typ</th>
                    <th className="pb-2">Bezeichnung</th>
                    <th className="pb-2">Wert</th>
                    <th className="pb-2">Einheit</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-neutral-gray-50">
                    <td className="py-2">Pauschale</td>
                    <td>Rüstkosten klein</td>
                    <td className="font-bold">25.00</td>
                    <td>EUR</td>
                  </tr>
                  <tr>
                    <td className="py-2">Zuschlag</td>
                    <td>Schleifen extra</td>
                    <td className="font-bold">+15</td>
                    <td>%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <button 
            onClick={() => triggerFileInput("Preisliste")}
            className="w-full border-2 border-dashed border-navy-900/30 rounded-xl p-8 flex flex-col items-center justify-center text-navy-900 hover:bg-white hover:border-navy-900/60 transition-colors"
          >
            <Upload className="w-8 h-8 text-navy-900 mb-3" />
            <span className="font-bold text-lg">Kalkulationsblätter hochladen</span>
          </button>
        </div>
      </DetailOverlay>

      {/* 4: Bäder & Chemie-Stammdaten */}
      <DetailOverlay open={activeOverlay === "import_baths"} onClose={closeOverlay} title="Bäder & Chemie" subtitle="Import von Anlagenparametern und Chemikalien-Stammdaten.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-bg-app-soft p-4 rounded-xl border border-neutral-gray-200">
            <h4 className="font-bold mb-2">Erwartete Bad-Parameter:</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success-green" /> Badname</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success-green" /> Metalltyp</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success-green" /> Sollwerte (pH, Temp)</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success-green" /> Messintervall</div>
            </div>
          </div>
          
          <button 
            onClick={() => triggerFileInput("Bäder")}
            className="w-full border-2 border-dashed border-navy-900/30 rounded-xl p-8 flex flex-col items-center justify-center text-navy-900 hover:bg-white hover:border-navy-900/60 transition-colors"
          >
            <Upload className="w-8 h-8 text-navy-900 mb-3" />
            <span className="font-bold text-lg">Anlagendaten auswählen</span>
          </button>
          
          <div className="pt-4 border-t border-neutral-gray-200 flex justify-end">
            <Link href="/baeder" className="bg-white border border-neutral-gray-200 text-navy-900 px-5 py-2.5 rounded-xl font-bold hover:bg-neutral-gray-50 transition-colors flex items-center gap-2">
              Zur Bäder-Zentrale
            </Link>
          </div>
        </div>
      </DetailOverlay>

      {/* 5: Dokumente klassifizieren */}
      <DetailOverlay open={activeOverlay === "import_docs"} onClose={closeOverlay} title="Dokumente klassifizieren" subtitle="Bulk-Upload von Dateien mit anschließender manueller Zuordnung.">
        <div className="space-y-6 text-navy-900">
          <div>
            <h4 className="font-bold mb-2 text-sm">Kategorie für diesen Upload wählen:</h4>
            <div className="flex flex-wrap gap-2 mb-4">
              {['Kunde', 'Auftrag', 'Preis', 'Bad/Chemie', 'Reklamation', 'E-Mail', 'Sonstiges'].map(cat => (
                <button 
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${
                    selectedCategory === cat 
                      ? 'bg-navy-900 text-white border-navy-900' 
                      : 'bg-white text-navy-900 border-neutral-gray-200 hover:bg-neutral-gray-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          
          <button 
            onClick={() => triggerFileInput(selectedCategory)}
            className="w-full border-2 border-dashed border-navy-900/30 rounded-xl p-8 flex flex-col items-center justify-center text-navy-900 hover:bg-white hover:border-navy-900/60 transition-colors"
          >
            <Upload className="w-8 h-8 text-navy-900 mb-3" />
            <span className="font-bold text-lg">Dateien als "{selectedCategory}" laden</span>
            <span className="text-sm text-text-muted mt-1">Die Dateien landen in der Warteschlange.</span>
          </button>
        </div>
      </DetailOverlay>

      {/* 6: Foto/Scan-Erfassung */}
      <DetailOverlay open={activeOverlay === "import_scan"} onClose={closeOverlay} title="Foto / Scan-Erfassung" subtitle="Direkter Import über Kamera oder Scanner.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-success-green/10 border border-success-green/20 rounded-xl p-4 flex gap-3">
            <Info className="w-5 h-5 text-success-green shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-success-green">OCR/AI-Erkennung vorbereitet</h4>
              <p className="text-sm text-success-green/80">Hochgeladene Scans werden in der Cloud per OCR ausgelesen. (Im Demo-Modus erfolgt nur eine manuelle Zuordnung).</p>
            </div>
          </div>
          
          <button 
            onClick={() => triggerFileInput("Scan")}
            className="w-full bg-navy-900 text-white rounded-xl p-8 flex flex-col items-center justify-center hover:bg-navy-800 transition-colors shadow-sm"
          >
            <Camera className="w-10 h-10 mb-3" />
            <span className="font-bold text-lg">Kamera / Scanner öffnen</span>
            <span className="text-sm text-white/70 mt-1">Simuliert lokalen File-Picker</span>
          </button>
          
          <div className="bg-bg-app-soft p-4 rounded-xl border border-neutral-gray-200">
            <h4 className="font-bold text-sm mb-2">Beispiel-Flow:</h4>
            <p className="text-sm text-text-muted mb-1">1. Foto eines alten Kundenzettels aufnehmen.</p>
            <p className="text-sm text-text-muted mb-1">2. KI extrahiert: Kunde, Datum, Auftragsvolumen.</p>
            <p className="text-sm text-text-muted">3. Admin bestätigt in der Import-Warteschlange.</p>
          </div>
        </div>
      </DetailOverlay>

      {/* 7: Import-Prüfung */}
      <DetailOverlay open={activeOverlay === "import_queue"} onClose={closeOverlay} title="Import-Warteschlange" subtitle="Dateien, die zur Übernahme in die Datenbank bereitstehen.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-warning-yellow/10 border border-warning-yellow/30 rounded-xl p-4 flex gap-3 mb-4">
            <Info className="w-5 h-5 text-warning-yellow shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-navy-900">Nur lokale Session</h4>
              <p className="text-sm text-text-muted">Dateien verbleiben nur im Browser-Speicher dieser Session. Es findet kein echter Upload zu Supabase statt.</p>
            </div>
          </div>
          
          {importQueue.length === 0 ? (
            <div className="text-center py-12 bg-white border border-neutral-gray-200 rounded-xl">
              <CheckCircle2 className="w-12 h-12 text-success-green mx-auto mb-3 opacity-50" />
              <h4 className="font-bold text-lg text-navy-900">Warteschlange ist leer</h4>
              <p className="text-sm text-text-muted mt-1">Lade Dateien in den Modulen hoch, um sie hier zu prüfen.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-end mb-2">
                <h4 className="font-bold text-navy-900">{importQueue.length} Dateien in Prüfung</h4>
                <button 
                  onClick={() => setImportQueue([])}
                  className="text-xs font-bold text-error-red hover:underline"
                >
                  Alle verwerfen
                </button>
              </div>
              
              {importQueue.map((file, idx) => (
                <div key={idx} className="bg-white p-4 rounded-xl border border-neutral-gray-200 flex items-start justify-between">
                  <div className="max-w-[70%]">
                    <p className="font-bold text-navy-900 truncate" title={file.name}>{file.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs bg-neutral-gray-100 text-navy-900 px-2 py-0.5 rounded font-medium">
                        {file.category}
                      </span>
                      <span className="text-xs text-text-muted">{formatSize(file.size)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs font-bold text-success-green bg-success-green/10 px-2 py-1 rounded">
                      Bereit
                    </span>
                    <button 
                      className="text-xs font-bold text-navy-900 bg-neutral-gray-100 hover:bg-neutral-gray-200 px-3 py-1.5 rounded mt-2"
                      onClick={() => {
                        setImportQueue(q => q.filter((_, i) => i !== idx));
                      }}
                    >
                      Entfernen
                    </button>
                  </div>
                </div>
              ))}
              
              <div className="pt-4 border-t border-neutral-gray-200 flex justify-end mt-4">
                <button className="bg-navy-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-navy-800 transition-colors opacity-50 cursor-not-allowed">
                  Import simulieren (Gesperrt)
                </button>
              </div>
            </div>
          )}
        </div>
      </DetailOverlay>

      <FeedbackFooter pageTitle="Datenimport" route="/admin/import" variant="full" />
    </div>
  );
}
