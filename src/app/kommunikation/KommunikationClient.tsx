"use client";
import React from "react";

import { useState, useEffect, useCallback } from "react";
import { 
  Inbox, MessageSquare, Mail, Phone, Globe, Camera,
  AlertOctagon, CheckSquare, Clock, ArrowRight, Link as LinkIcon,
  Copy, CheckCircle2, User, FileText, Banknote, ExternalLink,
  Mic, X, Edit2, Play, Save, ChevronRight, Activity
} from "lucide-react";
import Link from "next/link";
import { usePageView } from "@/hooks/usePageView";
import { INITIAL_CUSTOMERS, INITIAL_ORDERS, MockCustomer, MockOrder } from "@/lib/mockData";
import { createPhoneNote, getRecentPhoneNotes } from "@/app/actions/phoneNotes.actions";
import { smartMatchText, MatchResult } from "./smartMatcher";
import { PhoneNoteDetailView } from "./PhoneNoteDetailView";

type Channel = "all" | "email" | "whatsapp" | "instagram" | "website" | "phone" | "billing";

interface Thread {
  id: string;
  sender: string;
  subject: string;
  time: string;
  channel: Channel;
  status: "new" | "open" | "waiting" | "reclamation" | "approval" | "billing" | "done";
  priority: "high" | "medium" | "low";
  content: string;
  category: string;
}

const DEMO_THREADS: Thread[] = [
  {
    id: "t1",
    sender: "Maier GmbH (Herr Zill)",
    subject: "Beschädigt angekommen",
    time: "08:14",
    channel: "email",
    status: "reclamation",
    priority: "high",
    content: "Guten Morgen, leider weisen 14 Teile der gestrigen Lieferung (Charge 8102) tiefe Kratzer auf. Wie gehen wir vor? Bilder anbei.",
    category: "Reklamation"
  },
  {
    id: "t2",
    sender: "Autohaus Berger",
    subject: "Wann ist mein Auftrag fertig?",
    time: "09:30",
    channel: "whatsapp",
    status: "open",
    priority: "medium",
    content: "Hallo, könnt ihr mir sagen wann die Oldtimer-Stoßstangen abholbereit sind?",
    category: "Terminanfrage"
  },
  {
    id: "t3",
    sender: "Schmidt AG",
    subject: "Bitte Angebot bestätigen",
    time: "Gestern",
    channel: "email",
    status: "approval",
    priority: "medium",
    content: "Anbei unser Angebot für die Verzinkung der 500 Rahmen. Bitte um kurze Freigabe.",
    category: "Freigabe"
  },
  {
    id: "t4",
    sender: "Schlosserei Brunner",
    subject: "Rechnung fehlt",
    time: "Gestern",
    channel: "phone",
    status: "billing",
    priority: "low",
    content: "(Telefonnotiz) Herr Brunner hat angerufen, ihm fehlt die Rechnung zur Lieferung vom 12.05.",
    category: "Buchhaltung"
  },
  {
    id: "t5",
    sender: "Unbekannt (Website)",
    subject: "Neue Anfrage Oldtimerteile",
    time: "Vorgestern",
    channel: "website",
    status: "new",
    priority: "low",
    content: "Hallo, verchromen Sie auch Motorradtanks? Was würde das grob kosten?",
    category: "Neuanfrage"
  }
];

