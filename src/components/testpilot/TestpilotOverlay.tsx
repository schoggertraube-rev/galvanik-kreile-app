"use client";

import React, { useState } from 'react';
import { useTestpilot } from '@/components/testpilot/TestpilotProvider';
import { usePathname } from 'next/navigation';
import { TestpilotCanvas } from '@/components/testpilot/TestpilotCanvas';

interface TestpilotOverlayProps {
  onClose: () => void;
}

const CATEGORIES = [
  "Optik / Feinschliff",
  "falscher Pfad",
  "tote Funktion",
  "doppelte Funktion",
  "fehlende Funktion",
  "zu viele Klicks",
  "Daten falsch",
  "Demo statt echt",
  "langsam / hängt",
  "unklare Bezeichnung",
  "falscher Rückweg",
  "anderer Wunsch"
];

export function TestpilotOverlay({ onClose }: TestpilotOverlayProps) {
  const { addMarker, exportSessionMarkdown } = useTestpilot();
  const pathname = usePathname();
  
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [expected, setExpected] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const handleSave = () => {
    addMarker({
      category,
      description,
      expected,
      screenshot: screenshot || undefined,
      route: pathname || 'unknown',
    });
    onClose();
  };

  const handleSaveAndExport = () => {
    handleSave();
    // setTimeout to allow state to update first, though it might be slightly race-condition-y with context.
    setTimeout(() => {
      exportSessionMarkdown();
    }, 100);
  };

  return (
    <div 
      className="fixed inset-0 z-9999 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      data-testpilot-ignore="true"
    >
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4 text-slate-900 dark:text-slate-100">
        <div className="flex justify-between items-center border-b pb-2 dark:border-slate-800">
          <h2 className="text-lg font-bold">Testnotiz / Marker setzen</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
            ✕
          </button>
        </div>

        {isDrawing && (
          <TestpilotCanvas 
            onSave={(b64) => { setScreenshot(b64); setIsDrawing(false); }} 
            onCancel={() => setIsDrawing(false)} 
          />
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Kategorie</label>
            <select 
              className="w-full p-2 border rounded-md dark:bg-slate-800 dark:border-slate-700"
              value={category}
              onChange={e => setCategory(e.target.value)}
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Was ist hier falsch oder was soll anders werden?</label>
            <textarea 
              className="w-full p-2 border rounded-md dark:bg-slate-800 dark:border-slate-700 min-h-[80px]"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Kurze Beschreibung..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Was hättest du erwartet? (Optional)</label>
            <textarea 
              className="w-full p-2 border rounded-md dark:bg-slate-800 dark:border-slate-700 min-h-[60px]"
              value={expected}
              onChange={e => setExpected(e.target.value)}
              placeholder="Erwartetes Verhalten..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Visuelle Markierung</label>
            {screenshot ? (
              <div className="relative border rounded-md overflow-hidden dark:border-slate-700 mt-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={screenshot} alt="Screenshot" className="w-full h-auto max-h-[160px] object-cover" />
                <button 
                  onClick={() => setScreenshot(null)}
                  className="absolute top-2 right-2 bg-red-600/90 text-white p-1 rounded-full hover:bg-red-700 backdrop-blur-sm"
                  title="Bild entfernen"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsDrawing(true)}
                className="w-full mt-1 p-3 border border-dashed rounded-md border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center gap-2 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>
                Screenshot machen & Zeichnen
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t dark:border-slate-800">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-md"
          >
            Abbrechen
          </button>
          <button 
            onClick={handleSaveAndExport}
            disabled={!description.trim()}
            className="px-4 py-2 text-sm bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 rounded-md disabled:opacity-50"
          >
            Speichern + Export
          </button>
          <button 
            onClick={handleSave}
            disabled={!description.trim()}
            className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-md disabled:opacity-50"
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
