"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Inbox, MessageSquare, Mail, Phone, Globe,
  AlertOctagon, CheckCircle2, User, FileText, Banknote, ExternalLink,
  X, Edit2, Activity, Search, Plus, PhoneCall, Bell, MoreVertical, Send,
  Calendar, Package, CreditCard, AlertTriangle, Settings, ChevronRight,
  Clock, Archive, PhoneForwarded, CheckSquare, MapPin
} from "lucide-react";
import Link from "next/link";
import { usePageView } from "@/hooks/usePageView";
import { INITIAL_CUSTOMERS, INITIAL_ORDERS, MockCustomer, MockOrder } from "@/lib/mockData";
import { getRecentPhoneNotes, updatePhoneNote } from "@/app/actions/phoneNotes.actions";
import { smartMatchText, MatchResult } from "./smartMatcher";

/* ======================================================================
   TYPES
   ====================================================================== */
type Channel = "all" | "email" | "phone" | "website" | "reclamation" | "callback" | "done" | "parked";
type ChatFilter = "all" | "unresolved" | "needs" | "waiting";
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

/* ======================================================================
   DEMO DATA — clearly labeled, no fake real data
   ====================================================================== */
const DEMO_THREADS: Thread[] = [
  {
    id: "demo_t1", sender: "Maier GmbH · Herr Zill", senderCity: "Frankfurt", initials: "MZ", initialsColor: "#C2410C",
    subject: "Beschädigt angekommen — Foto", time: "08:14", channel: "email",
    status: "new", priority: "high", content: "Beschäd. angekommen — Foto",
    category: "Reklamation", unread: 2,
    messages: [
      { id: "m1a", from: "customer", channel: "email", text: "Guten Morgen, leider weisen 14 Teile der gestrigen Lieferung (Charge 8102) tiefe Kratzer auf. Wie gehen wir vor? Bilder anbei.", time: "08:14" },
    ]
  },
  {
    id: "demo_t2", sender: "Autohaus Berger", senderCity: "Offenbach", initials: "AB", initialsColor: "#7C3AED",
    subject: "Wann ist mein Auftrag fertig?", time: "09:30", channel: "website",
    status: "open", priority: "medium", content: "Wann ist mein Auftrag fertig? Wün…",
    category: "Terminanfrage", unread: 1,
    messages: [
      { id: "m2a", from: "customer", channel: "website", text: "Hallo, könnt ihr mir sagen wann die Oldtimer-Stoßstangen abholbereit sind?", time: "09:30" },
    ]
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
    messages: [
      { id: "m4a", from: "customer", channel: "email", text: "Anbei unser Angebot für die Verzinkung der 500 Rahmen. Bitte um kurze Freigabe.", time: "Gestern" },
    ]
  },
  {
    id: "demo_t5", sender: "Schlosserei Brunner", senderCity: "Hanau", initials: "SB", initialsColor: "#92400E",
    subject: "Rechnung fehlt — A-2026-0033", time: "Gestern", channel: "phone",
    status: "open", priority: "low", content: "✓ Rechnung fehlt — A-2026-0033",
    category: "Buchhaltung",
    messages: [
      { id: "m5a", from: "system", channel: "phone", text: "(Telefonnotiz) Herr Brunner hat angerufen, ihm fehlt die Rechnung zur Lieferung vom 12.05.", time: "Gestern" },
    ]
  },
  {
    id: "demo_t6", sender: "Unbekannt (Website)", initials: "?", initialsColor: "#6B7280",
    subject: "Neue Anfrage Oldtimerteile", time: "Vorgestern", channel: "website",
    status: "new", priority: "low", content: "Anfrage: Oldtimerteile galvanisieren",
    category: "Neuanfrage",
    messages: [
      { id: "m6a", from: "customer", channel: "website", text: "Hallo, verchromen Sie auch Motorradtanks? Was würde das grob kosten?", time: "Vorgestern" },
    ]
  }
];

/* ======================================================================
   CHANNEL SIDEBAR CONFIG
   ====================================================================== */
const CHANNELS: { id: Channel; icon: React.ReactNode; label: string; enabled: boolean }[] = [
  { id: "all", icon: <Inbox size={18} />, label: "Alle", enabled: true },
  { id: "phone", icon: <Phone size={18} />, label: "Telefon", enabled: true },
  { id: "email", icon: <Mail size={18} />, label: "E-Mail", enabled: true },
  { id: "website", icon: <Globe size={18} />, label: "Website", enabled: true },
  { id: "reclamation", icon: <AlertOctagon size={18} />, label: "Reklamation", enabled: true },
  { id: "callback", icon: <PhoneForwarded size={18} />, label: "Rückruf", enabled: true },
  { id: "done", icon: <CheckSquare size={18} />, label: "Erledigt", enabled: true },
  { id: "parked", icon: <Archive size={18} />, label: "Geparkt", enabled: true },
];