function PhoneNoteOverlay({ open, onClose }: { open: boolean, onClose: () => void }) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Live Matches
  const [matchedCustomer, setMatchedCustomer] = useState<MockCustomer | null>(null);
  const [matchedOrder, setMatchedOrder] = useState<MockOrder | null>(null);
  const [matchedMaterial, setMatchedMaterial] = useState<string | null>(null);
  const [matchedKeywords, setMatchedKeywords] = useState<string[]>([]);
  
  const [fields, setFields] = useState({
    kunde: "",
    firma: "",
    telefon: "",
    auftrag: "",
    thema: "",
    kategorie: "Neuanfrage",
    dringlichkeit: "Normal",
    reklamation: "Nein",
    aktion: "",
  });

  const analyzeText = useCallback((val: string) => {
    const match = smartMatchText(val);
    setMatchedCustomer(match.matchedCustomer);
    setMatchedOrder(match.matchedOrder);
    setMatchedMaterial(match.matchedMaterial);
    setMatchedKeywords(match.matchedKeywords);
  }, []);

  useEffect(() => {
    const draft = localStorage.getItem("kreile_phone_note_draft");
    if (draft) {
      // eslint-disable-next-line
      setText(draft);
      analyzeText(draft);
    }
  }, [analyzeText]);

  const handleChange = (val: string) => {
    setText(val);
    localStorage.setItem("kreile_phone_note_draft", val);
    analyzeText(val);
  };

  const handleParse = () => {
    setFields({
      kunde: matchedCustomer ? matchedCustomer.name : "",
      firma: matchedCustomer ? matchedCustomer.name : "",
      telefon: matchedCustomer?.phone || "",
      auftrag: matchedOrder ? matchedOrder.id : "",
      thema: text.slice(0, 50) + "...",
      kategorie: matchedKeywords.includes("Reklamation") ? "Reklamation" : matchedKeywords.includes("Buchhaltung/Zahlung") ? "Buchhaltung" : "Rückfrage",
      dringlichkeit: text.toLowerCase().includes("dringend") || text.toLowerCase().includes("schnell") || text.toLowerCase().includes("asap") ? "Hoch" : "Normal",
      reklamation: matchedKeywords.includes("Reklamation") ? "Ja" : "Nein",
      aktion: "Kunde kontaktieren",
    });
    setParsed(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const result = await createPhoneNote({
        rawText: text,
        generatedAnswer: matchedOrder ? `Auftrag ${matchedOrder.id} - Status: ${matchedOrder.status}` : undefined,
        category: matchedKeywords.includes("Reklamation") ? "Reklamation" : matchedKeywords.includes("Buchhaltung/Zahlung") ? "Buchhaltung" : "Neuanfrage",
        urgency: text.toLowerCase().includes("dringend") || text.toLowerCase().includes("schnell") || text.toLowerCase().includes("asap") ? "Hoch" : "Normal",
        customerId: matchedCustomer?.id,
        orderId: matchedOrder?.id,
        callerName: matchedCustomer?.name,
        company: matchedCustomer?.name,
        phone: matchedCustomer?.phone,
        extractionJson: { keywords: matchedKeywords, material: matchedMaterial },
        linksJson: []
      });

      if (result.success) {
        localStorage.removeItem("kreile_phone_note_draft");
        setSaveSuccess(true);
        setTimeout(() => {
          onClose();
          setText("");
          setParsed(false);
          setSaveSuccess(false);
        }, 1500);
      } else {
        setSaveError(result.error || "Ein unbekannter Fehler ist aufgetreten.");
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Fehler beim Speichern der Notiz.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (text.trim() && !saveSuccess && !window.confirm("Achtung: Telefonnotiz noch nicht gespeichert! Wirklich schließen?")) {
      return;
    }
    onClose();
  };

  // Helper für Highlight Rendering
  const renderHighlightedText = () => {
    if (!text) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parts: any[] = [text];

    const highlightWord = (word: string, colorClass: string, href?: string) => {
      if (!word) return;
      const regex = new RegExp(`(${word})`, "gi");
      parts = parts.flatMap(part => {
        if (typeof part !== "string") return [part];
        const split = part.split(regex);
        return split.map((s, i) => {
          if (i % 2 === 1) {
            if (href && parsed) {
              return <Link key={`${word}-${i}`} href={href} target="_blank" className={`${colorClass} px-1 rounded-md shadow-sm border hover:opacity-80 transition cursor-pointer underline decoration-dotted underline-offset-2`}>{s}</Link>;
            }
            return <span key={`${word}-${i}`} className={`${colorClass} px-1 rounded-md shadow-sm border`}>{s}</span>;
          }
          return s;
        });
      });
    };

    if (matchedCustomer) {
      const href = `/customers/${matchedCustomer.id}`;
      if (matchedCustomer.name) highlightWord(matchedCustomer.name, "bg-blue-100 text-blue-900 border-blue-200", href);
    }
    if (matchedOrder) {
      highlightWord(matchedOrder.id, "bg-purple-100 text-purple-900 border-purple-200", `/orders/${matchedOrder.id}`);
    }
    if (matchedMaterial) {
      highlightWord(matchedMaterial, "bg-amber-100 text-amber-900 border-amber-200");
    }
    ["reklamation", "beschädigt", "kratzer", "kaputt"].forEach(w => highlightWord(w, "bg-red-100 text-red-900 border-red-200 font-bold"));
    ["rechnung", "zahlung", "bezahlen"].forEach(w => highlightWord(w, "bg-green-100 text-green-900 border-green-200"));
    ["versand", "abholung", "spedition", "fertig", "lieferung"].forEach(w => highlightWord(w, "bg-indigo-100 text-indigo-900 border-indigo-200"));

    return parts;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-12 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" onClick={handleCancel} />
      
      <div className="relative w-full max-w-6xl h-[85vh] bg-white rounded-3xl shadow-2xl flex flex-col md:flex-row overflow-hidden border border-neutral-gray-200">
        
        {/* LEFT/MAIN COLUMN */}
        <div className="flex-1 flex flex-col h-full bg-[#F0EBE0]">
          <div className="p-4 md:p-6 flex justify-between items-center border-b border-neutral-gray-200 bg-white">
            <h2 className="text-xl font-bold font-serif text-navy-900 flex items-center gap-2">
              <Phone className="w-5 h-5 text-accent-orange" />
              Neue Telefonnotiz
            </h2>
            <button onClick={handleCancel} className="p-2 hover:bg-neutral-gray-100 rounded-full transition-colors text-text-muted">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 p-4 md:p-8 flex flex-col overflow-y-auto relative">
            {!parsed ? (
              <div className="flex-1 flex flex-col h-full relative group">
                <div className="relative flex-1 w-full h-full bg-white rounded-2xl border-2 border-neutral-gray-200 focus-within:border-navy-900 shadow-sm overflow-hidden">
                  {/* Highlight Layer */}
                  <div 
                    className="absolute inset-0 p-6 text-xl md:text-2xl leading-relaxed whitespace-pre-wrap wrap-break-word pointer-events-none z-10"
                    style={{ color: 'transparent', fontFamily: 'inherit' }}
                    aria-hidden="true"
                  >
                    {renderHighlightedText()}
                  </div>
                  {/* Text Layer */}
                  <textarea 
                    value={text}
                    onChange={(e) => handleChange(e.target.value)}
                    className="absolute inset-0 w-full h-full p-6 text-xl md:text-2xl leading-relaxed bg-transparent text-navy-900 outline-none resize-none z-20 placeholder:text-neutral-gray-300"
                    style={{ caretColor: '#1a1a1a' }}
                    placeholder="Einfach mittippen... (Kunden, Aufträge und Signalwörter werden automatisch erkannt)"
                    autoFocus
                    spellCheck={false}
                  />
                </div>
                
                {/* Voice Input Mock */}
                <button 
                  disabled
                  className="w-12 h-12 rounded-full bg-navy-900/50 flex items-center justify-center cursor-not-allowed hover:bg-navy-900/50"
                  title="Sprachnotiz in Vorbereitung"
                >
                  <Mic className="w-6 h-6 text-white/50" />
                </button>
              </div>
            ) : (
              <div className="space-y-6 flex-1 flex flex-col h-full">
                {/* Parsed Text with Clickable Links */}
                <div className="bg-white p-6 rounded-2xl border-2 border-neutral-gray-200 shadow-sm text-xl md:text-2xl leading-relaxed whitespace-pre-wrap wrap-break-word text-navy-900 overflow-y-auto">
                  {renderHighlightedText()}
                </div>

                <div className="bg-success-green/10 border border-success-green/20 p-4 rounded-xl flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-success-green shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-success-green">Auswertung erfolgreich</h4>
                    <p className="text-sm text-success-green/80">Diese Felder werden bei Übernahme in die Zentrale importiert.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-text-muted uppercase mb-1">Kunde / Anrufer</label>
                    <input value={fields.kunde} onChange={e => setFields({...fields, kunde: e.target.value})} className="w-full bg-white border border-neutral-gray-200 rounded-lg p-3 text-sm font-bold focus:border-navy-900 outline-none shadow-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-muted uppercase mb-1">Kategorie</label>
                    <select value={fields.kategorie} onChange={e => setFields({...fields, kategorie: e.target.value})} className="w-full bg-white border border-neutral-gray-200 rounded-lg p-3 text-sm font-bold focus:border-navy-900 outline-none shadow-sm">
                       <option>Neuanfrage</option>
                       <option>Reklamation</option>
                       <option>Rückfrage</option>
                       <option>Rückruf</option>
                       <option>Buchhaltung</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-muted uppercase mb-1">Verknüpfter Auftrag</label>
                    <input value={fields.auftrag} onChange={e => setFields({...fields, auftrag: e.target.value})} className="w-full bg-white border border-neutral-gray-200 rounded-lg p-3 text-sm font-bold focus:border-navy-900 outline-none shadow-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-muted uppercase mb-1">Dringlichkeit</label>
                    <select value={fields.dringlichkeit} onChange={e => setFields({...fields, dringlichkeit: e.target.value})} className="w-full bg-white border border-neutral-gray-200 rounded-lg p-3 text-sm font-bold focus:border-navy-900 outline-none shadow-sm">
                       <option>Niedrig</option>
                       <option>Normal</option>
                       <option>Hoch</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 md:p-6 bg-white border-t border-neutral-gray-200 flex justify-between items-center">
            {!parsed ? (
              <>
                <span className="text-xs text-text-muted flex items-center gap-1 font-bold">
                  {text ? <><Save className="w-4 h-4"/> Entwurf gesichert</> : ""}
                </span>
                <button 
                  onClick={handleParse} 
                  disabled={!text.trim()}
                  className="bg-navy-900 text-white font-bold px-8 py-3 rounded-xl hover:bg-navy-800 disabled:opacity-50 transition"
                >
                  Text auswerten
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setParsed(false)} disabled={isSaving || saveSuccess} className="text-sm font-bold text-text-muted hover:text-navy-900 px-4 py-2 disabled:opacity-50">
                  Zurück zum Text
                </button>
                <button 
                  onClick={handleSave} 
                  disabled={isSaving || saveSuccess} 
                  className={`font-bold px-8 py-3 rounded-xl transition shadow-md ${saveSuccess ? 'bg-success-green text-white' : 'bg-accent-orange text-white hover:bg-orange-600'} disabled:opacity-70`}
                >
                  {isSaving ? "Speichert..." : saveSuccess ? "Gespeichert!" : "Telefonnotiz speichern"}
                </button>
              </>
            )}
          </div>
          {saveError && (
             <div className="p-4 bg-error-red/10 text-error-red text-sm font-bold border-t border-error-red/20">
               {saveError}
             </div>
          )}
        </div>

        {/* RIGHT COLUMN: LIVE VORSCHLÄGE & KI ANTWORT */}
        <div className="w-full md:w-96 bg-white border-l border-neutral-gray-200 flex flex-col h-full overflow-y-auto">
          <div className="p-6 border-b border-neutral-gray-100 bg-bg-app-soft">
            <h3 className="font-bold text-sm uppercase tracking-wider text-text-muted flex items-center gap-2">
              <Activity className="w-4 h-4" /> Live-Kontext
            </h3>
            <p className="text-[10px] text-text-muted mt-1">Echtzeit-Suche in Kundendatenbank & Aufträgen</p>
          </div>
          
          <div className="p-6 space-y-6 flex-1 bg-neutral-gray-50/50">
            {matchedCustomer && (
              <div className="animate-in slide-in-from-right-4 duration-300">
                <p className="text-xs font-bold text-text-muted uppercase mb-2">Erkannter Kunde</p>
                <Link href={`/customers/${matchedCustomer.id}`} target="_blank" className="block w-full text-left bg-blue-50 border border-blue-200 p-4 rounded-xl hover:bg-blue-100 transition-colors group shadow-sm">
                  <p className="font-bold text-blue-900">{matchedCustomer.name}</p>
                  <p className="text-xs text-blue-700 mt-1 flex items-center justify-between">
                    <span>{matchedCustomer.city || "Unbekannt"}</span>
                    <ExternalLink className="w-3 h-3 opacity-50 group-hover:opacity-100" />
                  </p>
                </Link>
              </div>
            )}
            
            {matchedOrder && (
              <div className="animate-in slide-in-from-right-4 duration-300">
                <p className="text-xs font-bold text-text-muted uppercase mb-2">Gefundener Auftrag</p>
                <Link href={`/orders/${matchedOrder.id}`} target="_blank" className="block w-full text-left bg-purple-50 border border-purple-200 p-4 rounded-xl hover:bg-purple-100 transition-colors group shadow-sm">
                  <div className="flex justify-between items-start">
                    <p className="font-bold text-purple-900">{matchedOrder.id}</p>
                    <ExternalLink className="w-3 h-3 text-purple-700 opacity-50 group-hover:opacity-100" />
                  </div>
                  <p className="text-xs text-purple-700 mt-1">{matchedOrder.task}</p>
                  <div className="mt-2 inline-block bg-purple-200/50 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                    Status: {matchedOrder.status}
                  </div>
                </Link>
              </div>
            )}

            {matchedMaterial && !matchedOrder && (
              <div className="animate-in slide-in-from-right-4 duration-300">
                <p className="text-xs font-bold text-text-muted uppercase mb-2">Material / Oberfläche</p>
                <div className="w-full text-left bg-amber-50 border border-amber-200 p-3 rounded-xl shadow-sm">
                  <p className="font-bold text-amber-900 capitalize">{matchedMaterial}</p>
                </div>
              </div>
            )}

            {matchedKeywords.length > 0 && (
              <div className="animate-in slide-in-from-right-4 duration-300">
                <p className="text-xs font-bold text-text-muted uppercase mb-2">Erkannte Themen</p>
                <div className="flex flex-wrap gap-2">
                  {matchedKeywords.map(kw => (
                    <span key={kw} className="bg-neutral-gray-200 text-navy-900 text-xs font-bold px-3 py-1.5 rounded-lg border border-neutral-gray-300 shadow-sm">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {text.length > 20 && !matchedCustomer && !matchedOrder && !matchedMaterial && matchedKeywords.length === 0 && (
               <div className="text-center p-6 border-2 border-dashed border-neutral-gray-200 rounded-xl">
                 <p className="text-xs font-medium text-text-muted">Tippen Sie Kundennamen, Auftragsnummern oder Themen ein, um Live-Treffer zu sehen.</p>
               </div>
            )}
          </div>
          
          {/* AUSGABE FELD */}
          <div className="p-6 bg-navy-900 text-white mt-auto rounded-tl-3xl shadow-[0_-10px_30px_rgba(0,0,0,0.1)]">
            <h3 className="font-bold text-sm uppercase tracking-wider text-white/50 flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4" /> Antwortvorschlag <span className="text-[10px] normal-case bg-white/10 px-2 py-0.5 rounded">(aus App-Daten abgeleitet)</span>
            </h3>
            <div className="text-sm font-medium leading-relaxed">
              {matchedOrder ? (
                <span>
                  Hallo {matchedCustomer?.name ? "Herr/Frau " + matchedCustomer.name.split(" ").pop() : "zusammen"},\n\nich habe gerade den Vorgang <strong className="underline">{matchedOrder.id}</strong> ({matchedOrder.task}) vor mir.
                  Der aktuelle Stand ist: <strong className="text-accent-orange uppercase">{matchedOrder.status}</strong>. 
                  {matchedOrder.status === 'in_beschichtung' || matchedOrder.status === 'vorbehandlung' ? ' Er wird voraussichtlich in Kürze fertig.' : ''}
                  {matchedOrder.status === 'fertig' ? ' Sie können die Ware abholen.' : ''}“
                </span>
              ) : matchedCustomer ? (
                <span>
                  „Guten Tag {matchedCustomer.name}, ich habe Ihre Kundenakte aufgerufen. Um welchen Auftrag geht es genau?“
                </span>
              ) : matchedKeywords.includes("Reklamation") ? (
                <span>
                  „Es tut mir leid, dass es ein Problem gibt. Ich nehme das sofort als Reklamation auf. Haben Sie eine Auftragsnummer für mich?“
                </span>
              ) : text.length > 15 ? (
                <span className="text-white/50 italic">Status noch nicht eindeutig. Erwähnen Sie einen Kunden oder Auftrag.</span>
              ) : (
                <span className="text-white/50 italic">Tippen Sie mit, um automatische Antworten zu generieren...</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function KommunikationClient() {
  const [activeChannel, setActiveChannel] = useState<Channel>("all");
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [isPhoneNoteMode, setIsPhoneNoteMode] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [recentNotes, setRecentNotes] = useState<any[]>([]);

  usePageView();

  useEffect(() => {
    // URL Check
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'telefonnotiz') {
        // eslint-disable-next-line
        setIsPhoneNoteMode(true);
      }
    }

    // Fetch recent notes
    getRecentPhoneNotes(5).then(notes => setRecentNotes(notes));
  }, []);

  // Update notes when modal closes to show new ones
  useEffect(() => {
    if (!isPhoneNoteMode) {
      getRecentPhoneNotes(5).then(notes => setRecentNotes(notes));
    }
  }, [isPhoneNoteMode]);

  const mappedPhoneNotes = recentNotes.map(n => ({
    id: `pn_${n.id}`,
    sender: n.callerName || n.company || "Unbekannter Anrufer",
    subject: `Notiz: ${n.category}`,
    time: new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    channel: "phone" as Channel,
    status: n.status === "open" ? "open" : "new",
    priority: n.urgency === "Hoch" ? "high" : "medium",
    content: n.rawText,
    category: n.category,
    rawNote: n
  }));

  const allThreads = [...DEMO_THREADS, ...mappedPhoneNotes];
  const filteredThreads = allThreads.filter(t => activeChannel === "all" || t.channel === activeChannel);
  const activeThread = allThreads.find(t => t.id === activeThreadId);

  const getStatusBadge = (status: string) => {
    switch(status) {
      case "new": return <span className="bg-blue-100 text-blue-700 text-[10px] font-black uppercase px-2 py-0.5 rounded">Neu</span>;
      case "open": return <span className="bg-yellow-100 text-yellow-700 text-[10px] font-black uppercase px-2 py-0.5 rounded">Offen</span>;
      case "waiting": return <span className="bg-gray-100 text-gray-600 text-[10px] font-black uppercase px-2 py-0.5 rounded">Wartet auf Kunde</span>;
      case "reclamation": return <span className="bg-red-100 text-red-700 text-[10px] font-black uppercase px-2 py-0.5 rounded flex items-center gap-1"><AlertOctagon className="w-3 h-3"/> Reklamationsverdacht</span>;
      case "approval": return <span className="bg-orange-100 text-orange-700 text-[10px] font-black uppercase px-2 py-0.5 rounded">Freigabe offen</span>;
      case "billing": return <span className="bg-purple-100 text-purple-700 text-[10px] font-black uppercase px-2 py-0.5 rounded">Rechnung/Zahlung</span>;
      case "done": return <span className="bg-green-100 text-green-700 text-[10px] font-black uppercase px-2 py-0.5 rounded">Erledigt</span>;
      default: return null;
    }
  };

  const getChannelIcon = (channel: string) => {
    switch(channel) {
      case "email": return <Mail className="w-4 h-4 text-gray-500" />;
      case "whatsapp": return <MessageSquare className="w-4 h-4 text-green-500" />;
      case "instagram": return <Camera className="w-4 h-4 text-pink-500" />;
      case "website": return <Globe className="w-4 h-4 text-blue-500" />;
      case "phone": return <Phone className="w-4 h-4 text-gray-500" />;
      case "billing": return <Banknote className="w-4 h-4 text-gray-500" />;
      default: return <Inbox className="w-4 h-4 text-gray-500" />;
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col font-sans antialiased text-navy-900 animate-in fade-in duration-400">
      
      {/* HEADER / SCHRITTLEISTE */}
      <div className="mb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black font-serif tracking-tight flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-accent-orange" />
            Kommunikationszentrale
          </h1>
          <p className="text-xs text-text-muted mt-1">Live-Import noch nicht angebunden. (Demo-Modus)</p>
        </div>
        
        {/* Schrittleiste */}
        <div className="flex items-center gap-2 text-xs font-bold bg-white px-4 py-2 rounded-xl border border-neutral-gray-200 shadow-sm overflow-x-auto max-w-full">
          <span className="text-accent-orange">1. Lesen</span>
          <ArrowRight className="w-3 h-3 text-neutral-gray-300" />
          <span className="text-navy-900">2. Zuordnen</span>
          <ArrowRight className="w-3 h-3 text-neutral-gray-300" />
          <span className="text-navy-900">3. Antworten</span>
          <ArrowRight className="w-3 h-3 text-neutral-gray-300" />
          <span className="text-navy-900">4. Ablage</span>
        </div>
      </div>

      {/* 3-COLUMN LAYOUT */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden">
        
        {/* COL 1: KANÄLE */}
        <div className="w-full md:w-48 lg:w-64 bg-white border border-neutral-gray-200 rounded-2xl flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-neutral-gray-100 font-bold text-sm uppercase tracking-wider text-text-muted">
            Kanäle
          </div>
          <div className="p-2 space-y-1">
            <button onClick={() => setActiveChannel("all")} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${activeChannel === "all" ? "bg-bg-app-soft text-navy-900 font-bold" : "text-text-muted hover:bg-gray-50"}`}>
              <Inbox className="w-4 h-4" /> Alle
            </button>
            <button onClick={() => setActiveChannel("email")} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${activeChannel === "email" ? "bg-bg-app-soft text-navy-900 font-bold" : "text-text-muted hover:bg-gray-50"}`}>
              <Mail className="w-4 h-4" /> E-Mail
            </button>
            <button disabled className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm font-medium text-text-muted opacity-50 cursor-not-allowed" title="In Vorbereitung">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-4 h-4" /> WhatsApp
              </div>
              <span className="text-[9px] uppercase font-bold bg-neutral-gray-200 px-1.5 py-0.5 rounded">Demo</span>
            </button>
            <button disabled className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm font-medium text-text-muted opacity-50 cursor-not-allowed" title="In Vorbereitung">
              <div className="flex items-center gap-3">
                <Camera className="w-4 h-4" /> Instagram
              </div>
              <span className="text-[9px] uppercase font-bold bg-neutral-gray-200 px-1.5 py-0.5 rounded">Demo</span>
            </button>
            <button onClick={() => setActiveChannel("website")} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${activeChannel === "website" ? "bg-bg-app-soft text-navy-900 font-bold" : "text-text-muted hover:bg-gray-50"}`}>
              <Globe className="w-4 h-4" /> Website
            </button>
            <button onClick={() => setActiveChannel("phone")} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${activeChannel === "phone" ? "bg-bg-app-soft text-navy-900 font-bold" : "text-text-muted hover:bg-gray-50"}`}>
              <Phone className="w-4 h-4" /> Telefonnotiz
            </button>
            <button onClick={() => setActiveChannel("billing")} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${activeChannel === "billing" ? "bg-bg-app-soft text-navy-900 font-bold" : "text-text-muted hover:bg-gray-50"}`}>
              <Banknote className="w-4 h-4" /> Rechnungen
            </button>
          </div>

          {recentNotes.length > 0 && (
            <div className="mt-4 border-t border-neutral-gray-100 p-2">
              <div className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-2">
                <Phone className="w-3 h-3" /> Letzte Notizen
              </div>
              <div className="space-y-1 mt-1">
                {recentNotes.map((note) => (
                  <div key={note.id} onClick={() => setActiveThreadId(`pn_${note.id}`)} className="px-3 py-2 rounded-lg bg-gray-50 border border-neutral-gray-100 text-xs cursor-pointer hover:bg-neutral-gray-200 transition">
                    <div className="font-bold text-navy-900 mb-1">{note.category}</div>
                    <div className="text-text-muted line-clamp-2">{note.rawText}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* COL 2: NACHRICHTEN/THREADS */}
        <div className="w-full md:w-80 lg:w-96 bg-white border border-neutral-gray-200 rounded-2xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-neutral-gray-100 font-bold text-sm uppercase tracking-wider text-text-muted flex justify-between items-center">
            <span>Eingang</span>
            <span className="bg-bg-app-soft px-2 py-0.5 rounded text-navy-900">{filteredThreads.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredThreads.map(t => (
              <div 
                key={t.id} 
                onClick={() => setActiveThreadId(t.id)}
                className={`p-4 border-b border-neutral-gray-100 cursor-pointer hover:bg-gray-50 transition relative ${activeThreadId === t.id ? 'bg-bg-app-soft' : ''}`}
              >
                {t.priority === 'high' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-error-red" />}
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-2">
                    {getChannelIcon(t.channel)}
                    <span className="font-bold text-sm text-navy-900 line-clamp-1">{t.sender}</span>
                  </div>
                  <span className="text-xs text-text-muted whitespace-nowrap">{t.time}</span>
                </div>
                <div className="font-medium text-sm mb-2 line-clamp-1">{t.subject}</div>
                <div className="flex justify-between items-center">
                  {getStatusBadge(t.status)}
                  <span className="text-xs text-text-muted">{t.category}</span>
                </div>
              </div>
            ))}
            {filteredThreads.length === 0 && (
              <div className="p-8 text-center text-text-muted text-sm">Keine Nachrichten in diesem Kanal.</div>
            )}
          </div>
        </div>

        {/* COL 3: ARBEITSBEREICH */}
        <div className="flex-1 bg-white border border-neutral-gray-200 rounded-2xl flex flex-col overflow-hidden">
          {activeThread ? (
            activeThread.id.startsWith("pn_") ? (
              <PhoneNoteDetailView 
                note={(activeThread as any).rawNote} 
                onUpdate={() => getRecentPhoneNotes(5).then(notes => setRecentNotes(notes))}
                onClose={() => setActiveThreadId(null)}
              />
            ) : (
          <>
            {/* Bereich 1: Nachricht ansehen */}
            <div className="p-6 border-b border-neutral-gray-100">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold font-serif mb-1">{activeThread.subject}</h2>
                  <div className="flex items-center gap-3 text-sm text-text-muted">
                    <span className="font-medium text-navy-900">{activeThread.sender}</span>
                    <span>•</span>
                    <span>{activeThread.time}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">{getChannelIcon(activeThread.channel)} {activeThread.channel}</span>
                  </div>
                </div>
                {getStatusBadge(activeThread.status)}
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-sm leading-relaxed border border-neutral-gray-200 whitespace-pre-wrap">
                {activeThread.content}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Bereich 2: Zuordnung */}
              <div>
                <h3 className="font-bold text-sm uppercase tracking-wider text-text-muted mb-3 flex items-center gap-2">
                  <LinkIcon className="w-4 h-4" /> 2. Zuordnung (Demo)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="border border-neutral-gray-200 rounded-xl p-3 bg-white">
                    <div className="text-xs text-text-muted mb-1">Erkannter Kunde</div>
                    <div className="font-bold text-sm flex justify-between items-center">
                      {activeThread.sender.includes("Maier") ? "Maier GmbH" : activeThread.sender.includes("Berger") ? "Autohaus Berger" : "Unbekannt"}
                      <Link href="/customers" className="text-accent-orange"><ExternalLink className="w-3 h-3"/></Link>
                    </div>
                  </div>
                  <div className="border border-neutral-gray-200 rounded-xl p-3 bg-white">
                    <div className="text-xs text-text-muted mb-1">Möglicher Auftrag</div>
                    <div className="font-bold text-sm flex justify-between items-center">
                      {activeThread.status === "reclamation" ? "A-2026-0042" : "Keine Zuweisung"}
                      <Link href="/orders" className="text-accent-orange"><ExternalLink className="w-3 h-3"/></Link>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bereich 3: Antwortvorlage */}
              <div>
                <h3 className="font-bold text-sm uppercase tracking-wider text-text-muted mb-3 flex items-center gap-2">
                  <CheckSquare className="w-4 h-4" /> 3. Antwortvorlage wählen
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    "Reklamation bestätigen", "Liefertermin nennen", "Freigabe anfordern", 
                    "Angaben anfordern", "Abholung ankündigen", "Zahlungslink senden"
                  ].map(tpl => (
                    <button 
                      key={tpl}
                      onClick={() => handleCopy(`Vorlage: ${tpl}\n\nSehr geehrte(r)...`)}
                      className="text-xs font-medium border border-neutral-gray-200 rounded-lg p-2 hover:bg-bg-app-soft hover:border-navy-900 transition flex items-center justify-between group"
                    >
                      <span className="text-left line-clamp-1">{tpl}</span>
                      {copied === `Vorlage: ${tpl}\n\nSehr geehrte(r)...` ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-text-muted group-hover:text-navy-900" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bereich 4: Ablage */}
              <div>
                <h3 className="font-bold text-sm uppercase tracking-wider text-text-muted mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> 4. Ablage / Nächste Aktion
                </h3>
                <div className="flex flex-wrap gap-2">
                  <Link href="/kundenservice" className="text-xs font-bold bg-white border border-neutral-gray-200 px-3 py-2 rounded-lg hover:bg-bg-app-soft transition">In Kundenservice ablegen</Link>
                  <Link href="/finanzen" className="text-xs font-bold bg-white border border-neutral-gray-200 px-3 py-2 rounded-lg hover:bg-bg-app-soft transition">An Buchhaltung leiten</Link>
                  <Link href="/quotes" className="text-xs font-bold bg-white border border-neutral-gray-200 px-3 py-2 rounded-lg hover:bg-bg-app-soft transition">Neues Angebot anlegen</Link>
                </div>
              </div>

            </div>
          </>
          )
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-text-muted p-8 text-center">
            <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
            <p className="font-bold">Keine Nachricht ausgewählt</p>
            <p className="text-sm mt-1">Wähle eine Nachricht in der Liste, um sie zu bearbeiten.</p>
          </div>
        )}
        </div>
      </div>

      <PhoneNoteOverlay 
        open={isPhoneNoteMode} 
        onClose={() => {
          setIsPhoneNoteMode(false);
          if (typeof window !== 'undefined') {
            window.history.replaceState({}, '', '/kommunikation');
          }
        }} 
      />
    </div>
  );
}
