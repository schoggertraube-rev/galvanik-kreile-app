"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Inbox, MessageSquare, Mail, Phone, Globe,
  AlertOctagon, User, FileText, Banknote,
  Edit2, Activity, Search, Plus, PhoneCall, Bell, MoreVertical, Send,
  Calendar, Package, CreditCard, Settings, ChevronRight, ChevronLeft,
  Archive, PhoneForwarded, CheckSquare, X, Paperclip, Image as ImageIcon
} from "lucide-react";
import Link from "next/link";
import { usePageView } from "@/hooks/usePageView";
import { INITIAL_ORDERS } from "@/lib/mockData";
import { getRecentPhoneNotes, updatePhoneNote } from "@/app/actions/phoneNotes.actions";
import { smartMatchText, MatchResult } from "./smartMatcher";
import { useParkedCall } from "@/contexts/ParkedCallContext";
import { ContextAnalysisOverlay, ContextAnalysisOverlayProps } from "@/components/kommunikation/ContextAnalysisOverlay";

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */
type Channel = "all" | "email" | "phone" | "website" | "reclamation" | "callback" | "done" | "parked";
type NoteStatus = "new" | "open" | "waiting_callback" | "waiting_customer" | "done" | "archived";

interface ChatMessage {
  id: string;
  from: "customer" | "kreile" | "system";
  channel: "email" | "phone" | "whatsapp" | "website" | "system";
  text: string;
  time: string;
  date?: string;
}

interface Thread {
  id: string;
  sender: string;
  senderCity?: string;
  initials: string;
  initialsColor: string;
  subject: string;
  time: string;
  channel: Channel;
  status: NoteStatus;
  priority: "high" | "medium" | "low";
  content: string;
  category: string;
  unread?: number;
  customerId?: string;
  orderId?: string;
  isPhoneNote?: boolean;
  rawNote?: Record<string, unknown>;
  matchData?: MatchResult;
  messages: ChatMessage[];
}

/* ═══════════════════════════════════════════════════════════════
   DEMO DATA
   ═══════════════════════════════════════════════════════════════ */
const DEMO_THREADS: Thread[] = [
  {
    id: "demo_t1", sender: "Maier GmbH · Herr Zill", senderCity: "Frankfurt", initials: "MZ", initialsColor: "#C2410C",
    subject: "Beschädigt angekommen — Foto", time: "08:14", channel: "email",
    status: "new", priority: "high", content: "Beschäd. angekommen — Foto",
    category: "Reklamation", unread: 2,
    messages: [{ id: "m1a", from: "customer", channel: "email", text: "Guten Morgen, leider weisen 14 Teile der gestrigen Lieferung (Charge 8102) tiefe Kratzer auf. Wie gehen wir vor? Bilder anbei.", time: "08:14" }]
  },
  {
    id: "demo_t2", sender: "Autohaus Berger", senderCity: "Offenbach", initials: "AB", initialsColor: "#7C3AED",
    subject: "Wann ist mein Auftrag fertig?", time: "09:30", channel: "website",
    status: "open", priority: "medium", content: "Wann ist mein Auftrag fertig? Wün…",
    category: "Terminanfrage", unread: 1,
    messages: [{ id: "m2a", from: "customer", channel: "website", text: "Hallo, könnt ihr mir sagen wann die Oldtimer-Stoßstangen abholbereit sind?", time: "09:30" }]
  },
  {
    id: "demo_t3", sender: "Müller (Privat)", senderCity: "Berlin", initials: "M", initialsColor: "#1E3A8A",
    subject: "Zinkteile fertig? Abholung morgen.", time: "11:08", channel: "phone",
    status: "open", priority: "medium", content: "✓ Zinkteile fertig? Abholung morgen…",
    category: "Abholung", unread: 0,
    messages: [
      { id: "m3a", from: "system", channel: "system", text: "TELEFONNOTIZ · 11:08\nHerr Müller fragt, ob die Zinkteile vom Auftrag A-2026-0042 schon fertig sind und ob er morgen abholen kann. Bitte Zahlungsstatus prüfen.", time: "11:08", date: "Heute, 3. Juni 2026" },
      { id: "m3b", from: "kreile", channel: "email", text: "Guten Tag Herr Müller: anbei die Auftragsbestätigung für A-2026-0042 (Zinkteile, Wasserhahn historisch). Liefertermin 4.6.\nMit freundlichen Grüßen, P. Kreile.", time: "09:32", date: "28. Mai 2026" },
      { id: "m3c", from: "customer", channel: "email", text: "Vielen Dank! Wenn fertig bitte kurze Info — würde gerne selbst abholen.", time: "10:22" },
    ]
  },
  {
    id: "demo_t4", sender: "Schmidt AG", senderCity: "Darmstadt", initials: "SA", initialsColor: "#059669",
    subject: "Bitte Angebot bestätigen", time: "Gestern", channel: "email",
    status: "open", priority: "medium", content: "Bitte Angebot bestätigen — Auftr…",
    category: "Freigabe",
    messages: [{ id: "m4a", from: "customer", channel: "email", text: "Anbei unser Angebot für die Verzinkung der 500 Rahmen. Bitte um kurze Freigabe.", time: "Gestern" }]
  },
  {
    id: "demo_t5", sender: "Schlosserei Brunner", senderCity: "Hanau", initials: "SB", initialsColor: "#92400E",
    subject: "Rechnung fehlt — A-2026-0033", time: "Gestern", channel: "phone",
    status: "open", priority: "low", content: "✓ Rechnung fehlt — A-2026-0033",
    category: "Buchhaltung",
    messages: [{ id: "m5a", from: "system", channel: "phone", text: "(Telefonnotiz) Herr Brunner hat angerufen, ihm fehlt die Rechnung zur Lieferung vom 12.05.", time: "Gestern" }]
  },
  {
    id: "demo_t6", sender: "Unbekannt (Website)", initials: "?", initialsColor: "#6B7280",
    subject: "Neue Anfrage Oldtimerteile", time: "Vorgestern", channel: "website",
    status: "new", priority: "low", content: "Anfrage: Oldtimerteile galvanisieren",
    category: "Neuanfrage",
    messages: [{ id: "m6a", from: "customer", channel: "website", text: "Hallo, verchromen Sie auch Motorradtanks? Was würde das grob kosten?", time: "Vorgestern" }]
  }
];

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR CHANNELS
   ═══════════════════════════════════════════════════════════════ */
