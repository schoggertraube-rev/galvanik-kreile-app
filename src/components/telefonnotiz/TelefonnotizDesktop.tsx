"use client";
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Phone, Edit2, Mic, MicOff, X, Check, ChevronRight, Clock, Zap, AlertTriangle, Package, CreditCard, Calendar, User, FileText, Activity, ArrowLeft, Mail, Image as ImageIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePhoneNoteAnalysis, AnalysisResult } from "@/hooks/usePhoneNoteAnalysis";
import { useLiveContext } from "@/hooks/useLiveContext";
import { useAutosaveDraft } from "@/hooks/useAutosaveDraft";
import { createPhoneNote } from "@/app/actions/phoneNotes.actions";
import { useParkedCall } from "@/contexts/ParkedCallContext";
import { useErfassung } from "@/components/erfassung/ErfassungProvider";

/* ===== Step definitions ===== */
const STEPS = [
  { id: 1, label: "Erfassen" },
  { id: 2, label: "Auswerten" },
  { id: 3, label: "Prüfen" },
  { id: 4, label: "Verteilen" },
];

/* ===== Mirror Highlight Helper ===== */
function buildHighlightedHtml(text: string, highlights: AnalysisResult["highlights"]): string {
  if (!text || highlights.length === 0) return escapeHtml(text);
  const sorted = [...highlights].sort((a, b) => b.word.length - a.word.length);
  let result = text;
  for (const h of sorted) {
    const escaped = h.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    result = result.replace(regex, `<mark class="${h.type}">$1</mark>`);
  }
  return result;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ===== MAIN COMPONENT ===== */
export function TelefonnotizDesktop() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openErfassung } = useErfassung();
  const source = searchParams.get("source") || "home";
  const returnTo = searchParams.get("returnTo");

  // Compute return path
  const returnPath = useMemo(() => {
    if (returnTo) return returnTo;
    if (source === "kommunikation") return "/kommunikation";
    if (source === "warendurchlauf") return "/warendurchlauf/wareneingang";
    return "/";
  }, [returnTo, source]);

  const returnLabel = useMemo(() => {
    if (returnPath.includes("wareneingang")) return "Zurück zum Wareneingang";
    if (returnPath.includes("kommunikation")) return "Zurück zur Kommunikation";
    return "Zurück";
  }, [returnPath]);

  const showReturnOrb = !!returnTo || source === "warendurchlauf";

  // State
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"type" | "voice">("type");
  const [step, setStep] = useState(1);
  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [, setIsSaving] = useState(false);
  const [showUndo, setShowUndo] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [reminderTime, setReminderTime] = useState("Heute 17:00");
  const [showEmailMock, setShowEmailMock] = useState(false);
  
  // Marketing Source State
  const [quelleTyp, setQuelleTyp] = useState("weiß nicht");

  // Parked Call Global State
  const { parkCall } = useParkedCall();

  // Disambiguation state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [forceAI, setForceAI] = useState(false);
  
  // Saved Note State
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);

  // ===== SPEECH RECOGNITION (Stable) =====
  const [recordingWanted, setRecordingWanted] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [speechSupported] = useState(() => {
    if (typeof window === "undefined") return false;
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  });
  const recordingWantedRef = useRef(false);
  const recognitionRef = useRef<any>(null);

  function startRecognitionSafely() {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.start();
      setSpeechError(null);
    } catch (err) {
      console.error("Failed to start recognition:", err);
      // Already running — ignore
    }
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        return;
      }
      
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "de-DE";

      recognition.onresult = (event: any) => {
        let finalTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setText(prev => prev + (prev.endsWith(" ") || prev === "" ? "" : " ") + finalTranscript);
        }
      };

      recognition.onend = () => {
        // Auto-restart if user still wants to record
        if (recordingWantedRef.current) {
          setTimeout(() => {
            if (recordingWantedRef.current) {
              startRecognitionSafely();
            }
          }, 350);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === "not-allowed" || event.error === "audio-capture") {
          recordingWantedRef.current = false;
          setRecordingWanted(false);
          setSpeechError("Mikrofon nicht verfügbar — bitte tippen");
        } else if (event.error === "no-speech") {
          // no-speech is normal, auto-restart handles it
        } else {
          setSpeechError(`Fehler: ${event.error}`);
        }
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleRecording = useCallback(() => {
    if (!speechSupported || !recognitionRef.current) {
      setSpeechError("Sprachaufnahme hier nicht verfügbar — bitte tippen");
      return;
    }
    if (recordingWanted) {
      // Stop
      recordingWantedRef.current = false;
      setRecordingWanted(false);
      recognitionRef.current.stop();
    } else {
      // Start
      recordingWantedRef.current = true;
      setRecordingWanted(true);
      setSpeechError(null);
      startRecognitionSafely();
    }
  }, [recordingWanted, speechSupported]);

  // Voice button label
  const voiceButtonLabel = useMemo(() => {
    if (!speechSupported) return "Sprachaufnahme hier nicht verfügbar — bitte tippen";
    if (speechError) return speechError;
    if (recordingWanted) return "Aufnahme läuft — zum Beenden tippen";
    return "Aufnahme starten";
  }, [speechSupported, speechError, recordingWanted]);

  // Hooks
  const { result, analyze, isAnalyzing } = usePhoneNoteAnalysis();
  const { clearDraft } = useAutosaveDraft(text, setText);
  const ctx = useLiveContext(
    result?.matchedCustomer || null,
    result?.matchedOrder || null,
    result?.matchedMaterial || null,
    result?.matchedTime || null,
  );

  // Analyze on text change (with disambiguation overrides)
  useEffect(() => {
    analyze(text, selectedCustomerId || undefined, selectedOrderIds.length > 0 ? selectedOrderIds : undefined, forceAI);
  }, [text, analyze, selectedCustomerId, selectedOrderIds, forceAI]);

  // Date for header
  const dateStr = useMemo(() => {
    const now = new Date();
    const days = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
    const months = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
    return `Fokus-Modus · ${days[now.getDay()].slice(0, 2)} ${now.getDate()}. ${months[now.getMonth()]} · ${now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
  }, []);

  // Responsive breakpoints
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 600);
      setIsTablet(window.innerWidth >= 600 && window.innerWidth < 1024);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Handlers
  const handleAnalyze = useCallback(async () => {
    if (!text.trim()) return;
    
    // Save to DB before proceeding (Phase 3 requirement)
    try {
      setIsSaving(true);
      const noteData = {
        rawText: text,
        category: "Neuanfrage",
        urgency: "Normal",
        status: "open",
        extractionJson: { mode: "auto" }
      };
      await createPhoneNote(noteData);
    } catch (e) {
      console.error("Fehler beim Speichern der Notiz:", e);
    } finally {
      setIsSaving(false);
    }

    setStep(3);
  }, [text]);

  const handleLiveActionClick = useCallback((action: any) => {
    if (action.type === "create_order") {
      const draftId = `draft_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      const draftPayload = {
        draftId,
        source: "phone_note",
        rawText: text,
        customerId: action.payload.customerId,
        customerName: action.payload.customerName,
        customerCandidateIds: action.payload.customerCandidateIds,
        material: action.payload.material,
        surfaceRequested: action.payload.surfaceRequested,
        requestedDate: action.payload.requestedDate,
        notes: `Aus Telefonnotiz: ${text}`
      };
      
      sessionStorage.setItem(draftId, JSON.stringify(draftPayload));
      
      openErfassung({ mode: "order", intent: "create_order", source: "phone", prefill: { rawText: text } });
    } else if (action.type === "create_customer") {
      openErfassung({ mode: "customer", intent: "create_customer", source: "phone", prefill: { rawText: text } });
    } else if (action.type === "review_email") {
      setShowEmailMock(true);
    } else if (action.type === "prepare_quote") {
      alert("Angebotsmodul öffnet sich (Mock)");
    }
  }, [router]);

  const handleSave = useCallback(async (saveMode: "auto" | "park") => {
    setIsSaving(true);
    try {
      const noteData = {
        rawText: text,
        generatedAnswer: result?.suggestedAnswer,
        category: result?.matchedTheme || "Rückfrage",
        urgency: "Normal",
        customerId: result?.matchedCustomer?.id,
        orderId: result?.matchedOrder?.id,
        callerName: result?.matchedCustomer?.name,
        status: saveMode === "park" ? "parked" : "done",
        extractionJson: {
          fields: result?.fields,
          actions: result?.liveActions,
          mode: saveMode,
          quelleTyp,
        },
      };

      const res = await createPhoneNote(noteData);

      if (saveMode === "park" && res.data) {
        parkCall({
          id: res.data.id,
          rawText: text,
          matchedCustomerName: result?.matchedCustomer?.name,
          matchedOrderNumber: result?.matchedOrder?.orderNumber,
          parkedAt: Date.now()
        });
        clearDraft();
        setShowExitDialog(false);
        router.push(returnPath);
      } else {
        setShowSaveSheet(false);
        setStep(4);
        setShowSuccess(true);
        setShowUndo(true);
        setTimeout(() => setShowUndo(false), 10000);
        setSavedNoteId(res.data?.id || null);
      }
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setIsSaving(false);
    }
  }, [text, result, clearDraft, parkCall, returnPath, router]);

  const handleExit = useCallback(() => {
    if (text.trim() && step < 4) {
      setShowExitDialog(true);
    } else {
      router.push(returnPath);
    }
  }, [text, step, returnPath, router]);

  const handleReturnAttempt = useCallback(() => {
    if (text.trim() && step < 4) {
      setShowExitDialog(true);
    } else {
      router.push(returnPath);
    }
  }, [text, step, returnPath, router]);

  const handleDiscard = useCallback(() => {
    clearDraft();
    setShowExitDialog(false);
    router.push(returnPath);
  }, [clearDraft, returnPath, router]);

  // Handle customer selection
  const handleSelectCustomer = useCallback((customerId: string) => {
    setSelectedCustomerId(customerId);
    setSelectedOrderIds([]); // Reset order selection
  }, []);

  // Handle order selection
  const handleSelectOrder = useCallback((orderId: string) => {
    setSelectedOrderIds(prev => {
      if (prev.includes(orderId)) return prev.filter(id => id !== orderId);
      return [...prev, orderId];
    });
  }, []);

  // Backdrop HTML for mirror highlighting
  const backdropHtml = useMemo(() => {
    return buildHighlightedHtml(text, result?.highlights || []);
  }, [text, result?.highlights]);

  /* ===== RENDER ===== */
  return (
    <div 
      className="fixed inset-0 z-100 flex flex-col md:p-6 lg:p-10 xl:p-14 md:bg-navy-900/60 md:backdrop-blur-md transition-all"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleExit();
      }}
    >
      <style>{`
        @keyframes slideInFromRight {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .live-action-card {
          animation: slideInFromRight 0.25s ease-out forwards;
        }
      `}</style>
      <div className="relative w-full h-full flex flex-col">
        {/* ===== RETURN ORB (floating, outside panel) ===== */}
        {showReturnOrb && (
          <div className="tn-return-orb-wrap">
            <button
              type="button"
              className="tn-return-orb"
              onClick={handleReturnAttempt}
              aria-label={returnLabel}
              title={returnLabel}
              style={{ overflow: "hidden", padding: 0 }}
            >
              <Image
                src="/warendurchlauf/station-wareneingang.png"
                alt="Wareneingang"
                width={58}
                height={58}
                style={{ objectFit: "cover", borderRadius: "999px", width: "100%", height: "100%" }}
                priority
              />
            </button>
          </div>
        )}

        <div 
          className="flex-1 w-full h-full flex flex-col overflow-hidden md:rounded-4xl md:shadow-2xl md:ring-1 md:ring-white/10"
          style={{ fontFamily: "'Manrope', sans-serif", background: "var(--tn-cream)", color: "var(--tn-ink)", WebkitFontSmoothing: "antialiased" }}
        >

      {/* ===== HEADER ===== */}
      <header className={showReturnOrb && !isMobile ? "tn-focus-header" : ""} style={{ background: "var(--tn-cream)", borderBottom: "1px solid var(--tn-line)", padding: isMobile ? "12px 16px" : "14px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <div style={{ width: 34, height: 34, background: "var(--tn-orange)", borderRadius: 8, display: "grid", placeItems: "center", color: "white", flexShrink: 0 }}>
            <Phone size={18} />
          </div>
          <div style={{ lineHeight: 1.2, minWidth: 0 }}>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: isMobile ? 16 : 18, fontWeight: 500, whiteSpace: "nowrap", margin: 0 }}>Telefonnotiz</h1>
            <div style={{ fontSize: 11, color: "var(--tn-ink-mute)" }}>{dateStr}</div>
          </div>
        </div>

        {/* Step indicator (desktop/tablet) */}
        {!isMobile && (
          <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
            {STEPS.map((s, i) => (
              <React.Fragment key={s.id}>
                {i > 0 && <div style={{ width: 22, height: 1, background: "var(--tn-line-strong)", margin: "0 8px" }} />}
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%",
                    background: step > s.id ? "var(--tn-green-bright)" : step === s.id ? "var(--tn-ink)" : "var(--tn-cream-3)",
                    color: step >= s.id ? (step > s.id ? "white" : "var(--tn-cream)") : "var(--tn-ink-mute)",
                    fontSize: 11, fontWeight: 700, display: "grid", placeItems: "center",
                    transition: "all 0.3s"
                  }}>
                    {step > s.id ? <Check size={11} /> : s.id}
                  </div>
                  {!isTablet && <span style={{ fontSize: 11.5, fontWeight: 600, color: step === s.id ? "var(--tn-ink)" : "var(--tn-ink-mute)", whiteSpace: "nowrap" }}>{s.label}</span>}
                </div>
              </React.Fragment>
            ))}
          </div>
        )}

        <button onClick={handleExit} style={{
          width: 34, height: 34, borderRadius: "50%", border: "1px solid var(--tn-line)", background: "var(--tn-paper)",
          display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0, color: "var(--tn-ink-mute)",
          transition: "all 0.2s"
        }}>
          <X size={14} />
        </button>
      </header>

      {/* ===== BODY ===== */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 280px" : "1fr 340px", overflow: "auto" }}>
        {/* ===== LEFT PANE: Input / Eval ===== */}
        <div style={{ padding: isMobile ? "16px" : "22px 26px", overflowY: "auto" }}>
          {/* ===== INPUT VIEW (Step 1-2) ===== */}
          {step < 3 && !showSuccess && (
            <>
              {/* Mode toggle */}
              <div className="tn-mode-toggle" style={{ marginBottom: 18 }}>
                <button className={`tn-mode-opt ${mode === "type" ? "active" : ""}`} onClick={() => setMode("type")}>
                  <Edit2 size={14} /> Tippen
                </button>
                <button className={`tn-mode-opt ${mode === "voice" ? "active" : ""}`} onClick={() => setMode("voice")}>
                  <Mic size={14} /> Sprechen
                </button>
              </div>

              {/* Type zone - Side by Side with Answer */}
              {mode === "type" && (
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "60% 1fr", gap: 16 }}>
                  {/* Left: Input */}
                  <div>
                    <div className="tn-editor-wrap">
                      <div className="tn-editor-backdrop" dangerouslySetInnerHTML={{ __html: backdropHtml }} />
                      <textarea
                        className="tn-editor-input"
                        value={text}
                        onChange={e => setText(e.target.value)}
                        placeholder='Beispiel: Herr Müller fragt nach den Zinkteilen, Auftrag A-2026-0107. Möchte morgen abholen, zahlt bar.'
                        autoFocus
                        spellCheck={false}
                      />
                    </div>
                    <div style={{ fontSize: 11, color: "var(--tn-ink-mute)", marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                      <Check size={12} style={{ color: "var(--tn-green-bright)" }} />
                      Auto-Speichern aktiv.
                    </div>
                  </div>
                  
                  {/* Right: Answer */}
                  <div style={{ background: "var(--tn-ink)", color: "var(--tn-cream)", borderRadius: 12, padding: "16px", display: "flex", flexDirection: "column" }}>
                    <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, opacity: 0.6, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                      💬 Antwort zum Vorlesen
                      {isAnalyzing && <Activity size={10} className="animate-spin" />}
                    </div>
                    <p style={{ fontFamily: "'Fraunces', serif", fontSize: 15, lineHeight: 1.5, margin: 0, flex: 1 }}>
                      {result?.suggestedAnswer || `„Sobald du sprichst oder tippst, entsteht hier eine fertige Antwort."`}
                    </p>
                    {!result?.usedAI && text.length > 5 && (
                      <button 
                        onClick={() => setForceAI(true)}
                        style={{ marginTop: 12, width: "100%", padding: "8px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, color: "var(--tn-cream)", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                      >
                        <Zap size={12} /> Zu generisch? KI anfordern
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Voice zone */}
              {mode === "voice" && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 0" }}>
                  <div style={{ position: "relative", width: 120, height: 120, margin: "8px 0 26px" }}>
                    <button 
                      onClick={toggleRecording}
                      style={{
                        width: "100%", height: "100%", borderRadius: "50%", border: "none",
                        background: recordingWanted ? "var(--tn-red)" : "linear-gradient(145deg, var(--tn-orange), #9A330A)", color: "white",
                        display: "grid", placeItems: "center", cursor: "pointer",
                        boxShadow: recordingWanted ? "0 16px 32px -10px rgba(220,38,38,0.5)" : "0 16px 32px -10px rgba(194,65,12,0.5), inset 0 -3px 6px rgba(0,0,0,0.2)",
                        animation: recordingWanted ? "pulse 2s infinite" : "none"
                      }}
                    >
                      {recordingWanted ? <MicOff size={38} /> : <Mic size={38} />}
                    </button>
                    <div style={{ position: "absolute", bottom: -26, left: "50%", transform: "translateX(-50%)", fontSize: 11.5, fontWeight: 600, color: speechError ? "var(--tn-red)" : "var(--tn-ink-soft)", whiteSpace: "nowrap" }}>
                      {voiceButtonLabel}
                    </div>
                  </div>
                  {recordingWanted && (
                    <style>{`
                      @keyframes pulse {
                        0% { transform: scale(1); }
                        50% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(220,38,38,0.2); }
                        100% { transform: scale(1); }
                      }
                    `}</style>
                  )}
                  <div style={{ width: "100%", background: "var(--tn-paper)", border: "1px solid var(--tn-line)", borderRadius: 14, padding: "14px 16px", minHeight: 80, fontFamily: "'Fraunces', serif", fontSize: 15, lineHeight: 1.5, marginTop: 18 }}>
                    {text ? (
                      <span style={{ color: "var(--tn-ink)" }}>{text}</span>
                    ) : (
                      <span style={{ color: "var(--tn-ink-mute)", fontFamily: "'Manrope', sans-serif", fontSize: 13 }}>
                        Sobald du sprichst, erscheint hier die Live-Transkription…
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Analyze button */}
              <button className="tn-btn-primary" onClick={handleAnalyze} disabled={!text.trim() || isAnalyzing} style={{ marginTop: 18 }}>
                {isAnalyzing ? (
                  <>
                    <Activity size={16} className="animate-spin" style={{ color: "var(--tn-green-bright)", marginRight: 8 }} />
                    Analysiere…
                  </>
                ) : (
                  <>
                    <span style={{ color: "var(--tn-green-bright)" }}>✦</span> Auswerten <span style={{ color: "var(--tn-green-bright)" }}>✦</span>
                  </>
                )}
              </button>

              {/* ===== LIVE ACTIONS (below Auswerten, desktop only, during Step 1-2) ===== */}
              {!isMobile && result && (result.needsCustomerSelection || result.needsOrderSelection || result.liveActions.length > 0) && (
                <div style={{ marginTop: 24 }}>
                  <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--tn-ink-mute)", fontWeight: 700, marginBottom: 12 }}>
                    Live-Erkennung & Aktionen
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>

                    {/* Customer disambiguation tile */}
                    {result.needsCustomerSelection && result.customerCandidates.length > 1 && (
                      <div className="live-action-card" style={{ gridColumn: "1 / -1", background: "var(--tn-orange-soft)", border: "1.5px solid var(--tn-orange)", borderRadius: 12, padding: "12px 14px" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--tn-orange)", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                          <AlertTriangle size={12} /> {result.customerCandidates.length} mögliche Kunden erkannt
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {result.customerCandidates.map(cc => (
                            <button key={cc.id} onClick={() => handleSelectCustomer(cc.id)} style={{
                              background: selectedCustomerId === cc.id ? "var(--tn-green-bright)" : "var(--tn-paper)",
                              color: selectedCustomerId === cc.id ? "white" : "var(--tn-ink)",
                              border: `1px solid ${selectedCustomerId === cc.id ? "var(--tn-green-bright)" : "var(--tn-line)"}`,
                              borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                              transition: "all 0.15s"
                            }}>
                              {cc.name} · {cc.city}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Order disambiguation tile */}
                    {result.needsOrderSelection && result.orderCandidates.length > 1 && (
                      <div className="live-action-card" style={{ gridColumn: "1 / -1", background: "var(--tn-violet-soft)", border: "1.5px solid var(--tn-violet)", borderRadius: 12, padding: "12px 14px" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--tn-violet)", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                          <FileText size={12} /> {result.orderCandidates.length} offene Aufträge
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {result.orderCandidates.map(oc => (
                            <button key={oc.id} onClick={() => handleSelectOrder(oc.id)} style={{
                              background: selectedOrderIds.includes(oc.id) ? "var(--tn-green-bright)" : "var(--tn-paper)",
                              color: selectedOrderIds.includes(oc.id) ? "white" : "var(--tn-ink)",
                              border: `1px solid ${selectedOrderIds.includes(oc.id) ? "var(--tn-green-bright)" : "var(--tn-line)"}`,
                              borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                              transition: "all 0.15s"
                            }}>
                              {oc.orderNumber} · {oc.task}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* DYNAMIC LIVE ACTIONS */}
                    {result.liveActions.map(action => (
                      <button 
                        key={action.id} 
                        className="live-action-card"
                        onClick={() => handleLiveActionClick(action)}
                        style={{
                          background: "var(--tn-paper)", border: "1px solid var(--tn-line)", borderRadius: 14, padding: "16px",
                          display: "flex", flexDirection: "column", gap: 12, cursor: "pointer", textAlign: "left",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.04)", transition: "transform 0.15s, box-shadow 0.15s"
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.08)"; }}
                        onMouseOut={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)"; }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 10, background: action.priority === "high" ? "var(--tn-orange-soft)" : "var(--tn-cream-3)", color: action.priority === "high" ? "var(--tn-orange)" : "var(--tn-ink)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                            {action.type === "create_order" ? <Package size={16} /> :
                             action.type === "create_customer" ? <User size={16} /> :
                             action.type === "review_email" ? <Mail size={16} /> :
                             action.type === "prepare_quote" ? <FileText size={16} /> :
                             action.type.includes("cal") ? <Calendar size={16} /> :
                             <Zap size={16} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--tn-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{action.title}</div>
                            <div style={{ fontSize: 11, color: "var(--tn-ink-mute)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{action.subtitle}</div>
                          </div>
                        </div>
                      </button>
                    ))}

                  </div>
                </div>
              )}
            </>
          )}

          {/* ===== EVAL VIEW (Step 3) ===== */}
          {step >= 3 && !showSuccess && result && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 500, margin: 0 }}>Das habe ich erkannt</h3>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "var(--tn-green-soft)", color: "var(--tn-green)", fontSize: 10, fontWeight: 700, padding: "4px 9px", borderRadius: 999, letterSpacing: "0.03em" }}>
                  <Check size={9} /> {result.overallConfidence} % sicher
                </div>
              </div>

              {/* Field grid */}
              <div style={{ display: "grid", gridTemplateColumns: (isMobile || isTablet) ? "1fr" : "1fr 1fr", gap: 8, marginBottom: 16 }}>
                {result.fields.map((field, i) => {
                  const colors: Record<string, { bg: string; fg: string }> = {
                    kunde: { bg: "var(--tn-blue-soft)", fg: "var(--tn-blue)" },
                    auftrag: { bg: "var(--tn-violet-soft)", fg: "var(--tn-violet)" },
                    thema: { bg: "var(--tn-green-soft)", fg: "var(--tn-green)" },
                    material: { bg: "var(--tn-yellow-soft)", fg: "var(--tn-yellow)" },
                    zeit: { bg: "var(--tn-orange-soft)", fg: "var(--tn-orange)" },
                    zahlung: { bg: "var(--tn-cream-3)", fg: "var(--tn-ink-soft)" },
                  };
                  const c = colors[field.type] || colors.zahlung;
                  const icons: Record<string, React.ReactNode> = {
                    kunde: <User size={13} />,
                    auftrag: <FileText size={13} />,
                    thema: <Clock size={13} />,
                    material: <Package size={13} />,
                    zeit: <Calendar size={13} />,
                    zahlung: <CreditCard size={13} />,
                  };
                  return (
                    <div key={field.type} className="tn-field-card" style={{ animation: `fadeSlideUp 0.35s ease ${i * 80}ms both` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", flexShrink: 0, background: c.bg, color: c.fg }}>
                          {icons[field.type]}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--tn-ink-mute)" }}>{field.label}</div>
                          <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 1 }}>
                            {field.value}
                            <span className="tn-conf-badge" style={{ background: "var(--tn-green-soft)", color: "var(--tn-green)" }}>{field.confidence} %</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Actions preview */}
              {result.liveActions.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--tn-ink-mute)", fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="tn-pulse" /> Was passiert beim Verteilen
                  </div>
                  {result.liveActions.map(action => (
                    <div key={action.id} className="tn-action-row">
                      <div style={{
                        width: 18, height: 18, borderRadius: "50%",
                        background: action.source === "database" || action.priority === "high" ? "var(--tn-green-bright)" : "var(--tn-yellow)",
                        color: "white", display: "grid", placeItems: "center"
                      }}>
                        {action.source === "database" || action.priority === "high" ? <Check size={9} /> : <AlertTriangle size={9} />}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{action.title}</div>
                        <div style={{ fontSize: 10.5, color: "var(--tn-ink-mute)", marginTop: 1 }}>{action.subtitle}</div>
                      </div>
                      <span style={{
                        fontSize: 9, padding: "2px 6px", borderRadius: 4, fontWeight: 700, letterSpacing: "0.04em",
                        background: action.source === "database" || action.priority === "high" ? "var(--tn-green-soft)" : "var(--tn-yellow-soft)",
                        color: action.source === "database" || action.priority === "high" ? "var(--tn-green)" : "var(--tn-yellow)"
                      }}>
                        {action.source === "database" || action.priority === "high" ? "auto" : "prüfen"}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Save button */}
              <div style={{ marginTop: 18, paddingTop: 14 }}>
                <button className="tn-btn-primary" onClick={() => setShowSaveSheet(true)}>
                  <Check size={14} /> Speichern & verteilen
                </button>
              </div>

              {/* Back to edit */}
              <button onClick={() => setStep(1)} style={{ marginTop: 12, background: "none", border: "none", fontSize: 12, color: "var(--tn-ink-mute)", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                <ArrowLeft size={12} /> Zurück zum Text
              </button>
            </div>
          )}

          {/* ===== SUCCESS SCREEN ===== */}
          {showSuccess && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40 }}>
              <div className="tn-pop" style={{ width: 76, height: 76, borderRadius: "50%", background: "var(--tn-green-bright)", display: "grid", placeItems: "center", color: "white", marginBottom: 20 }}>
                <Check size={36} />
              </div>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, margin: 0, marginBottom: 8, textAlign: "center" }}>Alles verteilt.</h2>
              <p style={{ fontSize: 13, color: "var(--tn-ink-soft)", textAlign: "center", marginBottom: 20, maxWidth: 340, lineHeight: 1.5 }}>
                Die Telefonnotiz wurde gespeichert und alle Aktionen wurden ausgeführt.
              </p>
              {result && result.liveActions.length > 0 && (
                <div style={{ background: "var(--tn-paper)", border: "1px solid var(--tn-line)", borderRadius: 12, padding: "12px 16px", marginBottom: 18, maxWidth: 320, width: "100%" }}>
                  {result.liveActions.map(a => (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 12 }}>
                      <Check size={14} style={{ color: "var(--tn-green-bright)", flexShrink: 0 }} />
                      <span>{a.title}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 320, width: "100%" }}>
                <button
                  onClick={() => openErfassung({ mode: "customer", intent: "create_customer", source: "phone", sourceRef: savedNoteId, prefill: { rawText: text, ...result?.fields } })}
                  style={{ padding: "12px 16px", borderRadius: 12, border: "1px solid var(--tn-line)", background: "var(--tn-paper)", fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 600, color: "var(--tn-ink)", cursor: "pointer" }}
                >
                  Kunde aus Notiz anlegen
                </button>
                <button
                  onClick={() => openErfassung({ mode: "order", intent: "create_order", source: "phone", sourceRef: savedNoteId, customerId: result?.matchedCustomer?.id, prefill: { rawText: text, ...result?.fields } })}
                  style={{ padding: "12px 16px", borderRadius: 12, border: "1px solid var(--tn-line)", background: "var(--tn-paper)", fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 600, color: "var(--tn-ink)", cursor: "pointer" }}
                >
                  Auftrag/KV aus Notiz anlegen
                </button>
                <button
                  onClick={() => { clearDraft(); router.push(returnPath); }}
                  style={{ padding: "12px 16px", borderRadius: 12, border: "none", background: "var(--tn-ink)", fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 600, color: "var(--tn-cream)", cursor: "pointer" }}
                >
                  Nur Notiz behalten
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ===== RIGHT PANE: Live Context (Callcenter-optimized order) ===== */}
        <aside style={{
          background: "var(--tn-paper)", borderLeft: isMobile ? "none" : "1px solid var(--tn-line)",
          borderTop: isMobile ? "1px solid var(--tn-line)" : "none",
          overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14
        }}>
          {/* Title */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 22, height: 22, borderRadius: 6, background: "var(--tn-cream-2)", display: "grid", placeItems: "center", color: "var(--tn-ink-soft)" }}>
                <Activity size={11} />
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--tn-ink-mute)" }}>
                Live · zum Vorlesen
              </span>
              {isAnalyzing && <Activity size={12} className="animate-spin" style={{ color: "var(--tn-orange)" }} />}
            </div>
            {result?.usedAI ? (
              <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "var(--tn-violet-soft)", color: "var(--tn-violet)", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }} title={result.aiReason}>
                🤖 KI Scan
              </span>
            ) : (
              <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "var(--tn-green-soft)", color: "var(--tn-green)", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                ⚡ Lokal DB
              </span>
            )}
          </div>

          {/* ===== 1. CUSTOMER DISAMBIGUATION (highest priority) ===== */}
          {result?.needsCustomerSelection && result.customerCandidates.length > 1 && (
            <div className="tn-disambig-card">
              <div className="tn-disambig-title">
                <AlertTriangle size={14} /> KUNDE NICHT EINDEUTIG — bitte auswählen
              </div>
              {result.customerCandidates.map(cc => (
                <div
                  key={cc.id}
                  className={`tn-disambig-option ${selectedCustomerId === cc.id ? "selected" : ""}`}
                  onClick={() => handleSelectCustomer(cc.id)}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: 600, fontSize: 14, flexShrink: 0,
                    background: selectedCustomerId === cc.id ? "var(--tn-green-bright)" : "linear-gradient(135deg, #1E3A8A, #1E40AF)",
                    color: "white"
                  }}>
                    {selectedCustomerId === cc.id ? <Check size={18} /> : cc.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{cc.name}</div>
                    <div style={{ fontSize: 11, color: "var(--tn-ink-mute)", marginTop: 2 }}>
                      {cc.city} · {cc.phone} · {cc.openOrdersCount} offene Aufträge
                    </div>
                    <div style={{ fontSize: 10, color: "var(--tn-orange)", marginTop: 1 }}>{cc.matchReason}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ===== 2. ORDER DISAMBIGUATION ===== */}
          {result?.needsOrderSelection && result.orderCandidates.length > 1 && (
            <div className="tn-disambig-card">
              <div className="tn-disambig-title">
                <FileText size={14} /> {result.matchedCustomer?.name || "Kunde"} HAT {result.orderCandidates.length} OFFENE AUFTRÄGE
              </div>
              {result.orderCandidates.map(oc => (
                <div
                  key={oc.id}
                  className={`tn-disambig-option ${selectedOrderIds.includes(oc.id) ? "selected" : ""}`}
                  onClick={() => handleSelectOrder(oc.id)}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, display: "grid", placeItems: "center", fontWeight: 700, fontSize: 10, flexShrink: 0,
                    background: selectedOrderIds.includes(oc.id) ? "var(--tn-green-soft)" : "var(--tn-violet-soft)",
                    color: selectedOrderIds.includes(oc.id) ? "var(--tn-green)" : "var(--tn-violet)",
                    letterSpacing: "0.03em"
                  }}>
                    {selectedOrderIds.includes(oc.id) ? <Check size={18} /> : oc.orderNumber.slice(-4)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{oc.orderNumber} · {oc.task}</div>
                    <div style={{ fontSize: 11, color: "var(--tn-ink-mute)", marginTop: 2 }}>
                      {oc.status} · {oc.station} · {oc.dueDate}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ===== 3. PROMINENT APPOINTMENT CARD ===== */}
          {result?.matchedTime && (
            <div className={`tn-appointment-card ${result.matchedTime.isFree ? "free" : "conflict"}`}>
              <div className="tn-appt-label">
                {result.matchedTime.isFree ? "✓ TERMIN FREI" : "⚠ TERMINKONFLIKT"}
              </div>
              <div className="tn-appt-value">{result.matchedTime.label}</div>
              <div className="tn-appt-hint">
                {result.matchedTime.isFree
                  ? "Frei und möglich — kann direkt zugesagt werden"
                  : "Wochenende / geschlossen — Alternative vorschlagen"}
              </div>
            </div>
          )}

          {/* ===== 4. SUGGESTED ANSWER HINT ===== */}
          <div style={{ padding: "0 10px", marginTop: -6, marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: "var(--tn-ink-mute)", fontStyle: "italic" }}>
              Antwort-Vorschlag wird im Hauptbereich angezeigt.
            </div>
          </div>

          {/* ===== 5. Customer card ===== */}
          <div className={`tn-ctx-card ${!ctx.customer ? "empty" : ""}`}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--tn-ink-mute)" }}>Kunde</span>
              {ctx.customer && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "var(--tn-green-soft)", color: "var(--tn-green)", fontWeight: 700 }}>erkannt</span>}
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{
                width: 38, height: 38, borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: 600, fontSize: 14, flexShrink: 0,
                background: ctx.customer ? "linear-gradient(135deg, #1E3A8A, #1E40AF)" : "var(--tn-cream-3)",
                color: ctx.customer ? "white" : "var(--tn-ink-mute)",
                transition: "all 0.3s"
              }}>
                {ctx.customer ? ctx.customer.initials : "?"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{ctx.customer?.name || "— wartet auf Eingabe"}</div>
                <div style={{ fontSize: 11, color: "var(--tn-ink-mute)", marginTop: 1 }}>
                  {ctx.customer ? `${ctx.customer.city} · ${ctx.customer.since}` : "noch keine Erkennung"}
                </div>
                {ctx.customer && (
                  <Link href="/customers" style={{ fontSize: 11, color: "var(--tn-orange)", fontWeight: 500, textDecoration: "none", marginTop: 3, display: "inline-block" }}>
                    Kundenakte öffnen →
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* ===== 5b. Email & History card ===== */}
          {ctx.customer && (
            <div className="tn-ctx-card">
              <div style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--tn-ink-mute)", display: "flex", alignItems: "center", gap: 4 }}><Mail size={12} /> Letzte Kommunikation</span>
                <span style={{ fontSize: 9, color: "var(--tn-ink-mute)" }}>Vor 2 Tagen</span>
              </div>
              
              <div style={{ background: "white", border: "1px solid var(--tn-line)", borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Bilder zum Auftrag</div>
                <div style={{ fontSize: 11, color: "var(--tn-ink-soft)", marginBottom: 10, lineHeight: 1.4 }}>
                  &quot;Guten Tag, anbei wie besprochen die Bilder der Teile. Können Sie diese noch retten?&quot;
                </div>
                
                {/* Mock Attachment */}
                <button onClick={(e) => { e.preventDefault(); alert("Bildvorschau öffnet sich im Vollbild (Mockup)"); }} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--tn-cream-2)", border: "1px solid var(--tn-line)", borderRadius: 6, padding: "6px 10px", width: "100%", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                  <div style={{ background: "var(--tn-orange-soft)", color: "var(--tn-orange)", width: 24, height: 24, borderRadius: 4, display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <ImageIcon size={12} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--tn-ink)" }}>kratzer_detail.jpg</div>
                    <div style={{ fontSize: 9, color: "var(--tn-ink-mute)" }}>2.4 MB</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ===== 6. Orders card ===== */}
          <div className="tn-ctx-card">
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--tn-ink-mute)" }}>Offene Aufträge</span>
            </div>
            {ctx.orders.length > 0 ? ctx.orders.map(o => (
              <div key={o.id} style={{
                display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center",
                padding: "8px 10px", background: o.isHighlighted ? "var(--tn-violet-soft)" : "var(--tn-paper)",
                border: `1px solid ${o.isHighlighted ? "var(--tn-violet)" : "var(--tn-line)"}`,
                borderRadius: 8, marginBottom: 5, fontSize: 12, transition: "all 0.2s"
              }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{o.orderNumber}</div>
                  <div style={{ fontSize: 10.5, color: "var(--tn-ink-mute)", marginTop: 1 }}>{o.task}</div>
                </div>
                <span style={{
                  fontSize: 9, padding: "2px 6px", borderRadius: 4, fontWeight: 700, letterSpacing: "0.04em",
                  background: o.statusText === "Im Plan" ? "var(--tn-green-soft)" : "var(--tn-yellow-soft)",
                  color: o.statusText === "Im Plan" ? "var(--tn-green)" : "var(--tn-yellow)"
                }}>
                  {o.statusText}
                </span>
              </div>
            )) : (
              <div style={{ fontSize: 12, color: "var(--tn-ink-mute)" }}>— wartet auf Erkennung</div>
            )}
          </div>

          {/* Calendar card */}
          <div className="tn-ctx-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--tn-ink-mute)" }}>Kalender · Wunschtermin</span>
              {result?.matchedTime && (
                <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "var(--tn-orange-soft)", color: "var(--tn-orange)", fontWeight: 700 }}>prüfen</span>
              )}
            </div>
            <div className="tn-cal-strip">
              {ctx.calendar.days.map((d, i) => (
                <div key={i} className={`tn-cal-day ${d.type}`}>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", opacity: 0.75 }}>{d.label}</div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 500, marginTop: 1 }}>{d.num}</div>
                  <div style={{ fontSize: 8.5, marginTop: 1, opacity: 0.8 }}>{d.info}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "var(--tn-ink-mute)", marginTop: 8 }}>{ctx.calendar.hint}</div>
          </div>

          {/* Stock card */}
          <div className="tn-ctx-card">
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--tn-ink-mute)" }}>Lager</span>
            </div>
            {ctx.stock ? (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "3px 0" }}>
                <span style={{ fontWeight: 500 }}>{ctx.stock.name}</span>
                <span style={{
                  fontSize: 10, padding: "2px 7px", borderRadius: 4, fontWeight: 600,
                  background: ctx.stock.status === "ok" ? "var(--tn-green-soft)" : "var(--tn-yellow-soft)",
                  color: ctx.stock.status === "ok" ? "var(--tn-green)" : "var(--tn-yellow)"
                }}>{ctx.stock.level}</span>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "var(--tn-ink-mute)" }}>— wartet auf Material</div>
            )}
          </div>

          {/* Payment card */}
          <div className="tn-ctx-card">
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--tn-ink-mute)" }}>Zahlung</span>
            </div>
            {ctx.payment ? (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
                  <span style={{ color: "var(--tn-ink-mute)" }}>LEFTA Rechnung</span>
                  <span style={{ fontWeight: 600 }}>{ctx.payment.total}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
                  <span style={{ color: "var(--tn-ink-mute)" }}>Offen</span>
                  <span style={{ fontWeight: 600, color: "var(--tn-orange)" }}>{ctx.payment.open}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
                  <span style={{ color: "var(--tn-ink-mute)" }}>Zahlungsmoral</span>
                  <span style={{ fontWeight: 600, color: "var(--tn-green)" }}>{ctx.payment.moral}</span>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "var(--tn-ink-mute)" }}>— wartet auf Kunde</div>
            )}
          </div>

          {/* Quick lookups */}
          <div>
            <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--tn-ink-mute)", fontWeight: 700, marginBottom: 8 }}>⚡ 1-Tap-Antworten</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {[
                { label: "Wo ist Ware?", icon: <Package size={11} />, bg: "var(--tn-blue-soft)", fg: "var(--tn-blue)" },
                { label: "Reklamation?", icon: <AlertTriangle size={11} />, bg: "var(--tn-red-soft)", fg: "var(--tn-red)" },
                { label: "Wann fertig?", icon: <Check size={11} />, bg: "var(--tn-green-soft)", fg: "var(--tn-green)" },
                { label: "Zahlung offen?", icon: <CreditCard size={11} />, bg: "var(--tn-orange-soft)", fg: "var(--tn-orange)" },
              ].map(ql => (
                <button key={ql.label} className="tn-ql-btn">
                  <span style={{ width: 20, height: 20, borderRadius: 5, display: "grid", placeItems: "center", flexShrink: 0, background: ql.bg, color: ql.fg }}>{ql.icon}</span>
                  {ql.label}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* ===== SAVE SHEET OVERLAY ===== */}
      {showSaveSheet && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(27,27,27,0.55)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 24 }} onClick={e => { if (e.target === e.currentTarget) setShowSaveSheet(false); }}>
          <div style={{ background: "var(--tn-cream)", borderRadius: 18, padding: "24px 26px", maxWidth: 440, width: "100%", boxShadow: "var(--tn-shadow-lg)" }}>
            <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 21, margin: 0, marginBottom: 6 }}>Was soll passieren?</h3>
            <div style={{ fontSize: 13, color: "var(--tn-ink-soft)", marginBottom: 18, lineHeight: 1.5 }}>
              Egal welcher Weg — alles landet sauber. Nichts versandet.
            </div>

            {/* Marketing Dropdown */}
            <div style={{ marginBottom: 18, padding: "12px 16px", background: "var(--tn-cream-2)", borderRadius: 12, border: "1px solid var(--tn-line)" }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--tn-ink-mute)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
                Wie haben Sie von uns gehört?
              </label>
              <select 
                value={quelleTyp} 
                onChange={(e) => setQuelleTyp(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--tn-line)", background: "var(--tn-paper)", color: "var(--tn-ink)", fontSize: 13, fontFamily: "'Manrope', sans-serif" }}
              >
                <option value="weiß nicht">Weiß nicht / keine Angabe</option>
                <option value="Empfehlung">Empfehlung / Bestandskunde</option>
                <option value="Google Suche">Google Suche</option>
                <option value="Instagram">Instagram</option>
                <option value="Messe">Messe / Event</option>
                <option value="Zeitung/Werbung">Zeitung / Printwerbung</option>
              </select>
            </div>

            {/* Auto */}
            <div onClick={() => handleSave("auto")} style={{
              background: "var(--tn-ink)", color: "var(--tn-cream)", border: "1px solid var(--tn-ink)", borderRadius: 14,
              padding: "14px 16px", marginBottom: 8, display: "grid", gridTemplateColumns: "36px 1fr auto", gap: 12, alignItems: "center", cursor: "pointer"
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.1)", display: "grid", placeItems: "center" }}>
                <Zap size={16} />
              </div>
              <div>
                <h4 style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 600, margin: 0, marginBottom: 2 }}>Automatisch verarbeiten</h4>
                <div style={{ fontSize: 11, color: "rgba(250,246,238,0.6)", lineHeight: 1.4 }}>
                  {result?.liveActions.filter((a: any) => a.source === "database" || a.priority === "high").length || 0} grüne Aktionen sofort anwenden
                </div>
              </div>
              <ChevronRight size={14} style={{ opacity: 0.5 }} />
            </div>

            {/* Park */}
            <div onClick={() => setShowReminder(!showReminder)} style={{
              background: "var(--tn-paper)", border: "1px solid var(--tn-line)", borderRadius: 14,
              padding: "14px 16px", marginBottom: 8, display: "grid", gridTemplateColumns: "36px 1fr auto", gap: 12, alignItems: "center", cursor: "pointer"
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--tn-cream-2)", display: "grid", placeItems: "center", color: "var(--tn-ink-soft)" }}>
                <Clock size={16} />
              </div>
              <div>
                <h4 style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 600, margin: 0, marginBottom: 2 }}>Mit Vermerk für später parken</h4>
                <div style={{ fontSize: 11, color: "var(--tn-ink-mute)", lineHeight: 1.4 }}>Erinnerung {reminderTime} — du wirst angepingt</div>
              </div>
              <ChevronRight size={14} style={{ opacity: 0.5 }} />
            </div>

            {/* Reminder picker */}
            {showReminder && (
              <div style={{ background: "var(--tn-paper)", border: "1px solid var(--tn-line)", borderRadius: 14, padding: "14px 16px", marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: "var(--tn-ink-mute)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Wann erinnern?</div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 10 }}>
                  {["In 30 Min", "Heute 17:00", "Morgen 8:00"].map(t => (
                    <button key={t} onClick={() => setReminderTime(t)} style={{
                      background: reminderTime === t ? "var(--tn-ink)" : "var(--tn-cream-2)",
                      color: reminderTime === t ? "var(--tn-cream)" : "var(--tn-ink)",
                      border: `1px solid ${reminderTime === t ? "var(--tn-ink)" : "var(--tn-line)"}`,
                      padding: "6px 12px", borderRadius: 8, fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit"
                    }}>{t}</button>
                  ))}
                </div>
                <button className="tn-btn-primary" onClick={() => handleSave("park")} style={{ marginTop: 14 }}>
                  <Check size={14} /> Parken mit Erinnerung
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== EXIT DIALOG ===== */}
      {showExitDialog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(27,27,27,0.55)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 24 }}>
          <div style={{ background: "var(--tn-cream)", borderRadius: 18, padding: "24px 26px", maxWidth: 440, width: "100%", boxShadow: "var(--tn-shadow-lg)" }}>
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, margin: 0, marginBottom: 8 }}>Telefonnotiz ist noch offen</h3>
              <p style={{ fontSize: 13, color: "var(--tn-ink-soft)", margin: 0, lineHeight: 1.5 }}>
                Du kannst die Notiz als offene Konversation parken, um an anderer Stelle in der App weiterzuarbeiten.
              </p>
            </div>

            <div onClick={() => handleSave("park")} style={{
              background: "var(--tn-orange)", color: "white", borderRadius: 14,
              padding: "14px 16px", marginBottom: 8, display: "grid", gridTemplateColumns: "36px 1fr auto", gap: 12, alignItems: "center", cursor: "pointer"
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.2)", display: "grid", placeItems: "center" }}>
                <Clock size={16} />
              </div>
              <div>
                <h4 style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 700, margin: 0, marginBottom: 2 }}>Als offene Konversation parken</h4>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}>Bleibt in der App sichtbar (Empfohlen)</div>
              </div>
              <ChevronRight size={14} style={{ opacity: 0.5 }} />
            </div>

            <div onClick={() => { setShowExitDialog(false); setShowSaveSheet(true); }} style={{
              background: "var(--tn-paper)", border: "1px solid var(--tn-line)", borderRadius: 14,
              padding: "14px 16px", marginBottom: 8, display: "grid", gridTemplateColumns: "36px 1fr auto", gap: 12, alignItems: "center", cursor: "pointer"
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--tn-cream-2)", display: "grid", placeItems: "center", color: "var(--tn-ink-soft)" }}>
                <Check size={16} />
              </div>
              <div>
                <h4 style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 600, margin: 0, marginBottom: 2 }}>Speichern und verteilen</h4>
                <div style={{ fontSize: 11, color: "var(--tn-ink-mute)" }}>Notiz final abschließen</div>
              </div>
              <ChevronRight size={14} style={{ opacity: 0.5 }} />
            </div>

            <div onClick={() => setShowExitDialog(false)} style={{
              background: "var(--tn-paper)", border: "1px solid var(--tn-line)", borderRadius: 14,
              padding: "14px 16px", marginBottom: 8, display: "grid", gridTemplateColumns: "36px 1fr auto", gap: 12, alignItems: "center", cursor: "pointer"
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--tn-cream-2)", display: "grid", placeItems: "center", color: "var(--tn-ink-soft)" }}>
                <ArrowLeft size={16} />
              </div>
              <div>
                <h4 style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 600, margin: 0, marginBottom: 2 }}>Zurück zur Notiz</h4>
                <div style={{ fontSize: 11, color: "var(--tn-ink-mute)" }}>Weiter bearbeiten</div>
              </div>
              <ChevronRight size={14} style={{ opacity: 0.5 }} />
            </div>

            <div onClick={handleDiscard} style={{
              background: "transparent", border: "1px solid transparent", borderRadius: 14,
              padding: "8px 16px", display: "grid", gridTemplateColumns: "36px 1fr auto", gap: 12, alignItems: "center", cursor: "pointer", opacity: 0.7
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, display: "grid", placeItems: "center", color: "var(--tn-red)" }}>
                <X size={16} />
              </div>
              <div>
                <h4 style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 600, margin: 0, color: "var(--tn-red)" }}>Verwerfen</h4>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== UNDO TOAST ===== */}
      {showUndo && (
        <div style={{
          position: "fixed", left: 24, right: 24, bottom: 24,
          background: "var(--tn-ink)", color: "var(--tn-cream)", borderRadius: 12, padding: "12px 16px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          boxShadow: "0 20px 50px -10px rgba(27,27,27,0.4)", zIndex: 70, maxWidth: 420, margin: "0 auto",
          animation: "fadeSlideUp 0.3s ease"
        }}>
          <span style={{ fontSize: 12.5, fontWeight: 500 }}>Alle Aktionen ausgeführt. 10 Sek. Undo.</span>
          <button onClick={() => setShowUndo(false)} style={{
            background: "transparent", border: "1px solid rgba(255,255,255,0.3)", color: "var(--tn-cream)",
            padding: "5px 12px", borderRadius: 6, fontFamily: "inherit", fontSize: 11.5, fontWeight: 600, cursor: "pointer"
          }}>Rückgängig</button>
        </div>
      )}

      {/* Animation keyframes */}
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ===== EMAIL MOCK OVERLAY ===== */}
      {showEmailMock && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-6 bg-navy-900/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setShowEmailMock(false); }}>
          <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 600, boxShadow: "0 20px 40px rgba(0,0,0,0.2)", overflow: "hidden" }}>
            <div style={{ background: "var(--tn-ink)", color: "white", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 18, display: "flex", alignItems: "center", gap: 8 }}><Mail size={18}/> Letzte E-Mails & Anhänge</h3>
              <button onClick={() => setShowEmailMock(false)} style={{ background: "none", border: "none", color: "white", cursor: "pointer" }}><X size={20}/></button>
            </div>
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ border: "1px solid var(--tn-line)", borderRadius: 8, padding: 16, background: "var(--tn-cream-2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Kratzer am Kronleuchter</div>
                    <div style={{ fontSize: 12, color: "var(--tn-ink-mute)" }}>Von: {result?.matchedCustomer?.name || "Kunde"} · Gestern, 14:32</div>
                  </div>
                  <div style={{ background: "var(--tn-blue-soft)", color: "var(--tn-blue)", padding: "4px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, alignSelf: "flex-start" }}>Posteingang</div>
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--tn-ink)", margin: 0 }}>
                  &quot;Guten Tag, anbei wie telefonisch besprochen die Bilder der beschädigten Teile. Können Sie diese noch retten und neu versilbern? Bitte um kurze Rückmeldung bezüglich Preis und Dauer.&quot;
                </p>
                <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
                  <button onClick={() => alert("Bildvorschau öffnet sich")} style={{ display: "flex", alignItems: "center", gap: 8, background: "white", border: "1px solid var(--tn-line)", borderRadius: 6, padding: "8px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                    <ImageIcon size={14} color="var(--tn-orange)" /> kratzer_detail_1.jpg
                  </button>
                  <button onClick={() => alert("Bildvorschau öffnet sich")} style={{ display: "flex", alignItems: "center", gap: 8, background: "white", border: "1px solid var(--tn-line)", borderRadius: 6, padding: "8px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                    <ImageIcon size={14} color="var(--tn-orange)" /> kratzer_detail_2.jpg
                  </button>
                </div>
              </div>
              <button onClick={() => setShowEmailMock(false)} className="tn-btn-primary" style={{ alignSelf: "flex-end" }}>Zurück zur Notiz</button>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