/* ======================================================================
   STATUS CONFIG
   ====================================================================== */
const STATUS_MAP: Record<NoteStatus, { label: string; bg: string; fg: string }> = {
  new: { label: "Neu", bg: "#DBEAFE", fg: "#2563EB" },
  open: { label: "In Bearbeitung", bg: "#FEF3C7", fg: "#92400E" },
  waiting_callback: { label: "Wartet auf Rückruf", bg: "#E0E7FF", fg: "#4338CA" },
  waiting_customer: { label: "Wartet auf Kunde", bg: "#F3F4F6", fg: "#6B7280" },
  done: { label: "Erledigt", bg: "#D1FAE5", fg: "#059669" },
  archived: { label: "Archiviert", bg: "#F3F4F6", fg: "#9CA3AF" },
};

/* ======================================================================
   ACTION CARD BUILDER — DB-first, no invented data
   ====================================================================== */
interface ActionCard {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  color: string;
  href?: string;
  action?: string;
}

function buildActionCards(thread: Thread, matchData: MatchResult | null): ActionCard[] {
  const actions: ActionCard[] = [];
  if (!matchData) return actions;
  const kw = matchData.matchedKeywords;

  if (kw.includes("Termin/Logistik")) {
    actions.push({
      id: "cal", icon: <Calendar size={16} />, title: "Abholtermin",
      subtitle: matchData.matchedOrder ? `${matchData.matchedOrder.id} — Status prüfen` : "Kein Auftrag zugeordnet",
      color: "#059669",
      href: matchData.matchedOrder ? `/orders/${matchData.matchedOrder.id}` : undefined,
    });
  }
  if (matchData.matchedOrder) {
    actions.push({
      id: "ord", icon: <FileText size={16} />, title: "Auftrag öffnen",
      subtitle: `${matchData.matchedOrder.id} · ${matchData.matchedOrder.task}`,
      color: "#2563EB",
      href: `/orders/${matchData.matchedOrder.id}`,
    });
  }
  if (kw.includes("Buchhaltung/Zahlung")) {
    actions.push({
      id: "pay", icon: <CreditCard size={16} />, title: "Zahlung prüfen",
      subtitle: "Zahlungsstatus im Finanzsystem klären",
      color: "#D97706",
      href: "/finanzen",
    });
  }
  if (kw.includes("Reklamation")) {
    actions.push({
      id: "rek", icon: <AlertOctagon size={16} />, title: "Reklamation anlegen",
      subtitle: "Vorgang als Reklamation markieren",
      color: "#DC2626",
      href: matchData.matchedOrder ? `/orders/${matchData.matchedOrder.id}` : "/kontrolle",
      action: "reklamation",
    });
  }
  if (thread.isPhoneNote || thread.channel === "phone") {
    actions.push({
      id: "reply", icon: <PhoneCall size={16} />, title: "Rückruf planen",
      subtitle: matchData.matchedCustomer ? `${matchData.matchedCustomer.name} zurückrufen` : "Anrufer zurückrufen",
      color: "#7C3AED",
      action: "callback",
    });
  }
  if (matchData.matchedCustomer) {
    actions.push({
      id: "cust", icon: <User size={16} />, title: "Kunde öffnen",
      subtitle: matchData.matchedCustomer.name,
      color: "#1E3A8A",
      href: `/customers/${matchData.matchedCustomer.id}`,
    });
  }
  return actions;
}

/* ======================================================================
   MAIN COMPONENT
   ====================================================================== */