const CHANNELS: { id: Channel; icon: React.ReactNode; label: string; isDemo?: boolean }[] = [
  { id: "all", icon: <Inbox size={22} />, label: "Alle" },
  { id: "phone", icon: <Phone size={22} />, label: "Telefon" },
  { id: "email", icon: <Mail size={22} />, label: "E-Mail", isDemo: true },
  { id: "website", icon: <Globe size={22} />, label: "Web", isDemo: true },
  { id: "reclamation", icon: <AlertOctagon size={22} />, label: "Reklamation" },
  { id: "callback", icon: <PhoneForwarded size={22} />, label: "Rückruf" },
  { id: "done", icon: <CheckSquare size={22} />, label: "Erledigt" },
  { id: "parked", icon: <Archive size={22} />, label: "Geparkt" },
];

const STATUS_MAP: Record<NoteStatus, { label: string; bg: string; fg: string }> = {
  new: { label: "Neu", bg: "#DBEAFE", fg: "#2563EB" },
  open: { label: "In Bearbeitung", bg: "#FEF3C7", fg: "#92400E" },
  waiting_callback: { label: "Wartet Rückruf", bg: "#E0E7FF", fg: "#4338CA" },
  waiting_customer: { label: "Wartet Kunde", bg: "#F3F4F6", fg: "#6B7280" },
  done: { label: "Erledigt", bg: "#D1FAE5", fg: "#059669" },
  archived: { label: "Archiviert", bg: "#F3F4F6", fg: "#9CA3AF" },
};

/* ═══════════════════════════════════════════════════════════════
   ACTION CARD BUILDER
   ═══════════════════════════════════════════════════════════════ */
interface ActionCard {
  id: string; icon: React.ReactNode; title: string; subtitle: string; color: string; href?: string;
}

