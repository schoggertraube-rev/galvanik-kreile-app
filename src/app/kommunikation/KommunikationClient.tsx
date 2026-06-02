"use client";

import { useState, useEffect } from "react";
import { 
  Inbox, MessageSquare, Mail, Phone, Globe, Camera,
  AlertOctagon, CheckSquare, Clock, ArrowRight, Link as LinkIcon,
  Copy, CheckCircle2, User, FileText, Banknote, ExternalLink,
  Mic, X, Edit2, Play, Save, ChevronRight
} from "lucide-react";
import Link from "next/link";
import { usePageView } from "@/hooks/usePageView";

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

function PhoneNoteEditor({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState(false);
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

  useEffect(() => {
    const draft = localStorage.getItem("kreile_phone_note_draft");
    if (draft) setText(draft);
  }, []);

  const handleChange = (val: string) => {
    setText(val);
    localStorage.setItem("kreile_phone_note_draft", val);
  };

  const handleParse = () => {
    // Simple demo logic to "parse" the text
    setFields({
      kunde: text.toLowerCase().includes("maier") ? "Herr Zill" : "Unbekannt",
      firma: text.toLowerCase().includes("maier") ? "Maier GmbH" : "Unbekannt",
      telefon: "0151 12345678",
      auftrag: text.toLowerCase().includes("8102") ? "A-2026-8102" : "",
      thema: text.slice(0, 50) + "...",
      kategorie: text.toLowerCase().includes("reklamation") || text.toLowerCase().includes("kaputt") ? "Reklamation" : "Neuanfrage",
      dringlichkeit: text.toLowerCase().includes("dringend") || text.toLowerCase().includes("schnell") ? "Hoch" : "Normal",
      reklamation: text.toLowerCase().includes("reklamation") || text.toLowerCase().includes("kaputt") ? "Ja" : "Nein",
      aktion: "Kunde zurückrufen",
    });
    setParsed(true);
  };

  const handleSave = () => {
    // In a real app we'd save it to the DB here.
    localStorage.removeItem("kreile_phone_note_draft");
    onClose();
  };

  const handleCancel = () => {
    if (text.trim() && !window.confirm("Achtung: Telefonnotiz noch nicht gespeichert! Wirklich schließen?")) {
      return;
    }
    onClose();
  };

  return (
    <div className="flex-1 bg-white border border-neutral-gray-200 rounded-2xl flex flex-col overflow-hidden animate-in fade-in duration-300">
      <div className="p-4 border-b border-neutral-gray-100 font-bold text-sm uppercase tracking-wider text-text-muted flex justify-between items-center bg-bg-app-soft">
        <span className="flex items-center gap-2"><Phone className="w-4 h-4 text-navy-900"/> Telefonnotiz erfassen</span>
        <button onClick={handleCancel} className="text-text-muted hover:text-navy-900"><X className="w-5 h-5"/></button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {!parsed ? (
          <div className="space-y-4">
            <div className="flex gap-4">
              <button disabled className="flex-1 flex flex-col items-center justify-center p-6 border-2 border-dashed border-neutral-gray-300 rounded-2xl bg-gray-50 opacity-60 cursor-not-allowed group">
                <div className="w-12 h-12 rounded-full bg-accent-orange/10 flex items-center justify-center mb-3">
                  <Mic className="w-6 h-6 text-accent-orange" />
                </div>
                <span className="font-bold text-navy-900">Sprachnotiz aufnehmen</span>
                <span className="text-xs text-text-muted mt-1">(Vorbereitet)</span>
              </button>
              <div className="flex-1 flex flex-col items-center justify-center p-6 border-2 border-navy-900 rounded-2xl bg-white shadow-sm group">
                <div className="w-12 h-12 rounded-full bg-navy-900/10 flex items-center justify-center mb-3">
                  <Edit2 className="w-6 h-6 text-navy-900" />
                </div>
                <span className="font-bold text-navy-900">Freitext eingeben</span>
                <span className="text-xs text-success-green mt-1">Aktiv</span>
              </div>
            </div>

            <textarea 
              value={text}
              onChange={(e) => handleChange(e.target.value)}
              className="w-full h-48 p-4 bg-bg-app-soft rounded-xl border border-neutral-gray-200 focus:border-navy-900 focus:ring-1 focus:ring-navy-900 outline-none text-navy-900 resize-none"
              placeholder="Notizen aus dem Telefonat hier eintippen..."
            />

            <div className="flex justify-between items-center">
              <span className="text-xs text-text-muted flex items-center gap-1"><Save className="w-3 h-3"/> Entwurf wird lokal gespeichert</span>
              <button 
                onClick={handleParse} 
                disabled={!text.trim()}
                className="bg-navy-900 text-white font-bold px-6 py-3 rounded-xl hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
              >
                Notiz auswerten <ChevronRight className="w-4 h-4"/>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-success-green/10 border border-success-green/20 p-4 rounded-xl flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-success-green shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-success-green">Auswertung erfolgreich</h4>
                <p className="text-sm text-success-green/80">Bitte prüfen Sie die erkannten Felder und korrigieren Sie diese bei Bedarf.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">Kunde / Anrufer</label>
                <input value={fields.kunde} onChange={e => setFields({...fields, kunde: e.target.value})} className="w-full bg-white border border-neutral-gray-200 rounded-lg p-2 text-sm font-medium focus:border-navy-900 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">Firma</label>
                <input value={fields.firma} onChange={e => setFields({...fields, firma: e.target.value})} className="w-full bg-white border border-neutral-gray-200 rounded-lg p-2 text-sm font-medium focus:border-navy-900 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">Telefonnummer</label>
                <input value={fields.telefon} onChange={e => setFields({...fields, telefon: e.target.value})} className="w-full bg-white border border-neutral-gray-200 rounded-lg p-2 text-sm font-medium focus:border-navy-900 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">Auftrag (optional)</label>
                <input value={fields.auftrag} onChange={e => setFields({...fields, auftrag: e.target.value})} className="w-full bg-white border border-neutral-gray-200 rounded-lg p-2 text-sm font-medium focus:border-navy-900 outline-none" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">Zusammenfassung / Thema</label>
                <input value={fields.thema} onChange={e => setFields({...fields, thema: e.target.value})} className="w-full bg-white border border-neutral-gray-200 rounded-lg p-2 text-sm font-medium focus:border-navy-900 outline-none" />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
               <div className="bg-bg-app-soft border border-neutral-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-2">
                 <span className="text-xs font-bold text-text-muted">Kategorie:</span>
                 <select value={fields.kategorie} onChange={e => setFields({...fields, kategorie: e.target.value})} className="bg-transparent text-sm font-bold text-navy-900 outline-none">
                   <option>Neuanfrage</option>
                   <option>Reklamation</option>
                   <option>Terminfrage</option>
                   <option>Rückruf</option>
                 </select>
               </div>
               <div className="bg-bg-app-soft border border-neutral-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-2">
                 <span className="text-xs font-bold text-text-muted">Dringlichkeit:</span>
                 <select value={fields.dringlichkeit} onChange={e => setFields({...fields, dringlichkeit: e.target.value})} className="bg-transparent text-sm font-bold text-navy-900 outline-none">
                   <option>Niedrig</option>
                   <option>Normal</option>
                   <option>Hoch</option>
                 </select>
               </div>
            </div>

            <div className="md:col-span-2">
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">Original Notiztext</label>
                <textarea value={text} onChange={e => handleChange(e.target.value)} className="w-full h-24 bg-white border border-neutral-gray-200 rounded-lg p-2 text-sm focus:border-navy-900 outline-none resize-none" />
            </div>

            {fields.auftrag && (
              <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-blue-800">Verknüpfter Auftrag: {fields.auftrag}</span>
                  <p className="text-[11px] text-blue-600">Status: In Galvanik • Erwartet: Morgen</p>
                </div>
                <Link href={`/orders/${fields.auftrag}`} className="text-xs font-bold bg-white text-blue-800 px-3 py-1.5 rounded border border-blue-200">Auftrag öffnen</Link>
              </div>
            )}

            <div className="pt-4 border-t border-neutral-gray-200 flex justify-between items-center">
              <button onClick={() => setParsed(false)} className="text-sm font-bold text-text-muted hover:text-navy-900">Zurück zur Eingabe</button>
              <div className="flex gap-2">
                <button onClick={handleSave} className="bg-white border border-neutral-gray-200 text-navy-900 font-bold px-4 py-2 rounded-xl hover:bg-gray-50 transition">Als Entwurf speichern</button>
                <button onClick={handleSave} className="bg-navy-900 text-white font-bold px-4 py-2 rounded-xl hover:bg-navy-800 transition flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/> Telefonnotiz speichern</button>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

export function KommunikationClient() {
  usePageView();
  const [activeChannel, setActiveChannel] = useState<Channel>("all");
  const [activeThreadId, setActiveThreadId] = useState<string>("t1");
  const [copied, setCopied] = useState<string | null>(null);
  const [isPhoneNoteMode, setIsPhoneNoteMode] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search;
      if (search.includes("mode=telefonnotiz")) {
        setIsPhoneNoteMode(true);
      }
    }
  }, []);

  const filteredThreads = DEMO_THREADS.filter(t => activeChannel === "all" || t.channel === activeChannel);
  const activeThread = DEMO_THREADS.find(t => t.id === activeThreadId);

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
            <button onClick={() => setActiveChannel("whatsapp")} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${activeChannel === "whatsapp" ? "bg-bg-app-soft text-navy-900 font-bold" : "text-text-muted hover:bg-gray-50"}`}>
              <MessageSquare className="w-4 h-4" /> WhatsApp
            </button>
            <button onClick={() => setActiveChannel("instagram")} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${activeChannel === "instagram" ? "bg-bg-app-soft text-navy-900 font-bold" : "text-text-muted hover:bg-gray-50"}`}>
              <Camera className="w-4 h-4" /> Instagram
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
        {isPhoneNoteMode ? (
          <PhoneNoteEditor onClose={() => {
            setIsPhoneNoteMode(false);
            // Optionally remove the ?mode=telefonnotiz from URL
            if (typeof window !== 'undefined') {
              window.history.replaceState({}, '', '/kommunikation');
            }
          }} />
        ) : (
          <div className="flex-1 bg-white border border-neutral-gray-200 rounded-2xl flex flex-col overflow-hidden">
            {activeThread ? (
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
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-text-muted p-8 text-center">
              <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-bold">Keine Nachricht ausgewählt</p>
              <p className="text-sm mt-1">Wähle eine Nachricht in der Liste, um sie zu bearbeiten.</p>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