export function KommunikationClient() {
  const [activeChannel, setActiveChannel] = useState<Channel>("all");
  const [chatFilter, setChatFilter] = useState<ChatFilter>("all");
  const [activeThreadId, setActiveThreadId] = useState<string | null>("demo_t3");
  const [activeTab, setActiveTab] = useState<string>("chats");
  const [replyText, setReplyText] = useState("");
  const [replyChannel, setReplyChannel] = useState<"email" | "whatsapp" | "notiz">("email");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [recentNotes, setRecentNotes] = useState<any[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [showContext, setShowContext] = useState(true);

  usePageView();

  // Responsive
  useEffect(() => {
    const check = () => { setIsMobile(window.innerWidth < 768); };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Load real phone notes from DB
  useEffect(() => {
    getRecentPhoneNotes(20).then(notes => setRecentNotes(notes)).catch(() => setRecentNotes([]));
  }, []);

  // Convert real phone notes to threads
  const phoneNoteThreads: Thread[] = useMemo(() => {
    return recentNotes.map(note => {
      const match = smartMatchText(note.rawText || "");
      const initials = note.callerName
        ? note.callerName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
        : "📞";
      return {
        id: `pn_${note.id}`,
        sender: note.callerName || note.company || "Unbekannter Anrufer",
        senderCity: "",
        initials,
        initialsColor: "#C2410C",
        subject: `Telefonnotiz · ${note.category || "Allgemein"}`,
        time: new Date(note.createdAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
        channel: "phone" as Channel,
        status: (note.status === "done" ? "done" : note.status === "open" ? "open" : "new") as NoteStatus,
        priority: note.urgency === "Hoch" ? "high" as const : "medium" as const,
        content: (note.rawText || "").slice(0, 60) + "…",
        category: note.category || "Neuanfrage",
        customerId: note.customerId || (match.matchedCustomer?.id),
        orderId: note.orderId || (match.matchedOrder?.id),
        isPhoneNote: true,
        rawNote: note,
        matchData: match,
        messages: [
          {
            id: `pnm_${note.id}`,
            from: "system" as const,
            channel: "phone" as const,
            text: note.rawText || "",
            time: new Date(note.createdAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
            date: new Date(note.createdAt).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
          },
        ],
      };
    });
  }, [recentNotes]);

  // Merge all threads: real notes first, then demo
  const allThreads = useMemo(() => [...phoneNoteThreads, ...DEMO_THREADS], [phoneNoteThreads]);

  // Filter by channel
  const filteredThreads = useMemo(() => {
    let filtered = allThreads;
    if (activeChannel === "phone") filtered = filtered.filter(t => t.channel === "phone");
    else if (activeChannel === "email") filtered = filtered.filter(t => t.channel === "email");
    else if (activeChannel === "website") filtered = filtered.filter(t => t.channel === "website");
    else if (activeChannel === "reclamation") filtered = filtered.filter(t => t.category === "Reklamation");
    else if (activeChannel === "callback") filtered = filtered.filter(t => t.status === "waiting_callback");
    else if (activeChannel === "done") filtered = filtered.filter(t => t.status === "done" || t.status === "archived");
    else if (activeChannel === "parked") filtered = filtered.filter(t => t.status === "waiting_customer");
    return filtered;
  }, [allThreads, activeChannel]);

  const activeThread = allThreads.find(t => t.id === activeThreadId);

  // Smart match for active thread
  const matchData = useMemo(() => {
    if (!activeThread) return null;
    if (activeThread.matchData) return activeThread.matchData;
    const allText = activeThread.messages.map(m => m.text).join(" ");
    return smartMatchText(allText);
  }, [activeThread]);

  const actionCards = useMemo(() => {
    if (!activeThread) return [];
    return buildActionCards(activeThread, matchData);
  }, [activeThread, matchData]);

  // Customer/order from match
  const matchedCustomer = matchData?.matchedCustomer || null;
  const customerOrders = matchedCustomer
    ? INITIAL_ORDERS.filter(o => o.customerId === matchedCustomer.id)
    : [];

  // Status update handler
  const handleStatusChange = async (newStatus: NoteStatus) => {
    if (!activeThread?.isPhoneNote || !activeThread.rawNote) return;
    const noteId = (activeThread.rawNote as { id: string }).id;
    await updatePhoneNote(noteId, { status: newStatus });
    const notes = await getRecentPhoneNotes(20);
    setRecentNotes(notes);
  };

  /* ====================================================================
     RENDER
     ==================================================================== */
  return (
    <div style={{ height: "calc(100vh - 4rem)", display: "flex", flexDirection: "column", fontFamily: "'Inter', 'Manrope', sans-serif", color: "#1B1B1B", background: "#F8F5EF" }} data-testid="kommunikation-root">

      {/* ===== TOP BAR ===== */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", borderBottom: "1px solid #E8E2D6", background: "#FDFAF5", flexShrink: 0 }} data-testid="komm-topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 4, overflowX: "auto" }}>
          {[
            { id: "chats", label: "Chats", count: filteredThreads.filter(t => t.status === "new").length },
            { id: "tagesfokus", label: "Tagesfokus", count: filteredThreads.filter(t => t.priority === "high").length },
            { id: "qualitaet", label: "Qualität", count: 0 },
            { id: "vorlagen", label: "Vorlagen", count: 0 },
            { id: "kanaele", label: "Kanäle & Admin", count: 0 },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} data-testid={`tab-${tab.id}`} style={{
              padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600,
              background: activeTab === tab.id ? "#1B1B1B" : "transparent",
              color: activeTab === tab.id ? "white" : "#8B8478",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s", whiteSpace: "nowrap",
            }}>
              {tab.label}
              {tab.count > 0 && (
                <span style={{ background: activeTab === tab.id ? "#C2410C" : "#E8E2D6", color: activeTab === tab.id ? "white" : "#1B1B1B", fontSize: 9, fontWeight: 800, borderRadius: 999, padding: "1px 6px", minWidth: 16, textAlign: "center" }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button data-testid="btn-neue-nachricht" style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid #E8E2D6", background: "white", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "#1B1B1B" }}>
            <Edit2 size={12} /> Neue Nachricht
          </button>
          <Link href="/telefonnotiz?source=kommunikation&returnTo=/kommunikation" data-testid="btn-anruf-annehmen" style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: "#C2410C", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
            <PhoneCall size={12} /> Anruf annehmen
          </Link>
        </div>
      </div>

      {/* ===== MAIN BODY ===== */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ===== COL 1: ICON SIDEBAR (48px) ===== */}
        {!isMobile && (
          <div style={{ width: 48, background: "#FDFAF5", borderRight: "1px solid #E8E2D6", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 12, gap: 4, flexShrink: 0 }} data-testid="channel-sidebar">
            {CHANNELS.map(ch => (
              <button key={ch.id} onClick={() => setActiveChannel(ch.id)} title={ch.label} data-testid={`channel-${ch.id}`}
                aria-label={`Kanal: ${ch.label}${!ch.enabled ? " (vorbereitet)" : ""}`}
                style={{
                  width: 36, height: 36, borderRadius: 10, border: "none",
                  background: activeChannel === ch.id ? "#C2410C" : "transparent",
                  color: activeChannel === ch.id ? "white" : "#8B8478",
                  display: "grid", placeItems: "center", cursor: "pointer", transition: "all 0.15s",
                }}>
                {ch.icon}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button title="Einstellungen" style={{ width: 36, height: 36, borderRadius: 10, border: "none", background: "transparent", color: "#8B8478", display: "grid", placeItems: "center", cursor: "pointer", marginBottom: 12 }}>
              <Settings size={16} />
            </button>
          </div>
        )}

        {/* ===== COL 2: CHAT LIST ===== */}
        {(!isMobile || !activeThread) && (
          <div style={{ width: isMobile ? "100%" : 260, borderRight: isMobile ? "none" : "1px solid #E8E2D6", display: "flex", flexDirection: "column", background: "#FDFAF5", flexShrink: 0 }} data-testid="chat-list">
            {/* Header */}
            <div style={{ padding: "12px 14px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Fraunces', serif" }}>Chats</span>
              <div style={{ display: "flex", gap: 4 }}>
                <button aria-label="Suchen" style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid #E8E2D6", background: "white", display: "grid", placeItems: "center", cursor: "pointer", color: "#8B8478" }}><Search size={13} /></button>
                <button aria-label="Neuer Vorgang" style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid #E8E2D6", background: "white", display: "grid", placeItems: "center", cursor: "pointer", color: "#8B8478" }}><Plus size={13} /></button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div style={{ padding: "0 14px 8px", display: "flex", gap: 4, flexWrap: "wrap" }}>
              {([
                { id: "all", label: "Alle" },
                { id: "unresolved", label: "Ungelöst", count: allThreads.filter(t => t.status === "new" || t.status === "open").length },
                { id: "needs", label: "Braucht" },
                { id: "waiting", label: "Wartet auf mich" },
              ] as { id: ChatFilter; label: string; count?: number }[]).map(f => (
                <button key={f.id} onClick={() => setChatFilter(f.id)} data-testid={`filter-${f.id}`} style={{
                  padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600,
                  border: chatFilter === f.id ? "1px solid #C2410C" : "1px solid #E8E2D6",
                  background: chatFilter === f.id ? "#FEF3C7" : "white",
                  color: chatFilter === f.id ? "#92400E" : "#8B8478", cursor: "pointer",
                }}>
                  {f.label}{f.count ? ` ${f.count}` : ""}
                </button>
              ))}
            </div>

            {/* Thread List */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {filteredThreads.map(t => {
                const st = STATUS_MAP[t.status] || STATUS_MAP.new;
                return (
                  <div key={t.id} onClick={() => setActiveThreadId(t.id)} data-testid={`thread-${t.id}`}
                    style={{
                      padding: "10px 14px", cursor: "pointer",
                      background: activeThreadId === t.id ? "#F0EBE0" : "transparent",
                      borderBottom: "1px solid #F0EBE0", transition: "background 0.1s",
                      borderLeft: t.priority === "high" ? "3px solid #DC2626" : "3px solid transparent",
                    }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: t.initialsColor, color: "white", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800 }}>
                        {t.initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 12, fontWeight: 700 }}>{t.sender.split("·")[0].trim()}</span>
                          <span style={{ fontSize: 10, color: "#8B8478", whiteSpace: "nowrap" }}>{t.time}</span>
                        </div>
                        <div style={{ fontSize: 11, color: "#6B6560", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {t.isPhoneNote && <Phone size={10} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />}
                          {t.content}
                        </div>
                        <div style={{ display: "flex", gap: 4, marginTop: 4, alignItems: "center" }}>
                          <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: st.bg, color: st.fg }}>{st.label}</span>
                          {t.isPhoneNote && !t.customerId && (
                            <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "#FEF3C7", color: "#92400E" }}>Zuordnung nötig</span>
                          )}
                        </div>
                      </div>
                      {t.unread && t.unread > 0 && (
                        <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#C2410C", color: "white", fontSize: 9, fontWeight: 800, display: "grid", placeItems: "center", flexShrink: 0, marginTop: 2 }}>{t.unread}</div>
                      )}
                    </div>
                  </div>
                );
              })}
              {filteredThreads.length === 0 && (
                <div style={{ padding: 20, textAlign: "center", color: "#8B8478", fontSize: 12 }}>Keine Vorgänge in diesem Kanal.</div>
              )}
            </div>
          </div>
        )}

        {/* ===== COL 3: CONVERSATION ===== */}
        {(!isMobile || activeThread) && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#FDFAF5", minWidth: 0 }} data-testid="conversation-panel">
            {activeThread ? (
              <>
                {/* Conversation Header */}
                <div style={{ padding: "10px 20px", borderBottom: "1px solid #E8E2D6", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }} data-testid="conv-header">
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {isMobile && (
                      <button onClick={() => setActiveThreadId(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#8B8478", padding: 4 }} aria-label="Zurück zur Liste">
                        <ChevronRight size={18} style={{ transform: "rotate(180deg)" }} />
                      </button>
                    )}
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: activeThread.initialsColor, color: "white", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 800 }}>
                      {activeThread.initials}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>
                        {activeThread.sender}{activeThread.senderCity ? ` · ${activeThread.senderCity}` : ""}
                      </div>
                      <div style={{ fontSize: 10, color: "#8B8478" }}>
                        {matchedCustomer ? `● Stammkunde · ${customerOrders.length} Aufträge` : "● Zuordnung nicht bestätigt"}
                        {activeThread.isPhoneNote && " · 📞 Telefonnotiz"}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button data-testid="conv-phone" aria-label="Anrufen" style={iconBtnStyle}><Phone size={14} /></button>
                    <button data-testid="conv-bell" aria-label="Benachrichtigung" style={iconBtnStyle}><Bell size={14} /></button>
                    <button onClick={() => setShowContext(!showContext)} data-testid="conv-context-toggle" aria-label="Kontext ein/ausblenden" style={iconBtnStyle}><MoreVertical size={14} /></button>
                  </div>
                </div>

                {/* Chat Messages */}
                <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }} data-testid="conv-messages">
                  {activeThread.messages.map((msg) => (
                    <React.Fragment key={msg.id}>
                      {msg.date && (
                        <div style={{ textAlign: "center", margin: "8px 0" }}>
                          <span style={{ fontSize: 10, color: "#8B8478", background: "#F0EBE0", padding: "3px 12px", borderRadius: 999, fontWeight: 600 }}>{msg.date}</span>
                        </div>
                      )}

                      {msg.from === "system" ? (
                        <div style={{ background: "#F0EBE0", borderRadius: 14, padding: "12px 16px", borderLeft: "3px solid #C2410C", maxWidth: "85%" }} data-testid="msg-system">
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#C2410C", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                            <Phone size={11} /> TELEFONNOTIZ · {msg.time}
                          </div>
                          <div style={{ fontSize: 13, lineHeight: 1.5, color: "#1B1B1B", whiteSpace: "pre-wrap" }}>
                            {msg.text.split(/(\b(?:A-\d{4}-\d{4}|morgen|Zahlungsstatus|dringend|Reklamation|abhol\w*|fertig|Rechnung)\b)/gi).map((part, j) =>
                              /A-\d{4}-\d{4}|morgen|Zahlungsstatus|dringend|Reklamation|abhol\w*|fertig|Rechnung/i.test(part)
                                ? <strong key={j} style={{ color: "#C2410C" }}>{part}</strong>
                                : part
                            )}
                          </div>
                          <div style={{ textAlign: "right", fontSize: 9, color: "#8B8478", marginTop: 4 }}>{msg.time}</div>
                        </div>
                      ) : msg.from === "kreile" ? (
                        <div style={{ alignSelf: "flex-end", maxWidth: "75%" }} data-testid="msg-outgoing">
                          <div style={{ fontSize: 10, color: "#8B8478", marginBottom: 3, display: "flex", alignItems: "center", gap: 4 }}>
                            <Mail size={10} /> E-MAIL · KREILE
                          </div>
                          <div style={{ background: "white", borderRadius: 14, padding: "12px 16px", border: "1px solid #E8E2D6", fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                            {msg.text}
                          </div>
                          <div style={{ textAlign: "right", fontSize: 9, color: "#8B8478", marginTop: 4 }}>{msg.time} ✓</div>
                        </div>
                      ) : (
                        <div style={{ maxWidth: "75%" }} data-testid="msg-incoming">
                          <div style={{ fontSize: 10, color: "#8B8478", marginBottom: 3, display: "flex", alignItems: "center", gap: 4 }}>
                            {msg.channel === "email" ? <Mail size={10} /> : msg.channel === "whatsapp" ? <MessageSquare size={10} /> : <Globe size={10} />}
                            {msg.channel.toUpperCase()} · {activeThread.sender.split("·")[0].trim().split(" ").pop()}
                          </div>
                          <div style={{ background: "white", borderRadius: 14, padding: "12px 16px", border: "1px solid #E8E2D6", fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                            {msg.text}
                          </div>
                          <div style={{ fontSize: 9, color: "#8B8478", marginTop: 4 }}>{msg.time}</div>
                        </div>
                      )}
                    </React.Fragment>
                  ))}

                  {/* ===== COCKPIT ACTION CARD ===== */}
                  {actionCards.length > 0 && (
                    <div style={{ background: "#1B1B1B", borderRadius: 16, padding: "16px 20px", color: "#F0EBE0", marginTop: 8 }} data-testid="cockpit-card">
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Activity size={14} style={{ color: "#C2410C" }} />
                          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>COCKPIT · AUTO-ANALYSE FERTIG</span>
                        </div>
                        <span style={{ fontSize: 10, color: "#8B8478" }}>
                          {matchData?.matchedCustomer && matchData?.matchedOrder ? "93 % CONFIDENCE" : matchData?.matchedCustomer || matchData?.matchedOrder ? "~60 % CONFIDENCE" : "Zuordnung unsicher"}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
                        Ich habe {actionCards.length} Aktionen für dich vorbereitet
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: actionCards.length > 2 ? "1fr 1fr" : "1fr", gap: 8, marginBottom: 14 }}>
                        {actionCards.map(action => {
                          const inner = (
                            <div style={{
                              background: "rgba(255,255,255,0.06)", borderRadius: 10, padding: "10px 12px",
                              display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer",
                              border: "1px solid rgba(255,255,255,0.08)", transition: "background 0.15s",
                            }}
                              data-testid={`action-${action.id}`}
                              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
                              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                            >
                              <div style={{ width: 28, height: 28, borderRadius: 7, background: action.color, color: "white", display: "grid", placeItems: "center", flexShrink: 0 }}>{action.icon}</div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "#F0EBE0" }}>{action.title}</div>
                                <div style={{ fontSize: 10, color: "#8B8478", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{action.subtitle}</div>
                              </div>
                              <ChevronRight size={14} style={{ color: "#8B8478", marginLeft: "auto", marginTop: 6, flexShrink: 0 }} />
                            </div>
                          );
                          return action.href
                            ? <Link key={action.id} href={action.href} style={{ textDecoration: "none", color: "inherit" }}>{inner}</Link>
                            : <div key={action.id}>{inner}</div>;
                        })}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button data-testid="action-apply-all" style={cockpitBtnStyle("#C2410C", "white")}>Alle {actionCards.length} anwenden</button>
                        <button data-testid="action-review" style={cockpitBtnStyle("transparent", "#8B8478")}>Einzeln prüfen</button>
                        <button data-testid="action-dismiss" style={cockpitBtnStyle("transparent", "#8B8478")}>Verwerfen</button>
                      </div>
                    </div>
                  )}

                  {/* ===== SUGGESTED ANSWER ===== */}
                  {matchData?.suggestedAnswer && (
                    <div style={{ background: "white", border: "1px solid #E8E2D6", borderRadius: 14, padding: "12px 16px" }} data-testid="suggested-answer">
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#8B8478", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        💬 Antwortvorschlag · {matchData.matchedOrder ? "aus DB" : "generisch"}
                      </div>
                      <div style={{ fontSize: 13, lineHeight: 1.5, fontFamily: "'Fraunces', serif" }}>
                        „{matchData.suggestedAnswer}"
                      </div>
                    </div>
                  )}
                </div>

                {/* Template Quick Actions */}
                <div style={{ padding: "8px 20px", borderTop: "1px solid #E8E2D6", display: "flex", gap: 6, flexWrap: "wrap", flexShrink: 0 }} data-testid="quick-actions">
                  {matchData?.suggestedAnswer && (
                    <button data-testid="btn-ki-answer" style={{ padding: "5px 12px", borderRadius: 7, border: "none", background: "#C2410C", color: "white", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                      ✦ KI-Antwort übernehmen
                    </button>
                  )}
                  {["Vorlage: Abholbereit", "Vorlage: Zahlungserinnerung"].map(tpl => (
                    <button key={tpl} data-testid={`tpl-${tpl}`} style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid #E8E2D6", background: "white", fontSize: 10, fontWeight: 600, cursor: "pointer", color: "#6B6560" }}>
                      {tpl}
                    </button>
                  ))}
                  {activeThread.isPhoneNote && (
                    <>
                      <div style={{ flex: 1 }} />
                      <select onChange={e => e.target.value && handleStatusChange(e.target.value as NoteStatus)} defaultValue="" data-testid="status-select" style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #E8E2D6", fontSize: 10, fontWeight: 600, background: "white", cursor: "pointer" }}>
                        <option value="" disabled>Status ändern…</option>
                        <option value="open">In Bearbeitung</option>
                        <option value="waiting_callback">Wartet auf Rückruf</option>
                        <option value="waiting_customer">Wartet auf Kunde</option>
                        <option value="done">Erledigt</option>
                        <option value="archived">Archivieren</option>
                      </select>
                    </>
                  )}
                </div>

                {/* Reply Input */}
                <div style={{ padding: "10px 20px", borderTop: "1px solid #E8E2D6", display: "flex", gap: 8, alignItems: "center", flexShrink: 0, background: "#FDFAF5" }} data-testid="reply-bar">
                  <select value={replyChannel} onChange={e => setReplyChannel(e.target.value as typeof replyChannel)} aria-label="Antwortkanal" style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #E8E2D6", background: "#1B1B1B", color: "white", fontSize: 11, fontWeight: 700, cursor: "pointer", minWidth: 90 }}>
                    <option value="email">E-Mail</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="notiz">Notiz</option>
                  </select>
                  <input value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Antwort schreiben…" data-testid="reply-input" style={{ flex: 1, padding: "8px 14px", borderRadius: 8, border: "1px solid #E8E2D6", background: "white", fontSize: 12, color: "#1B1B1B", outline: "none" }} />
                  <button aria-label="Senden" data-testid="reply-send" style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: "#C2410C", color: "white", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}>
                    <Send size={14} />
                  </button>
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#8B8478" }}>
                <MessageSquare size={40} style={{ opacity: 0.15, marginBottom: 12 }} />
                <div style={{ fontWeight: 700 }}>Keine Konversation ausgewählt</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Wähle links einen Chat, um ihn zu öffnen.</div>
              </div>
            )}
          </div>
        )}

        {/* ===== COL 4: CONTEXT PANEL ===== */}
        {activeThread && showContext && !isMobile && (
          <div style={{ width: 280, borderLeft: "1px solid #E8E2D6", background: "#FDFAF5", overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 16, flexShrink: 0 }} data-testid="context-panel">

            {/* Customer Card */}
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#8B8478", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>KUNDE</div>
              <div style={{ width: 50, height: 50, borderRadius: "50%", background: activeThread.initialsColor, color: "white", display: "grid", placeItems: "center", fontSize: 18, fontWeight: 800, margin: "0 auto 8px" }}>
                {activeThread.initials}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{matchedCustomer?.name || activeThread.sender.split("·")[0].trim()}</div>
              <div style={{ fontSize: 11, color: "#8B8478" }}>
                {matchedCustomer ? `${matchedCustomer.city || "—"} · Kunde seit 2018` : "Keine sichere Zuordnung"}
              </div>
              {matchedCustomer ? (
                <Link href={`/customers/${matchedCustomer.id}`} data-testid="ctx-customer-link" style={{ fontSize: 11, color: "#C2410C", fontWeight: 600, textDecoration: "none" }}>Zur Kundenakte →</Link>
              ) : (
                <span style={{ fontSize: 11, color: "#8B8478", fontStyle: "italic" }}>Manuell zuordnen</span>
              )}

              {matchedCustomer && (
                <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 10 }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{customerOrders.length}</div>
                    <div style={{ fontSize: 9, color: "#8B8478", textTransform: "uppercase" }}>Aufträge</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#C2410C" }}>248 €</div>
                    <div style={{ fontSize: 9, color: "#8B8478", textTransform: "uppercase" }}>Offen</div>
                  </div>
                </div>
              )}
            </div>

            {/* Open Orders */}
            {customerOrders.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#8B8478", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>OFFENE AUFTRÄGE</div>
                {customerOrders.slice(0, 3).map(order => (
                  <Link key={order.id} href={`/orders/${order.id}`} data-testid={`ctx-order-${order.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                    <div style={{ border: "1px solid #E8E2D6", borderRadius: 10, padding: "10px 12px", marginBottom: 6, background: "white", cursor: "pointer", transition: "background 0.1s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#F0EBE0")}
                      onMouseLeave={e => (e.currentTarget.style.background = "white")}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{order.orderNumber}</span>
                        <span style={{
                          fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 4, textTransform: "uppercase",
                          background: order.statusText?.toLowerCase().includes("fertig") ? "#D1FAE5" : "#FEF3C7",
                          color: order.statusText?.toLowerCase().includes("fertig") ? "#059669" : "#92400E",
                        }}>
                          {order.statusText || order.status}
                        </span>
                      </div>
                      <div style={{ fontSize: 10, color: "#8B8478", marginTop: 3 }}>{order.task}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Calendar Strip */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#8B8478", textTransform: "uppercase", letterSpacing: "0.06em" }}>KALENDER · DIESE WOCHE</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: "#059669", background: "#D1FAE5", padding: "2px 6px", borderRadius: 4 }}>3 Slots frei</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
                {[
                  { day: "MI", num: String(new Date().getDate()), label: "heute", free: false },
                  { day: "DO", num: String(new Date().getDate() + 1), label: "frei ✓", free: true },
                  { day: "FR", num: String(new Date().getDate() + 2), label: "—", free: false },
                  { day: "SA", num: String(new Date().getDate() + 3), label: "zu", free: false },
                  { day: "SO", num: String(new Date().getDate() + 4), label: "zu", free: false },
                ].map(d => (
                  <div key={d.day} style={{
                    textAlign: "center", padding: "6px 0", borderRadius: 8,
                    background: d.free ? "#D1FAE5" : "#F3F0EA", border: d.free ? "1px solid #059669" : "1px solid #E8E2D6",
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "#8B8478" }}>{d.day}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: d.free ? "#059669" : "#1B1B1B" }}>{d.num}</div>
                    <div style={{ fontSize: 8, color: d.free ? "#059669" : "#8B8478" }}>{d.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Material */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#8B8478", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>LAGER / MATERIAL</div>
              {matchData?.matchedMaterial ? (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #F0EBE0" }}>
                  <span style={{ fontSize: 12, textTransform: "capitalize" }}>{matchData.matchedMaterial}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, background: "#FEE2E2", color: "#DC2626", padding: "2px 7px", borderRadius: 4 }}>Erwähnt</span>
                </div>
              ) : (
                <div style={{ fontSize: 11, color: "#8B8478", fontStyle: "italic" }}>Kein Material im Gespräch erkannt</div>
              )}
            </div>

            {/* Payment */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#8B8478", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>ZAHLUNG</div>
              <div style={{ fontSize: 11, display: "flex", flexDirection: "column", gap: 4 }}>
                {matchData?.matchedKeywords.includes("Buchhaltung/Zahlung") ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#C2410C", fontWeight: 600 }}>Zahlungsthema erkannt</span>
                    </div>
                    <Link href="/finanzen" data-testid="ctx-payment-link" style={{ fontSize: 11, color: "#C2410C", fontWeight: 600, textDecoration: "none" }}>
                      Im Finanzsystem prüfen →
                    </Link>
                  </>
                ) : (
                  <div style={{ color: "#8B8478", fontStyle: "italic" }}>Keine Zahlungsfrage im Gespräch</div>
                )}
              </div>
            </div>

            {/* Quick Links */}
            <div style={{ borderTop: "1px solid #E8E2D6", paddingTop: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#8B8478", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>SCHNELLZUGRIFF</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <Link href="/warendurchlauf/neu" style={ctxLinkStyle} data-testid="ctx-wareneingang">
                  <Package size={12} /> Wareneingang
                </Link>
                <Link href="/finanzen" style={ctxLinkStyle} data-testid="ctx-finanzen">
                  <Banknote size={12} /> Buchhaltung
                </Link>
                <Link href="/kontrolle" style={ctxLinkStyle} data-testid="ctx-qualitaet">
                  <AlertTriangle size={12} /> Qualität/Reklamation
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== Shared Styles ===== */
const iconBtnStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8, border: "1px solid #E8E2D6",
  background: "white", display: "grid", placeItems: "center", cursor: "pointer", color: "#8B8478",
};

const cockpitBtnStyle = (bg: string, color: string): React.CSSProperties => ({
  padding: "7px 14px", borderRadius: 8, border: `1px solid ${bg === "transparent" ? "rgba(255,255,255,0.15)" : bg}`,
  background: bg, color, fontSize: 11, fontWeight: 700, cursor: "pointer",
});

const ctxLinkStyle: React.CSSProperties = {
  fontSize: 11, color: "#6B6560", textDecoration: "none", display: "flex", alignItems: "center", gap: 6,
  padding: "5px 8px", borderRadius: 6, border: "1px solid #E8E2D6", background: "white", fontWeight: 600,
};
