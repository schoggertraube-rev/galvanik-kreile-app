"use client";
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Phone, Edit2, Mic, MicOff, X, Check, ChevronRight, Clock, Zap, AlertTriangle, Package, CreditCard, Calendar, User, FileText, Activity, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePhoneNoteAnalysis, AnalysisResult } from "@/hooks/usePhoneNoteAnalysis";
import { useLiveContext } from "@/hooks/useLiveContext";
import { useAutosaveDraft } from "@/hooks/useAutosaveDraft";
import { createPhoneNote } from "@/app/actions/phoneNotes.actions";

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

  // Sort highlights by length (longest first) to avoid partial matches
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
  const source = searchParams.get("source") || "home";
  const returnTo = searchParams.get("returnTo");

  // State
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"type" | "voice">("type");
  const [step, setStep] = useState(1);
  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isSaving, setIsSaving] = useState(false);
  const [showUndo, setShowUndo] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [reminderTime, setReminderTime] = useState("Heute 17:00");

  // Speech Recognition State
  const [isRecording, setIsRecording] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false; // iOS Safari is buggy with continuous=true
        recognitionRef.current.interimResults = false; // Prevents duplicate text loops
        recognitionRef.current.lang = "de-DE";

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognitionRef.current.onresult = (event: any) => {
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

        recognitionRef.current.onend = () => {
          setIsRecording(false);
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsRecording(false);
        };
      }
    }
  }, [setText]);

  const toggleRecording = useCallback(() => {
    if (!recognitionRef.current) {
      alert("Spracherkennung wird von deinem Browser (iOS Safari / Chrome) evtl. nicht vollständig unterstützt oder es fehlen Rechte.");
      return;
    }
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err) {
        console.error("Failed to start recording:", err);
      }
    }
  }, [isRecording]);

  // Hooks
  const { result, analyze, isAnalyzing } = usePhoneNoteAnalysis();
  const { clearDraft } = useAutosaveDraft(text, setText);
  const ctx = useLiveContext(
    result?.matchedCustomer || null,
    result?.matchedOrder || null,
    result?.matchedMaterial || null,
    result?.matchedTime || null,
  );

  // Analyze on text change
  useEffect(() => { analyze(text); }, [text, analyze]);

  // Date for header
  const dateStr = useMemo(() => {
    const now = new Date();
    const days = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
    const months = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
    return `Fokus-Modus · ${days[now.getDay()].slice(0, 2)} ${now.getDate()}. ${months[now.getMonth()]} · ${now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
  }, []);

  // Is mobile viewport?
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 600);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Handlers
  const handleAnalyze = useCallback(() => {
    if (!text.trim()) return;
    setStep(3); // Skip to "Prüfen" since analysis is instant
  }, [text]);

  const handleSave = useCallback(async (mode: "auto" | "park") => {
    setIsSaving(true);
    try {
      await createPhoneNote({
        rawText: text,
        generatedAnswer: result?.suggestedAnswer,
        category: result?.matchedTheme || "Rückfrage",
        urgency: "Normal",
        customerId: result?.matchedCustomer?.id,
        orderId: result?.matchedOrder?.id,
        callerName: result?.matchedCustomer?.name,
        extractionJson: {
          fields: result?.fields,
          actions: result?.proposedActions,
          mode,
        },
      });
      clearDraft();
      setShowSaveSheet(false);
      setStep(4);
      setShowSuccess(true);
      setShowUndo(true);
      setTimeout(() => setShowUndo(false), 10000);
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setIsSaving(false);
    }
  }, [text, result, clearDraft]);

  const handleExit = useCallback(() => {
    if (text.trim() && step < 4) {
      setShowExitDialog(true);
    } else {
      router.push(returnTo || (source === "kommunikation" ? "/kommunikation" : "/"));
    }
  }, [text, step, source, returnTo, router]);

  const handleDiscard = useCallback(() => {
    clearDraft();
    setShowExitDialog(false);
    router.push(returnTo || (source === "kommunikation" ? "/kommunikation" : "/"));
  }, [clearDraft, source, returnTo, router]);

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
      <div className="relative w-full h-full flex flex-col">
        <div 
          className="flex-1 w-full h-full flex flex-col overflow-hidden md:rounded-4xl md:shadow-2xl md:ring-1 md:ring-white/10"
          style={{ 
            fontFamily: "'Manrope', sans-serif", 
            background: "var(--tn-cream)", 
            color: "var(--tn-ink)", 
            WebkitFontSmoothing: "antialiased",
            maskImage: (!isMobile && returnTo?.includes("wareneingang")) ? "radial-gradient(circle at 0px 0px, transparent 68px, black 69px)" : "none",
            WebkitMaskImage: (!isMobile && returnTo?.includes("wareneingang")) ? "radial-gradient(circle at 0px 0px, transparent 68px, black 69px)" : "none",
          }}
        >

      {/* ===== HEADER ===== */}
      <header style={{ background: "var(--tn-cream)", borderBottom: "1px solid var(--tn-line)", padding: isMobile ? "12px 16px" : "14px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexShrink: 0 }}>
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
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: step === s.id ? "var(--tn-ink)" : "var(--tn-ink-mute)", whiteSpace: "nowrap" }}>{s.label}</span>
                </div>
              </React.Fragment>
            ))}
          </div>
        )}

        <button onClick={handleExit} style={{
          background: "var(--tn-paper)", border: "1px solid var(--tn-line)", borderRadius: 8,
          padding: "8px 14px", fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: "var(--tn-ink-soft)",
          cursor: "pointer", display: "flex", alignItems: "center", gap: 7, flexShrink: 0
        }}>
          <X size={14} /> Beenden
        </button>
      </header>

      {/* Mobile step dots */}
      {isMobile && (
        <div style={{ display: "flex", justifyContent: "center", gap: 6, padding: "10px 0", background: "var(--tn-cream)" }}>
          {STEPS.map(s => (
            <div key={s.id} style={{
              width: step === s.id ? 22 : 6, height: 6, borderRadius: step === s.id ? 3 : "50%",
              background: step > s.id ? "var(--tn-green-bright)" : step === s.id ? "var(--tn-ink)" : "var(--tn-cream-3)",
              transition: "all 0.3s"
            }} />
          ))}
        </div>
      )}

      {/* ===== BODY: 2-column (desktop/tablet) or stacked (mobile) ===== */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 360px", overflow: "hidden" }}>

        {/* ===== LEFT PANE: Input + Eval ===== */}
        <div style={{ padding: isMobile ? "18px 18px 10px" : "24px 28px", overflowY: "auto", display: "flex", flexDirection: "column" }}>

          {step < 3 && (
            <>
              {/* Intro */}
              <div style={{ marginBottom: 18 }}>
                <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: isMobile ? 19 : 22, fontWeight: 400, lineHeight: 1.15, margin: 0, marginBottom: 4 }}>
                  Tippen oder sprechen.<br />Den Rest erledige ich.
                </h2>
                <p style={{ fontSize: 12.5, color: "var(--tn-ink-mute)", margin: 0 }}>
                  Schreib mit, während du telefonierst — ich erkenne Kunde, Auftrag, Material und Termin und lege alles automatisch ab.
                </p>
              </div>

              {/* Mode toggle */}
              <div className="tn-mode-toggle" style={{ marginBottom: 18 }}>
                <button className={`tn-mode-opt ${mode === "type" ? "active" : ""}`} onClick={() => setMode("type")}>
                  <Edit2 size={14} /> Tippen
                  <span style={{ fontSize: 9, background: "var(--tn-green-soft)", color: "var(--tn-green)", padding: "1px 6px", borderRadius: 4, fontWeight: 700, letterSpacing: "0.03em" }}>Festnetz</span>
                </button>
                <button className={`tn-mode-opt ${mode === "voice" ? "active" : ""}`} onClick={() => setMode("voice")}>
                  <Mic size={14} /> Sprechen
                </button>
              </div>

              {/* Type zone - Mirror Editor */}
              {mode === "type" && (
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
                    Auto-Speichern aktiv. Während du tippst, erscheinen rechts alle Infos zum Vorlesen.
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
                        background: isRecording ? "var(--tn-red)" : "linear-gradient(145deg, var(--tn-orange), #9A330A)", color: "white",
                        display: "grid", placeItems: "center", cursor: "pointer",
                        boxShadow: isRecording ? "0 16px 32px -10px rgba(220,38,38,0.5)" : "0 16px 32px -10px rgba(194,65,12,0.5), inset 0 -3px 6px rgba(0,0,0,0.2)",
                        animation: isRecording ? "pulse 2s infinite" : "none"
                      }}
                    >
                      {isRecording ? <MicOff size={38} /> : <Mic size={38} />}
                    </button>
                    <div style={{ position: "absolute", bottom: -26, left: "50%", transform: "translateX(-50%)", fontSize: 11.5, fontWeight: 600, color: "var(--tn-ink-soft)", whiteSpace: "nowrap" }}>
                      {isRecording ? "Aufnahme läuft... (Tippen zum Stoppen)" : "Tippen zum Aufnehmen"}
                    </div>
                  </div>
                  {isRecording && (
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
                    Analysiere mit AI...
                  </>
                ) : (
                  <>
                    <span style={{ color: "var(--tn-green-bright)" }}>✦</span> Auswerten <span style={{ color: "var(--tn-green-bright)" }}>✦</span>
                  </>
                )}
              </button>
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
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8, marginBottom: 16 }}>
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
              {result.proposedActions.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--tn-ink-mute)", fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="tn-pulse" /> Was passiert beim Verteilen
                  </div>
                  {result.proposedActions.map(action => (
                    <div key={action.id} className="tn-action-row">
                      <div style={{
                        width: 18, height: 18, borderRadius: "50%",
                        background: action.type === "auto" ? "var(--tn-green-bright)" : "var(--tn-yellow)",
                        color: "white", display: "grid", placeItems: "center"
                      }}>
                        {action.type === "auto" ? <Check size={9} /> : <AlertTriangle size={9} />}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{action.title}</div>
                        <div style={{ fontSize: 10.5, color: "var(--tn-ink-mute)", marginTop: 1 }}>{action.subtitle}</div>
                      </div>
                      <span style={{
                        fontSize: 9, padding: "2px 6px", borderRadius: 4, fontWeight: 700, letterSpacing: "0.04em",
                        background: action.type === "auto" ? "var(--tn-green-soft)" : "var(--tn-yellow-soft)",
                        color: action.type === "auto" ? "var(--tn-green)" : "var(--tn-yellow)"
                      }}>
                        {action.type === "auto" ? "auto" : "prüfen"}
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
              {result && result.proposedActions.length > 0 && (
                <div style={{ background: "var(--tn-paper)", border: "1px solid var(--tn-line)", borderRadius: 12, padding: "12px 16px", marginBottom: 18, maxWidth: 320, width: "100%" }}>
                  {result.proposedActions.map(a => (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 12 }}>
                      <Check size={14} style={{ color: "var(--tn-green-bright)", flexShrink: 0 }} />
                      <span>{a.title}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, maxWidth: 320, width: "100%" }}>
                <Link href="/" style={{ flex: 1, textAlign: "center", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--tn-line)", background: "var(--tn-paper)", fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 600, color: "var(--tn-ink)", textDecoration: "none" }}>
                  Zur Startseite
                </Link>
                <Link href="/kommunikation" style={{ flex: 1, textAlign: "center", padding: "12px 16px", borderRadius: 12, border: "none", background: "var(--tn-ink)", fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 600, color: "var(--tn-cream)", textDecoration: "none" }}>
                  Kommunikation
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* ===== RIGHT PANE: Live Context ===== */}
        <aside style={{
          background: "var(--tn-paper)", borderLeft: isMobile ? "none" : "1px solid var(--tn-line)",
          borderTop: isMobile ? "1px solid var(--tn-line)" : "none",
          overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14
        }}>
          {/* Title */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 22, height: 22, borderRadius: 6, background: "var(--tn-cream-2)", display: "grid", placeItems: "center", color: "var(--tn-ink-soft)" }}>
              <Activity size={11} />
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--tn-ink-mute)" }}>
              Live · zum Vorlesen
            </span>
          </div>

          {/* Customer card */}
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

          {/* Orders card */}
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

          {/* Suggested answer */}
          <div className="tn-suggest">
            <div style={{ fontSize: 9, letterSpacing: "0.1em", opacity: 0.5, marginBottom: 6, textTransform: "uppercase", fontWeight: 700 }}>Antwort-Vorschlag</div>
            <p>{result?.suggestedAnswer || `„Sobald genug erkannt ist, schlage ich hier eine Antwort vor, die du direkt vorlesen kannst."`}</p>
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
                  {result?.proposedActions.filter(a => a.type === "auto").length || 0} grüne Aktionen sofort anwenden
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
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--tn-yellow-soft)", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--tn-yellow)", color: "white", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <AlertTriangle size={14} />
              </div>
              <div style={{ fontSize: 12.5, color: "var(--tn-yellow)", fontWeight: 500 }}>
                Dieses Thema ist noch nicht abgelegt. So lässt es sich nicht verlassen.
              </div>
            </div>

            <div onClick={() => { setShowExitDialog(false); setShowSaveSheet(true); }} style={{
              background: "var(--tn-ink)", color: "var(--tn-cream)", border: "1px solid var(--tn-ink)", borderRadius: 14,
              padding: "14px 16px", marginBottom: 8, display: "grid", gridTemplateColumns: "36px 1fr auto", gap: 12, alignItems: "center", cursor: "pointer"
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.1)", display: "grid", placeItems: "center" }}>
                <Check size={16} />
              </div>
              <div>
                <h4 style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 600, margin: 0, marginBottom: 2 }}>Jetzt speichern & verteilen</h4>
                <div style={{ fontSize: 11, color: "rgba(250,246,238,0.6)" }}>Empfohlen</div>
              </div>
              <ChevronRight size={14} style={{ opacity: 0.5 }} />
            </div>

            <div onClick={() => { setShowExitDialog(false); handleSave("park"); }} style={{
              background: "var(--tn-paper)", border: "1px solid var(--tn-line)", borderRadius: 14,
              padding: "14px 16px", marginBottom: 8, display: "grid", gridTemplateColumns: "36px 1fr auto", gap: 12, alignItems: "center", cursor: "pointer"
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--tn-cream-2)", display: "grid", placeItems: "center", color: "var(--tn-ink-soft)" }}>
                <Clock size={16} />
              </div>
              <div>
                <h4 style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 600, margin: 0, marginBottom: 2 }}>Mit Erinnerung parken</h4>
                <div style={{ fontSize: 11, color: "var(--tn-ink-mute)" }}>Erinnerung heute 17:00</div>
              </div>
              <ChevronRight size={14} style={{ opacity: 0.5 }} />
            </div>

            <div onClick={handleDiscard} style={{
              background: "var(--tn-paper)", border: "1px solid var(--tn-line)", borderRadius: 14,
              padding: "14px 16px", display: "grid", gridTemplateColumns: "36px 1fr auto", gap: 12, alignItems: "center", cursor: "pointer"
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--tn-red-soft)", display: "grid", placeItems: "center", color: "var(--tn-red)" }}>
                <X size={16} />
              </div>
              <div>
                <h4 style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 600, margin: 0, marginBottom: 2 }}>Notiz verwerfen</h4>
                <div style={{ fontSize: 11, color: "var(--tn-ink-mute)" }}>Fehlanruf — bewusst löschen</div>
              </div>
              <ChevronRight size={14} style={{ opacity: 0.5 }} />
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
      
      {/* The floating return button in the cutout (only visible on desktop when coming from wareneingang) */}
      {!isMobile && returnTo?.includes("wareneingang") && (
        <button
          onClick={() => router.push(returnTo)}
          title="Zurück zum Wareneingang"
          className="absolute z-50 flex items-center justify-center bg-white/80 backdrop-blur-md shadow-xl border border-white/60 hover:bg-white hover:scale-105 active:scale-95 transition-all"
          style={{
            top: 10,
            left: 10,
            width: 44,
            height: 44,
            borderRadius: "50%",
            color: "var(--tn-ink)",
          }}
        >
          <ArrowLeft size={20} />
        </button>
      )}
      </div>
    </div>
  </div>
);
}