function buildActions(thread: Thread, m: MatchResult | null): ActionCard[] {
  if (!m) return [];
  const a: ActionCard[] = [];
  const kw = m.matchedKeywords;
  
  if (kw.includes("Termin/Logistik"))
    a.push({ id: "cal", icon: <Calendar size={18} />, title: "Abholtermin", subtitle: m.matchedOrder ? `${m.matchedOrder.id} prüfen` : "Termin vormerken", color: "#059669" });
  if (m.matchedOrder)
    a.push({ id: "ord", icon: <FileText size={18} />, title: "Auftrag prüfen", subtitle: `${m.matchedOrder.id} · ${m.matchedOrder.statusText || m.matchedOrder.task}`, color: "#2563EB" });
  if (kw.includes("Buchhaltung/Zahlung"))
    a.push({ id: "pay", icon: <CreditCard size={18} />, title: "Zahlung prüfen", subtitle: "Zahlungsstatus nicht sicher", color: "#D97706" });
  if (thread.channel === "phone" || thread.isPhoneNote)
    a.push({ id: "call", icon: <PhoneCall size={18} />, title: "Antwort prüfen", subtitle: m.matchedCustomer ? `${m.matchedCustomer.name} anrufen` : "Direkter Textvorschlag", color: "#7C3AED" });
  if (m.matchedCustomer)
    a.push({ id: "cust", icon: <User size={18} />, title: "Kunde prüfen", subtitle: m.matchedCustomer.name, color: "#1E3A8A" });
  if (kw.includes("Reklamation"))
    a.push({ id: "rek", icon: <AlertOctagon size={18} />, title: "Reklamation", subtitle: "Qualitätsfall anlegen", color: "#DC2626" });
  if (kw.includes("Angebot") || kw.includes("E-Mail/Bilder") || m.matchedKeywords.length > 0) {
     a.push({ id: "email", icon: <Mail size={18} />, title: "E-Mail/Bilder prüfen", subtitle: "Hinweis im Chat", color: "#0891B2" });
  }

  return a;
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export function KommunikationClient() {
  const [activeChannel, setActiveChannel] = useState<Channel>("all");
  const [activeThreadId, setActiveThreadId] = useState<string | null>("demo_t3");
  const [activeTab, setActiveTab] = useState("chats");
  const [replyText, setReplyText] = useState("");
  const [replyChannel, setReplyChannel] = useState<"email" | "whatsapp" | "notiz">("email");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [recentNotes, setRecentNotes] = useState<any[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [showCockpit, setShowCockpit] = useState(true);
  const [chatFilter, setChatFilter] = useState("all");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { activeParkedCall, resumeCall } = useParkedCall();
  const [overlayConfig, setOverlayConfig] = useState<ContextAnalysisOverlayProps | null>(null);

  usePageView();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => { getRecentPhoneNotes(20).then(n => setRecentNotes(n)).catch(() => setRecentNotes([])); }, []);

  // Phone note threads from DB
  const phoneNoteThreads: Thread[] = useMemo(() => recentNotes.map(note => {
    const match = smartMatchText(note.rawText || "");
    const initials = note.callerName ? note.callerName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() : "📞";
    return {
      id: `pn_${note.id}`, sender: note.callerName || note.company || "Unbekannter Anrufer",
      initials, initialsColor: "#C2410C", subject: `Telefonnotiz · ${note.category || "Allgemein"}`,
      time: new Date(note.createdAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
      channel: "phone" as Channel, status: (note.status === "done" ? "done" : note.status === "open" ? "open" : "new") as NoteStatus,
      priority: note.urgency === "Hoch" ? "high" as const : "medium" as const,
      content: (note.rawText || "").slice(0, 55) + "…", category: note.category || "Neuanfrage",
      customerId: note.customerId || match.matchedCustomer?.id, orderId: note.orderId || match.matchedOrder?.id,
      isPhoneNote: true, rawNote: note, matchData: match,
      messages: [{ id: `pnm_${note.id}`, from: "system" as const, channel: "phone" as const, text: note.rawText || "", time: new Date(note.createdAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }), date: new Date(note.createdAt).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) }],
    };
  }), [recentNotes]);

  const allThreads = useMemo(() => [...phoneNoteThreads, ...DEMO_THREADS], [phoneNoteThreads]);
  const filteredThreads = useMemo(() => {
    let f = allThreads;
    if (activeChannel === "phone") f = f.filter(t => t.channel === "phone");
    else if (activeChannel === "email") f = f.filter(t => t.channel === "email");
    else if (activeChannel === "website") f = f.filter(t => t.channel === "website");
    else if (activeChannel === "reclamation") f = f.filter(t => t.category === "Reklamation");
    else if (activeChannel === "callback") f = f.filter(t => t.status === "waiting_callback");
    else if (activeChannel === "done") f = f.filter(t => t.status === "done" || t.status === "archived");
    else if (activeChannel === "parked") f = f.filter(t => t.status === "waiting_customer");
    
    if (chatFilter === "unresolved") f = f.filter(t => t.status === "new" || t.status === "open");
    if (chatFilter === "waiting") f = f.filter(t => t.status === "waiting_callback" || t.status === "waiting_customer");
    return f;
  }, [allThreads, activeChannel, chatFilter]);

  const activeThread = allThreads.find(t => t.id === activeThreadId);
  const matchData = useMemo(() => {
    if (!activeThread) return null;
    if (activeThread.matchData) return activeThread.matchData;
    return smartMatchText(activeThread.messages.map(m => m.text).join(" "));
  }, [activeThread]);
  const actionCards = useMemo(() => activeThread ? buildActions(activeThread, matchData) : [], [activeThread, matchData]);
  const matchedCustomer = matchData?.matchedCustomer || null;
  const customerOrders = matchedCustomer ? INITIAL_ORDERS.filter(o => o.customerId === matchedCustomer.id) : [];

  const handleStatusChange = async (s: NoteStatus) => {
    if (!activeThread?.isPhoneNote || !activeThread.rawNote) return;
    await updatePhoneNote((activeThread.rawNote as { id: string }).id, { status: s });
    const n = await getRecentPhoneNotes(20); setRecentNotes(n);
  };

  const handleActionClick = (actionId: string) => {
    if (!activeThread || !matchData) return;
    
    if (actionId === "ord") {
      setOverlayConfig({
        open: true,
        onClose: () => setOverlayConfig(null),
        type: "order",
        title: matchData.matchedOrder ? `Auftrag ${matchData.matchedOrder.id}` : "Unbekannter Auftrag",
        summary: "Status und Lieferfähigkeit im Chat-Kontext.",
        facts: [
          { label: "Kunde", value: matchData.matchedCustomer?.name || "Unbekannt", source: matchData.matchedCustomer ? "database" : "unknown" },
          { label: "Status", value: matchData.matchedOrder?.statusText || "Versandbereit", source: "database" }
        ],
        actions: [
          { label: "Auftrag vollständig öffnen", kind: "secondary", href: matchData.matchedOrder ? `/orders/${matchData.matchedOrder.id}` : "/orders" },
          { label: "Mit Chat verknüpfen", kind: "primary" }
        ]
      });
    } else if (actionId === "pay") {
      setOverlayConfig({
        open: true,
        onClose: () => setOverlayConfig(null),
        type: "payment",
        title: "Zahlungsstatus",
        summary: "Zum Auftrag wurde im Chat eine Zahlungsfrage erkannt.",
        facts: [
          { label: "Datenbankstatus", value: "Nicht sicher gefunden", source: "unknown" },
          { label: "Empfehlung", value: "Zahlung vor Abholung prüfen", source: "mock" }
        ],
        actions: [
          { label: "Zahlungsbereich öffnen", kind: "secondary", href: "/finanzen" },
          { label: "Als offene Aktion speichern", kind: "primary" }
        ]
      });
    } else if (actionId === "email") {
      setOverlayConfig({
        open: true,
        onClose: () => setOverlayConfig(null),
        type: "email",
        title: "E-Mail / Bilder zum Chat",
        summary: "Analyse der Anhänge und Korrespondenz zum aktuellen Fall.",
        facts: [
          { label: "Thema", value: "Kronleuchter", source: "chat" },
          { label: "Hinweis", value: "Bilder geschickt", source: "chat" },
          { label: "Echte Anbindung", value: "Keine E-Mail API verbunden", source: "mock" }
        ],
        actions: [
          { label: "Als Demo ansehen", kind: "primary" }
        ]
      });
    } else if (actionId === "cust") {
      setOverlayConfig({
        open: true,
        onClose: () => setOverlayConfig(null),
        type: "customer",
        title: "Kundenprofil",
        summary: "Relevante Kundendaten für diese Kommunikation.",
        facts: [
          { label: "Gefundener Name", value: matchData.matchedCustomer?.name || "Unbekannt", source: matchData.matchedCustomer ? "database" : "unknown" },
          { label: "Zuverlässigkeit", value: "Mögliche Treffer: Schmid, Schmidt", source: "unknown" }
        ],
        actions: [
          { label: "Kundenkarte öffnen", kind: "secondary", href: matchData.matchedCustomer ? `/customers/${matchData.matchedCustomer.id}` : "/customers" }
        ]
      });
    } else {
      setOverlayConfig({
        open: true,
        onClose: () => setOverlayConfig(null),
        type: "generic",
        title: "Detailanalyse",
        summary: "Kontext zum ausgewählten Stichwort.",
        facts: [
          { label: "Erkannt", value: actionId, source: "chat" }
        ],
        actions: [
          { label: "Bestätigen", kind: "primary", onClickKey: "close" }
        ]
      });
    }
  };

  const handleApplyAI = () => {
    if (matchData?.suggestedAnswer) {
      setReplyText(matchData.suggestedAnswer);
    }
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [activeThreadId, activeThread?.messages.length]);

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", fontFamily: "'Inter','Manrope',system-ui,sans-serif", color: "#1B1B1B", background: "#F5F1EB", overflow: "hidden" }} data-testid="kommunikation-root">

      {/* ─── TOP BAR ─── */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 24px", background: "#FDFBF7", borderBottom: "1px solid #E5DFD3", flexShrink: 0, gap: 12 }} data-testid="komm-topbar">
        <nav style={{ display: "flex", gap: 6, overflowX: "auto", flexShrink: 1 }}>
          {[
            { id: "chats", label: "Chats", count: filteredThreads.filter(t => t.status === "new").length },
            { id: "tagesfokus", label: "Tagesfokus", count: filteredThreads.filter(t => t.priority === "high").length },
            { id: "qualitaet", label: "Qualität" },
            { id: "vorlagen", label: "Vorlagen" },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} data-testid={`tab-${tab.id}`} style={{
              padding: "8px 16px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 500,
              background: activeTab === tab.id ? "#292119" : "transparent",
              color: activeTab === tab.id ? "#fff" : "#8B8478", cursor: "pointer", whiteSpace: "nowrap",
              display: "flex", alignItems: "center", gap: 8, transition: "all .15s",
            }}>
              {tab.label}
              {"count" in tab && (tab as { count: number }).count > 0 && (
                <span style={{ background: activeTab === tab.id ? "#C2410C" : "#E5DFD3", color: activeTab === tab.id ? "#fff" : "#292119", fontSize: 11, fontWeight: 800, borderRadius: 99, padding: "2px 8px", minWidth: 20, textAlign: "center", lineHeight: "16px" }}>
                  {(tab as { count: number }).count}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
          <button onClick={() => alert("Neue Nachricht (vorbereitet)")} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #E5DFD3", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, color: "#292119" }}>
            <Edit2 size={15} /> Neue Nachricht
          </button>
          <Link href="/telefonnotiz?source=kommunikation&returnTo=/kommunikation" style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#C2410C", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            <PhoneCall size={15} /> Anruf annehmen
          </Link>
        </div>
      </header>

      {/* ─── BODY: 4 FIXED COLUMNS ─── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* ── COL 1: ICON SIDEBAR ── */}
        {!isMobile && (
          <aside style={{ width: 76, background: "#FDFBF7", borderRight: "1px solid #E5DFD3", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, gap: 12, flexShrink: 0 }} data-testid="channel-sidebar">
            {CHANNELS.map(ch => (
              <button key={ch.id} onClick={() => setActiveChannel(ch.id)} title={ch.label + (ch.isDemo ? " (DEMO)" : "")} data-testid={`channel-${ch.id}`} style={{
                width: 48, height: 48, borderRadius: 12, border: "none", position: "relative",
                background: activeChannel === ch.id ? (ch.id === "phone" ? "#C2410C" : "#292119") : "transparent",
                color: activeChannel === ch.id ? "#fff" : "#8B8478",
                display: "grid", placeItems: "center", cursor: "pointer", transition: "all .12s",
              }}>
                {ch.icon}
                {ch.isDemo && activeChannel !== ch.id && <span style={{ position: "absolute", bottom: -4, fontSize: 8, fontWeight: 800, color: "#A09889" }}>DEMO</span>}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button title="Einstellungen" style={{ width: 48, height: 48, borderRadius: 12, border: "none", background: "transparent", color: "#A09889", display: "grid", placeItems: "center", cursor: "pointer", marginBottom: 16 }}>
              <Settings size={22} />
            </button>
          </aside>
        )}

        {/* ── COL 2: CHAT LIST ── */}
        {(!isMobile || !activeThread) && (
          <aside style={{ width: isMobile ? "100%" : 320, borderRight: "1px solid #E5DFD3", display: "flex", flexDirection: "column", background: "#FDFBF7", flexShrink: 0 }} data-testid="chat-list">
            {/* List header */}
            <div style={{ padding: "16px 20px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Fraunces',serif" }}>Alle</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button style={hdrBtn}><Search size={16} /></button>
                <button style={hdrBtn}><Plus size={16} /></button>
              </div>
            </div>
            
            {/* Parked Call Alert */}
            {activeParkedCall && (
              <div style={{ margin: "0 20px 16px", padding: "12px", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#DC2626", fontWeight: 700, fontSize: 13 }}>
                  <PhoneCall size={16} /> Offener Anruf wartet
                </div>
                <div style={{ fontSize: 12, color: "#7F1D1D" }}>
                  {activeParkedCall.matchedCustomerName || "Unbekannter Anrufer"}
                </div>
                <button onClick={resumeCall} style={{ padding: "6px 12px", background: "#DC2626", color: "white", borderRadius: 6, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", alignSelf: "flex-start" }}>
                  Fortsetzen
                </button>
              </div>
            )}

            {/* Filters */}
            <div style={{ padding: "0 20px 16px", display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                { id: "all", label: "Alle" },
                { id: "unresolved", label: `Ungelesen (${allThreads.filter(t => t.status === "new" || t.status === "open").length})` },
                { id: "waiting", label: "Wartet auf mich" },
              ].map(f => (
                <button key={f.id} onClick={() => setChatFilter(f.id)} style={{
                  padding: "4px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  border: chatFilter === f.id ? "1px solid #C2410C" : "1px solid #E5DFD3",
                  background: chatFilter === f.id ? "#FEF3C7" : "#fff",
                  color: chatFilter === f.id ? "#92400E" : "#8B8478", cursor: "pointer",
                }}>{f.label}</button>
              ))}
            </div>
            {/* Threads */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {filteredThreads.map(t => {
                const s = STATUS_MAP[t.status] || STATUS_MAP.new;
                return (
                  <div key={t.id} onClick={() => { setActiveThreadId(t.id); setShowCockpit(true); }} data-testid={`thread-${t.id}`} style={{
                    padding: "16px 20px", cursor: "pointer",
                    background: activeThreadId === t.id ? "#EDE8DD" : "transparent",
                    borderBottom: "1px solid #EDE8DD", transition: "background .1s",
                    borderLeft: t.priority === "high" ? "4px solid #DC2626" : (activeThreadId === t.id ? "4px solid #292119" : "4px solid transparent"),
                  }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, background: t.initialsColor, color: "#fff", display: "grid", placeItems: "center", fontSize: 16, fontWeight: 800 }}>{t.initials}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                          <span style={{ fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.sender.split("·")[0].trim()}</span>
                          <span style={{ fontSize: 12, color: "#A09889", whiteSpace: "nowrap", marginLeft: 8 }}>{t.time}</span>
                        </div>
                        <div style={{ fontSize: 14, color: "#7A7265", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.4 }}>
                          {t.isPhoneNote && "📞 "}{t.content}
                        </div>
                        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: s.bg, color: s.fg }}>{s.label}</span>
                          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, color: "#8B8478" }}>
                            {t.channel === "email" ? <Mail size={10} /> : t.channel === "phone" ? <Phone size={10} /> : <Globe size={10} />}
                            {t.channel.toUpperCase()}
                          </span>
                        </div>
                      </div>
                      {t.unread && t.unread > 0 ? <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#C2410C", color: "#fff", fontSize: 11, fontWeight: 800, display: "grid", placeItems: "center", flexShrink: 0 }}>{t.unread}</div> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        )}

        {/* ── COL 3: CONVERSATION ── */}
        {(!isMobile || activeThread) && (
          <section style={{ flex: 1, display: "flex", flexDirection: "column", background: "#F5F1EB", minWidth: 0, position: "relative" }} data-testid="conversation-panel">
            {activeThread ? (<>
              {/* Conv Header — FIXED */}
              <div style={{ padding: "16px 24px", borderBottom: "1px solid #E5DFD3", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, background: "#FDFBF7", zIndex: 5 }} data-testid="conv-header">
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  {isMobile && <button onClick={() => setActiveThreadId(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#8B8478" }}><ChevronLeft size={24} /></button>}
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: activeThread.initialsColor, color: "#fff", display: "grid", placeItems: "center", fontSize: 16, fontWeight: 800 }}>{activeThread.initials}</div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{activeThread.sender}{activeThread.senderCity ? ` · ${activeThread.senderCity}` : ""}</div>
                    <div style={{ fontSize: 12, color: "#A09889", marginTop: 2 }}>
                      {matchedCustomer ? `● Stammkunde · ${customerOrders.length} Aufträge` : "● Zuordnung nicht bestätigt"}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button style={hdrBtnLg}><Phone size={18} /></button>
                  <button style={hdrBtnLg}><Bell size={18} /></button>
                  <button style={hdrBtnLg}><MoreVertical size={18} /></button>
                </div>
              </div>

              {/* Chat — SCROLLABLE */}
              <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px", display: "flex", flexDirection: "column", gap: 16 }} data-testid="conv-messages">
                {activeThread.messages.map(msg => (
                  <React.Fragment key={msg.id}>
                    {msg.date && <div style={{ textAlign: "center", margin: "16px 0 8px" }}><span style={{ fontSize: 11, color: "#A09889", background: "#EDE8DD", padding: "4px 14px", borderRadius: 99, fontWeight: 600 }}>{msg.date}</span></div>}

                    {msg.from === "system" ? (
                      <div style={{ background: "#FCF0E3", borderRadius: 16, padding: "16px 20px", borderLeft: "4px solid #C2410C", maxWidth: "85%" }} data-testid="msg-system">
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#C2410C", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                          <Phone size={14} /> TELEFONNOTIZ · {msg.time}
                        </div>
                        <div style={{ fontSize: 15, lineHeight: 1.6, whiteSpace: "pre-wrap", color: "#292119" }}>
                          {msg.text.split(/(\b(?:A-\d{4}-\d{4}|morgen|Zahlungsstatus|dringend|Reklamation|abhol\w*|fertig|Rechnung|Kronleuchter)\b)/gi).map((p, j) =>
                            /A-\d{4}-\d{4}|morgen|Zahlungsstatus|dringend|Reklamation|abhol\w*|fertig|Rechnung|Kronleuchter/i.test(p)
                              ? <strong key={j} style={{ color: "#C2410C", fontWeight: 700 }}>{p}</strong> : p
                          )}
                        </div>
                        <div style={{ textAlign: "right", fontSize: 11, color: "#A09889", marginTop: 8 }}>{msg.time}</div>
                      </div>
                    ) : msg.from === "kreile" ? (
                      <div style={{ alignSelf: "flex-end", maxWidth: "75%" }} data-testid="msg-outgoing">
                        <div style={{ fontSize: 11, color: "#A09889", marginBottom: 4, display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end", fontWeight: 600 }}><Mail size={12} /> E-MAIL · KREILE</div>
                        <div style={{ background: "#fff", borderRadius: 16, padding: "14px 20px", border: "1px solid #E5DFD3", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap", color: "#292119" }}>{msg.text}</div>
                        <div style={{ textAlign: "right", fontSize: 10, color: "#A09889", marginTop: 4 }}>{msg.time} ✓</div>
                      </div>
                    ) : (
                      <div style={{ maxWidth: "75%" }} data-testid="msg-incoming">
                        <div style={{ fontSize: 11, color: "#A09889", marginBottom: 4, display: "flex", alignItems: "center", gap: 5, fontWeight: 600 }}>
                          {msg.channel === "email" ? <Mail size={12} /> : msg.channel === "whatsapp" ? <MessageSquare size={12} /> : <Globe size={12} />}
                          {msg.channel.toUpperCase()} · {activeThread.sender.split("·")[0].trim().split(" ").pop()}
                        </div>
                        <div style={{ background: "#fff", borderRadius: 16, padding: "14px 20px", border: "1px solid #E5DFD3", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap", color: "#292119" }}>{msg.text}</div>
                        <div style={{ fontSize: 10, color: "#A09889", marginTop: 4 }}>{msg.time}</div>
                      </div>
                    )}
                  </React.Fragment>
                ))}
                
                {/* Ref for auto-scrolling */}
                <div ref={chatEndRef} style={{ height: 1 }} />
                
                {/* Spacer so cockpit doesn't cover last message */}
                {actionCards.length > 0 && showCockpit && <div style={{ height: 280 }} />}
              </div>

              {/* ═══ COCKPIT OVERLAY — floats OVER the chat ═══ */}
              {actionCards.length > 0 && showCockpit && (
                <div style={{
                  position: "absolute", bottom: 180, left: 0, right: 0, margin: "0 auto", maxWidth: 780, width: "calc(100% - 48px)",
                  background: "#1A1714", borderRadius: 16, padding: "24px", color: "#EDE8DD",
                  boxShadow: "0 16px 48px rgba(0,0,0,.4), 0 0 0 1px rgba(255,255,255,.05)",
                  zIndex: 10, animation: "slideUp .3s cubic-bezier(0.16, 1, 0.3, 1)",
                }} data-testid="cockpit-overlay">
                  <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}`}</style>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Activity size={18} style={{ color: "#C2410C" }} />
                      <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".06em" }}>COCKPIT · AUTO-ANALYSE FERTIG</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 12, color: "#A09889", fontWeight: 700 }}>
                        {matchData?.matchedCustomer && matchData?.matchedOrder ? "93 % CONFIDENCE" : matchData?.matchedCustomer || matchData?.matchedOrder ? "~60 %" : "unsicher"}
                      </span>
                      <button onClick={() => setShowCockpit(false)} style={{ background: "rgba(255,255,255,.05)", border: "none", color: "#A09889", cursor: "pointer", padding: 6, borderRadius: "50%", display: "grid", placeItems: "center" }}><X size={16} /></button>
                    </div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: "#fff" }}>
                    Ich habe {actionCards.length} Aktionen vorbereitet:
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                    {actionCards.map(a => (
                      <button
                        key={a.id}
                        onClick={() => handleActionClick(a.id)}
                        style={{
                          background: "rgba(255,255,255,.04)", borderRadius: 12, padding: "12px 16px",
                          display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
                          border: "1px solid rgba(255,255,255,.06)", transition: "background .15s",
                          textAlign: "left", width: "100%", color: "#fff"
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,.08)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,.04)")}
                      >
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: a.color, color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}>{a.icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>{a.title}</div>
                          <div style={{ fontSize: 12, color: "#A09889", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{a.subtitle}</div>
                        </div>
                        <ChevronRight size={16} style={{ color: "#A09889", flexShrink: 0 }} />
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ marginTop: 20 }}>
                      <img src="/kreile_mockup_v2_bg.png" alt="" style={{ width: "100%", borderRadius: 12, border: "1px solid rgba(255,255,255,.1)" }} />
                    </div>
                    <button onClick={() => alert("Backend Aktion vorbereitet.")} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid rgba(255,255,255,.2)", background: "rgba(255,255,255,.1)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all .1s" }} onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,.15)")} onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,.1)")}>Alle {actionCards.length} anwenden</button>
                    <button style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid rgba(255,255,255,.1)", background: "transparent", color: "#EDE8DD", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Einzeln prüfen</button>
                    <button onClick={() => setShowCockpit(false)} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid rgba(255,255,255,.1)", background: "transparent", color: "#A09889", fontSize: 13, fontWeight: 600, cursor: "pointer", marginLeft: "auto" }}>Verwerfen</button>
                  </div>
                </div>
              )}

              {/* Templates + Reply — FIXED at bottom */}
              <div style={{ flexShrink: 0, borderTop: "1px solid #E5DFD3", background: "#FDFBF7", zIndex: 5 }}>
                {/* Quick actions row */}
                <div style={{ padding: "10px 24px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", borderBottom: "1px solid #EDE8DD" }} data-testid="quick-actions">
                  {matchData?.suggestedAnswer && <button onClick={handleApplyAI} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "#C2410C", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✦ KI-Antwort übernehmen</button>}
                  {["Vorlage: Abholbereit", "Vorlage: Zahlungserinnerung"].map(t => <button key={t} onClick={() => setReplyText(t + " - ")} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #E5DFD3", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#7A7265" }}>{t}</button>)}
                  <div style={{ flex: 1 }} />
                  {activeThread.isPhoneNote && (
                    <select onChange={e => e.target.value && handleStatusChange(e.target.value as NoteStatus)} defaultValue="" style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #E5DFD3", fontSize: 12, fontWeight: 600, background: "#fff", cursor: "pointer" }}>
                      <option value="" disabled>Status ändern…</option>
                      <option value="open">In Bearbeitung</option>
                      <option value="waiting_callback">Wartet Rückruf</option>
                      <option value="done">Erledigt</option>
                      <option value="archived">Archivieren</option>
                    </select>
                  )}
                </div>
                {/* Input row / Composer */}
                <div style={{ padding: "16px 24px", display: "flex", gap: 12, alignItems: "flex-end" }} data-testid="reply-bar">
                  <select value={replyChannel} onChange={e => setReplyChannel(e.target.value as typeof replyChannel)} style={{ padding: "0 14px", borderRadius: 10, border: "1px solid #E5DFD3", background: "#292119", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", height: 48, minWidth: 100 }}>
                    <option value="email">E-Mail</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="notiz">Interne Notiz</option>
                  </select>
                  <div style={{ flex: 1, display: "flex", alignItems: "flex-end", background: "#fff", borderRadius: 12, border: "1px solid #E5DFD3", padding: "4px 8px" }}>
                    <textarea 
                       value={replyText} onChange={e => setReplyText(e.target.value)} 
                       placeholder="Antwort schreiben…" 
                       style={{ flex: 1, padding: "10px 12px", minHeight: 40, maxHeight: 160, border: "none", background: "transparent", fontSize: 14, color: "#292119", outline: "none", resize: "none", fontFamily: "inherit" }} 
                    />
                    <div style={{ display: "flex", gap: 6, padding: "0 8px", marginBottom: 6 }}>
                      <button onClick={() => alert("Datei-Anhang vorbereitet. Upload-Modul wird hier geöffnet.")} title="Datei anhängen" style={iconBtn}><Paperclip size={20} /></button>
                      <button onClick={() => alert("Foto-Anhang vorbereitet. Kamera wird hier geöffnet.")} title="Foto aufnehmen/anhängen" style={iconBtn}><ImageIcon size={20} /></button>
                    </div>
                  </div>
                  <button style={{ width: 48, height: 48, borderRadius: "50%", border: "none", background: "#C2410C", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}><Send size={20} /></button>
                </div>
              </div>
            </>) : (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#A09889" }}>
                <MessageSquare size={48} style={{ opacity: .12, marginBottom: 16 }} />
                <div style={{ fontWeight: 700, fontSize: 16 }}>Keine Konversation ausgewählt</div>
                <div style={{ fontSize: 14, marginTop: 4 }}>Wähle links einen Chat.</div>
              </div>
            )}
          </section>
        )}

        {/* ── COL 4: CONTEXT PANEL — FIXED, scrollable ── */}
        {activeThread && !isMobile && (
          <aside style={{ width: 320, borderLeft: "1px solid #E5DFD3", background: "#FDFBF7", overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 20, flexShrink: 0 }} data-testid="context-panel">

            {/* Customer */}
            <div style={{ textAlign: "center", paddingBottom: 16, borderBottom: "1px solid #EDE8DD" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#A09889", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>Kunde</div>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: activeThread.initialsColor, color: "#fff", display: "grid", placeItems: "center", fontSize: 20, fontWeight: 800, margin: "0 auto 10px" }}>{activeThread.initials}</div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{matchedCustomer?.name || activeThread.sender.split("·")[0].trim()}</div>
              <div style={{ fontSize: 13, color: "#A09889", marginTop: 4 }}>{matchedCustomer ? `${activeThread.senderCity || "—"} · Kunde seit 2018` : "Keine sichere Zuordnung"}</div>
              {matchedCustomer && <Link href={`/customers/${matchedCustomer.id}`} style={{ fontSize: 13, color: "#C2410C", fontWeight: 700, textDecoration: "none", display: "inline-block", marginTop: 8 }}>Zur Kundenakte →</Link>}
              {matchedCustomer && (
                <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 16 }}>
                  <div style={{ textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 800 }}>{customerOrders.length}</div><div style={{ fontSize: 10, color: "#A09889", textTransform: "uppercase", fontWeight: 600 }}>Aufträge</div></div>
                  <div style={{ textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 800, color: "#C2410C" }}>248 €</div><div style={{ fontSize: 10, color: "#A09889", textTransform: "uppercase", fontWeight: 600 }}>Offen</div></div>
                </div>
              )}
            </div>

            {/* Orders */}
            {customerOrders.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#A09889", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>Offene Aufträge</div>
                {customerOrders.slice(0, 3).map(o => (
                  <Link key={o.id} href={`/orders/${o.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                    <div style={{ border: "1px solid #E5DFD3", borderRadius: 10, padding: "12px 14px", marginBottom: 8, background: "#fff", cursor: "pointer" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 800 }}>{o.orderNumber}</span>
                        <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 4, textTransform: "uppercase", background: o.statusText?.toLowerCase().includes("fertig") ? "#D1FAE5" : "#FEF3C7", color: o.statusText?.toLowerCase().includes("fertig") ? "#059669" : "#92400E" }}>{o.statusText || o.status}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#A09889", marginTop: 4 }}>{o.task}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Calendar */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#A09889", textTransform: "uppercase" }}>Kalender · Diese Woche</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#059669", background: "#D1FAE5", padding: "2px 6px", borderRadius: 4 }}>3 Slots frei</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6 }}>
                {[{ d: "MI", n: "3", l: "heute" }, { d: "DO", n: "4", l: "frei ✓", free: true }, { d: "FR", n: "5", l: "—" }, { d: "SA", n: "6", l: "zu" }, { d: "SO", n: "7", l: "zu" }].map(x => (
                  <div key={x.d} style={{ textAlign: "center", padding: "6px 0", borderRadius: 8, background: x.free ? "#D1FAE5" : "#F0ECE4", border: x.free ? "1px solid #059669" : "1px solid #E5DFD3" }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "#A09889" }}>{x.d}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: x.free ? "#059669" : "#292119" }}>{x.n}</div>
                    <div style={{ fontSize: 9, color: x.free ? "#059669" : "#A09889", fontWeight: 600 }}>{x.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Material */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#A09889", textTransform: "uppercase", marginBottom: 10 }}>Lager / Material</div>
              {matchData?.matchedMaterial
                ? <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ textTransform: "capitalize", fontWeight: 600 }}>{matchData.matchedMaterial}</span><span style={{ fontSize: 10, fontWeight: 800, color: "#DC2626", background: "#FEE2E2", padding: "2px 6px", borderRadius: 4 }}>Erwähnt</span></div>
                : <div style={{ fontSize: 13, color: "#A09889", fontStyle: "italic" }}>Kein Material erkannt</div>
              }
            </div>

            {/* Payment */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#A09889", textTransform: "uppercase", marginBottom: 10 }}>Zahlung</div>
              {matchData?.matchedKeywords.includes("Buchhaltung/Zahlung")
                ? <><div style={{ fontSize: 13, color: "#C2410C", fontWeight: 700 }}>Zahlung prüfen</div><Link href="/finanzen" style={{ fontSize: 12, color: "#C2410C", textDecoration: "none", marginTop: 4, display: "inline-block" }}>Im Finanzsystem klären →</Link></>
                : <div style={{ fontSize: 13, color: "#A09889", fontStyle: "italic" }}>Keine Zahlungsfrage</div>
              }
            </div>

            {/* Quick Links */}
            <div style={{ borderTop: "1px solid #EDE8DD", paddingTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#A09889", textTransform: "uppercase", marginBottom: 10 }}>Schnellzugriff</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  { href: "/warendurchlauf/wareneingang", icon: <Package size={14} />, label: "Wareneingang" },
                  { href: "/finanzen", icon: <Banknote size={14} />, label: "Buchhaltung" },
                  { href: "/kontrolle", icon: <AlertOctagon size={14} />, label: "Qualität/Reklamation" },
                ].map(l => (
                  <Link key={l.href} href={l.href} style={{ fontSize: 13, color: "#7A7265", textDecoration: "none", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, border: "1px solid #E5DFD3", background: "#fff", fontWeight: 600 }}>{l.icon} {l.label}</Link>
                ))}
              </div>
            </div>
          </aside>
        )}

        {overlayConfig && (
          <ContextAnalysisOverlay {...overlayConfig} />
        )}
      </div>
    </div>
  );
}

/* ═══ shared micro-styles ═══ */
const hdrBtn: React.CSSProperties = { width: 32, height: 32, borderRadius: 8, border: "1px solid #E5DFD3", background: "#fff", display: "grid", placeItems: "center", cursor: "pointer", color: "#A09889" };
const hdrBtnLg: React.CSSProperties = { width: 40, height: 40, borderRadius: 10, border: "1px solid #E5DFD3", background: "#fff", display: "grid", placeItems: "center", cursor: "pointer", color: "#A09889" };
const iconBtn: React.CSSProperties = { background: "transparent", border: "none", cursor: "pointer", color: "#A09889", display: "grid", placeItems: "center", padding: 4 };
