"use client";

import { useState } from "react";
import { Mail, MessageSquare, Plus, Save } from "lucide-react";

export function TextTemplates() {
  const [followUpText, setFollowUpText] = useState(`vor einiger Zeit haben wir Ihren Auftrag abgeschlossen. 
Wir hoffen, Sie sind mit dem Ergebnis unserer Arbeit vollkommen zufrieden und die Teile erstrahlen im neuen Glanz!

Für uns als Handwerksbetrieb ist das Feedback unserer Kunden extrem wichtig. Wir würden uns riesig freuen, wenn Sie sich eine Minute Zeit nehmen könnten, um unsere Arbeit auf Google zu bewerten.

Außerdem: Wir lieben es zu sehen, was aus unseren veredelten Teilen wird! Wenn Sie die Teile bereits wieder eingebaut haben (z.B. an Ihrem Oldtimer, Motorrad oder Schmuckstück), würden wir uns sehr über ein paar Fotos des fertigen Ergebnisses freuen.
Antworten Sie einfach auf diese E-Mail und hängen Sie Ihre Bilder an. Mit Ihrer Erlaubnis präsentieren wir die schönsten Ergebnisse gerne auf unserer Website.`);

  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-navy-900">Textvorlagen & E-Mails</h2>
          <p className="text-sm text-text-muted">Verwalte automatisierte Nachrichten und Vorlagen.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-neutral-gray-100 text-navy-900 font-bold rounded-xl hover:bg-neutral-gray-200 transition-colors">
          <Plus className="w-4 h-4" /> Neue Vorlage
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sidebar */}
        <div className="space-y-2">
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-center gap-3 cursor-pointer">
            <Mail className="w-5 h-5 text-blue-600" />
            <div>
              <div className="font-bold text-sm text-blue-900">Follow-Up (Marketing)</div>
              <div className="text-xs text-blue-700">Nach Rechnung/Abschluss</div>
            </div>
          </div>
          
          <div className="p-3 rounded-xl border border-transparent hover:bg-neutral-gray-50 flex items-center gap-3 cursor-pointer transition-colors">
            <Mail className="w-5 h-5 text-text-muted" />
            <div>
              <div className="font-bold text-sm text-navy-900">Lieferschein</div>
              <div className="text-xs text-text-muted">Standard-Versand</div>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-transparent hover:bg-neutral-gray-50 flex items-center gap-3 cursor-pointer transition-colors">
            <MessageSquare className="w-5 h-5 text-text-muted" />
            <div>
              <div className="font-bold text-sm text-navy-900">WhatsApp-Abholinfo</div>
              <div className="text-xs text-text-muted">Fertigmeldung</div>
            </div>
          </div>
        </div>

        {/* Editor */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border-2 border-neutral-gray-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4 border-b border-neutral-gray-100 pb-4">
              <div>
                <h3 className="font-bold text-navy-900">Follow-Up (Marketing) bearbeiten</h3>
                <p className="text-xs text-text-muted mt-1">Automatische E-Mail ca. 14 Tage nach Abschluss zur Einholung von Feedback & Fotos.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">Betreff</label>
                <input 
                  type="text" 
                  defaultValue="Ihre veredelten Teile von Galvanik Kreile - Wie war das Ergebnis?" 
                  className="w-full px-3 py-2 border-2 border-neutral-gray-200 rounded-xl focus:border-navy-500 outline-none text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">Nachrichten-Text</label>
                <div className="bg-blue-50 text-blue-800 text-xs p-2 rounded-lg mb-2">
                  Verfügbare Platzhalter: <code className="font-bold">{"{Kundenname}"}</code>, <code className="font-bold">{"{Auftragsnummer}"}</code>
                </div>
                <textarea 
                  value={followUpText}
                  onChange={(e) => setFollowUpText(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-neutral-gray-200 rounded-xl focus:border-navy-500 outline-none text-sm h-64 resize-y"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button 
                  onClick={handleSave}
                  className="flex items-center gap-2 px-5 py-2.5 bg-navy-900 text-white font-bold rounded-xl hover:bg-navy-800 transition-colors"
                >
                  {saved ? "Gespeichert!" : <><Save className="w-4 h-4" /> Speichern</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
