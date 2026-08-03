"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Play, Database } from "lucide-react";

type ImportRow = {
  id: string;
  data: Record<string, string>;
  status: 'pending' | 'error' | 'duplicate' | 'success';
  errorMsg?: string;
};

export function DataImportCenter() {
  const [file, setFile] = useState<File | null>(null);
  const [importType, setImportType] = useState("customers");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [parsing, setParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = (text: string) => {
    // Simple naive CSV parser (handles basic quoting, split by comma or semicolon)
    const delimiter = text.includes(';') ? ';' : ',';
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length < 2) return;

    const parsedHeaders = lines[0].split(delimiter).map(h => h.replace(/^["']|["']$/g, '').trim());
    setHeaders(parsedHeaders);

    const parsedRows: ImportRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      // Very naive split (will break on commas inside quotes if not properly handled, but sufficient for simple lists)
      const values = lines[i].split(new RegExp(`${delimiter}(?=(?:(?:[^"]*"){2})*[^"]*$)`)).map(v => v.replace(/^["']|["']$/g, '').trim());
      
      const data: Record<string, string> = {};
      parsedHeaders.forEach((h, idx) => {
        data[h] = values[idx] || '';
      });

      // Simple deduplication logic mockup (if email exists in another row)
      const isDuplicate = parsedRows.some(r => r.data['email'] && r.data['email'] === data['email']);
      
      parsedRows.push({
        id: `row-${i}`,
        data,
        status: isDuplicate ? 'duplicate' : 'pending',
        errorMsg: isDuplicate ? 'E-Mail existiert bereits' : undefined
      });
    }

    setRows(parsedRows);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFile(file);
    setParsing(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseCSV(text);
      setParsing(false);
    };
    reader.readAsText(file);
  };

  const executeImport = () => {
    // Disabled in UI
  };

  const pendingCount = rows.filter(r => r.status === 'pending').length;
  const duplicateCount = rows.filter(r => r.status === 'duplicate').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5"/> Daten-Importzentrum</CardTitle>
        <CardDescription>Massenimport von Kunden, Aufträgen und Katalogen (CSV/Excel)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-bold text-navy-700">Import-Typ</label>
            <select 
              className="flex h-10 w-full rounded-md border border-neutral-gray-200 bg-white px-3 py-2 text-sm text-navy-900 outline-none focus:border-navy-900"
              value={importType}
              onChange={e => setImportType(e.target.value)}
            >
              <option value="customers">Kunden (Stammdaten)</option>
              <option value="history">Kundenhistorie</option>
              <option value="orders">Aufträge</option>
              <option value="prices">Preislisten</option>
              <option value="materials">Materialkatalog</option>
            </select>
          </div>

          <div className="flex-1 space-y-1">
            <label className="text-xs font-bold text-navy-700">Datei hochladen</label>
            <input 
              type="file" 
              accept=".csv,.txt"
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            <Button 
              variant="outline" 
              className="w-full justify-start text-left h-10 px-3 font-normal"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-2 text-text-muted" />
              {file ? file.name : "CSV-Datei auswählen..."}
            </Button>
          </div>
        </div>

        {parsing && <div className="text-sm text-text-muted animate-pulse">Lese Datei ein...</div>}

        {rows.length > 0 && !parsing && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 bg-bg-app-soft border rounded-xl text-center">
                <p className="text-2xl font-black text-navy-900">{rows.length}</p>
                <p className="text-xs text-text-muted uppercase tracking-wider font-bold">Zeilen gesamt</p>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                <p className="text-2xl font-black text-emerald-700">{pendingCount}</p>
                <p className="text-xs text-emerald-600/80 uppercase tracking-wider font-bold">Bereit</p>
              </div>
              <div className="p-3 bg-accent-orange-soft border border-danger-red/30 rounded-xl text-center">
                <p className="text-2xl font-black text-danger-red">{duplicateCount}</p>
                <p className="text-xs text-danger-red/80 uppercase tracking-wider font-bold">Konflikte</p>
              </div>
            </div>

            <div className="border rounded-xl overflow-hidden">
              <div className="overflow-x-auto max-h-[400px]">
                <table className="w-full text-sm text-left">
                  <thead className="bg-bg-app-soft sticky top-0 border-b shadow-sm z-10">
                    <tr>
                      <th className="px-4 py-2 font-bold text-xs text-navy-700">Status</th>
                      {headers.map((h, i) => (
                        <th key={i} className="px-4 py-2 font-bold text-xs text-navy-700">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className={`border-b last:border-0 ${row.status === 'duplicate' ? 'bg-red-50/50' : row.status === 'success' ? 'bg-emerald-50/50' : 'hover:bg-bg-app-soft'}`}>
                        <td className="px-4 py-2">
                          {row.status === 'pending' && <Badge variant="outline" className="text-neutral-gray-600">Bereit</Badge>}
                          {row.status === 'duplicate' && <Badge variant="outline" className="text-danger-red border-danger-red/30 bg-red-50">Duplikat</Badge>}
                          {row.status === 'success' && <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50">Importiert</Badge>}
                        </td>
                        {headers.map((h, i) => (
                          <td key={i} className={`px-4 py-2 truncate max-w-[150px] ${row.status === 'duplicate' && h === 'email' ? 'text-danger-red font-bold' : ''}`}>
                            {row.data[h]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button disabled className="gap-2 cursor-not-allowed opacity-50" title="Import-Schnittstelle in Vorbereitung">
                <Play className="w-4 h-4" />
                {pendingCount} Datensätze importieren (Demo)
              </Button>
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
