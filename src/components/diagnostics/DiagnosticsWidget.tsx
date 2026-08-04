"use client";
import React, { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import { useDiagnostics, DiagEvent } from "@/lib/diagnostics/DiagnosticsContext";
import { Bug, X, Flag, Trash2, Download, ChevronDown, ChevronUp, AlertTriangle, AlertCircle, Info, Camera } from "lucide-react";
import { TestpilotCanvas } from "@/components/testpilot/TestpilotCanvas";
import { getPngDataUrlDimensions } from "@/lib/images/pngDimensions";

/* ===== Severity Icon ===== */
function SevIcon({ severity }: { severity: DiagEvent["severity"] }) {
  if (severity === "critical") return <AlertCircle size={12} style={{ color: "#EF4444" }} />;
  if (severity === "error") return <AlertTriangle size={12} style={{ color: "#F97316" }} />;
  if (severity === "warn") return <Info size={12} style={{ color: "#EAB308" }} />;
  return <Info size={12} style={{ color: "#6B7280" }} />;
}

/* ===== Type Badge ===== */
function TypeBadge({ type }: { type: DiagEvent["type"] }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    error: { bg: "#FEE2E2", fg: "#DC2626" },
    network: { bg: "#DBEAFE", fg: "#2563EB" },
    interaction: { bg: "#F3E8FF", fg: "#7C3AED" },
    navigation: { bg: "#E0E7FF", fg: "#4338CA" },
    manual: { bg: "#FEF3C7", fg: "#D97706" },
    performance: { bg: "#FFEDD5", fg: "#EA580C" },
    info: { bg: "#F3F4F6", fg: "#6B7280" },
  };
  const c = colors[type] || colors.info;
  return (
    <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: c.bg, color: c.fg, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {type}
    </span>
  );
}

export function DiagnosticsWidget() {
  const { isActive, events, toggle, markProblem, clearEvents, exportReport, eventCount } = useDiagnostics();
  const [expanded, setExpanded] = useState(false);
  const [showMarkDialog, setShowMarkDialog] = useState(false);
  const [markText, setMarkText] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  
  // Dragging state for the dialog
  const [dialogPos, setDialogPos] = useState({ x: 0, y: 0 });
  const [isDraggingDialog, setIsDraggingDialog] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, initialX: 0, initialY: 0 });

  const openMarkDialog = useCallback(() => {
    setDialogPos({ x: window.innerWidth / 2 - 190, y: window.innerHeight / 2 - 150 });
    setShowMarkDialog(true);
  }, []);

  // Drag handlers
  const onPointerDown = (e: React.PointerEvent) => {
    setIsDraggingDialog(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      initialX: dialogPos.x,
      initialY: dialogPos.y
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingDialog) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setDialogPos({
      x: dragStartRef.current.initialX + dx,
      y: dragStartRef.current.initialY + dy
    });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    setIsDraggingDialog(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  // Auto-scroll log
  useEffect(() => {
    if (expanded && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [events.length, expanded]);

  const handleExport = useCallback(() => {
    const report = exportReport();
    const blob = new Blob([report], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `testbericht_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportReport]);

  const handleMark = useCallback(() => {
    if (markText.trim()) {
      markProblem(markText.trim(), screenshot || undefined);
      setMarkText("");
      setScreenshot(null);
      setShowMarkDialog(false);
    }
  }, [markText, screenshot, markProblem]);

  // Floating Activation Button (always visible when diagnostic is OFF)
  if (!isActive) {
    return (
      <button
        onClick={() => { toggle(); setExpanded(true); }}
        style={{
          position: "fixed", bottom: 16, right: 16, zIndex: 9999,
          width: 44, height: 44, borderRadius: "50%",
          background: "#1E293B", color: "#94A3B8", border: "1px solid #334155",
          display: "grid", placeItems: "center", cursor: "pointer",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          transition: "all 0.15s",
          opacity: 0.6,
        }}
        title="Testanalyse aktivieren"
        onMouseEnter={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.background = "#334155"; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = "0.6"; e.currentTarget.style.background = "#1E293B"; }}
      >
        <Bug size={18} />
      </button>
    );
  }

  // Active Panel
  return (
    <>
      {isDrawing && (
        <TestpilotCanvas 
          onSave={(b64) => { setScreenshot(b64); setIsDrawing(false); openMarkDialog(); }}
          onCancel={() => { setIsDrawing(false); openMarkDialog(); }}
        />
      )}
      
      {/* Floating Bar */}
      <div style={{
        position: "fixed", bottom: 16, right: 16, zIndex: 9999,
        background: "#0F172A", color: "#E2E8F0", borderRadius: expanded ? "16px" : "28px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.08)",
        fontFamily: "'Inter', 'Manrope', sans-serif", fontSize: 12,
        transition: "all 0.2s ease",
        width: expanded ? "min(460px, calc(100vw - 32px))" : "auto",
        maxHeight: expanded ? "min(500px, calc(100vh - 100px))" : "auto",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Header Bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: expanded ? "10px 14px" : "8px 14px", borderBottom: expanded ? "1px solid #1E293B" : "none", flexShrink: 0 }}>
          <Bug size={14} style={{ color: "#F97316", flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.04em" }}>TESTMODUS</span>

          {/* Error count badges */}
          {eventCount.errors > 0 && (
            <span style={{ background: "#DC2626", color: "white", borderRadius: 999, padding: "1px 7px", fontSize: 10, fontWeight: 700, minWidth: 18, textAlign: "center" }}>
              {eventCount.errors}
            </span>
          )}
          {eventCount.warnings > 0 && (
            <span style={{ background: "#EAB308", color: "#1E293B", borderRadius: 999, padding: "1px 7px", fontSize: 10, fontWeight: 700, minWidth: 18, textAlign: "center" }}>
              {eventCount.warnings}
            </span>
          )}

          <div style={{ flex: 1 }} />

          {/* Action buttons */}
          <button onClick={openMarkDialog} title="Problem markieren" style={btnStyle}>
            <Flag size={13} />
          </button>
          <button onClick={handleExport} title="Bericht exportieren" style={btnStyle}>
            <Download size={13} />
          </button>
          <button onClick={clearEvents} title="Log leeren" style={btnStyle}>
            <Trash2 size={13} />
          </button>
          <button onClick={() => setExpanded(!expanded)} title={expanded ? "Minimieren" : "Erweitern"} style={btnStyle}>
            {expanded ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          </button>
          <button onClick={toggle} title="Testmodus beenden" style={{ ...btnStyle, color: "#EF4444" }}>
            <X size={13} />
          </button>
        </div>

        {/* Expanded Log View */}
        {expanded && (
          <div style={{ flex: 1, overflowY: "auto", padding: "0" }}>
            {events.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "#64748B", fontSize: 11 }}>
                Noch keine Ereignisse. Bediene die App — Fehler werden automatisch erfasst.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {events.slice(-100).map(ev => (
                  <div key={ev.id} style={{
                    padding: "6px 14px", borderBottom: "1px solid #1E293B",
                    display: "flex", gap: 8, alignItems: "flex-start",
                    background: ev.severity === "critical" ? "rgba(220,38,38,0.08)" : ev.severity === "error" ? "rgba(249,115,22,0.05)" : "transparent",
                  }}>
                    <SevIcon severity={ev.severity} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 2 }}>
                        <TypeBadge type={ev.type} />
                        <span style={{ fontSize: 9, color: "#64748B" }}>{ev.timestamp.slice(11, 19)}</span>
                        <span style={{ fontSize: 9, color: "#475569" }}>{ev.source}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "#CBD5E1", lineHeight: 1.4, wordBreak: "break-word" }}>
                        {ev.message.slice(0, 200)}
                      </div>
                      {ev.route && <div style={{ fontSize: 9, color: "#475569", marginTop: 2 }}>{ev.route}</div>}
                      {ev.screenshot && (
                        <div style={{ marginTop: 6 }}>
                          <span style={{ fontSize: 9, color: "#475569", display: "block", marginBottom: 2 }}>Screenshot:</span>
                          <Image src={ev.screenshot} alt="Screenshot" width={getPngDataUrlDimensions(ev.screenshot).width} height={getPngDataUrlDimensions(ev.screenshot).height} unoptimized style={{ maxWidth: '100%', height: 'auto', maxHeight: 150, borderRadius: 4, border: "1px solid #334155" }} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            )}
          </div>
        )}

        {/* Non-expanded: compact info */}
        {!expanded && (
          <div style={{ padding: "0 14px 8px", display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "#64748B" }}>{eventCount.total} Ereignisse</span>
            {events.length > 0 && (
              <span style={{ fontSize: 10, color: "#475569" }}> · letztes: {events[events.length - 1]?.message.slice(0, 40)}</span>
            )}
          </div>
        )}
      </div>

      {/* Mark Problem Dialog */}
      {showMarkDialog && (
        <div style={{
          position: "fixed", 
          zIndex: 10000, 
          left: dialogPos.x, 
          top: dialogPos.y,
          background: "#1E293B", 
          borderRadius: 16, 
          padding: 20, 
          width: "min(380px, 90vw)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)",
        }} onClick={e => e.stopPropagation()}>
          <h3 
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            style={{ 
              color: "#E2E8F0", 
              fontSize: 15, 
              fontWeight: 700, 
              margin: "0 -20px 12px", 
              padding: "0 20px 12px",
              cursor: isDraggingDialog ? "grabbing" : "grab",
              borderBottom: "1px solid #334155",
              userSelect: "none",
              touchAction: "none"
            }}
          >
            🚩 Problem markieren
          </h3>
          <textarea
            value={markText}
            onChange={e => setMarkText(e.target.value)}
            placeholder="Was ist gerade schiefgelaufen? z.B. 'Button reagiert nicht' oder 'Kamera zeigt schwarz'"
            autoFocus
            style={{
              width: "100%", minHeight: 80, borderRadius: 10, border: "1px solid #334155",
              background: "#0F172A", color: "#E2E8F0", padding: "10px 12px", fontSize: 13,
              fontFamily: "inherit", resize: "vertical",
            }}
          />
          
          {screenshot ? (
            <div style={{ position: "relative", marginTop: 12, borderRadius: 8, overflow: "hidden", border: "1px solid #334155" }}>
              <Image src={screenshot} alt="Screenshot" width={getPngDataUrlDimensions(screenshot).width} height={getPngDataUrlDimensions(screenshot).height} unoptimized style={{ width: "100%", height: 'auto', maxHeight: 150, objectFit: "cover", display: "block" }} />
              <button 
                onClick={() => setScreenshot(null)}
                style={{ position: "absolute", top: 4, right: 4, background: "rgba(220,38,38,0.9)", color: "white", border: "none", borderRadius: "50%", width: 20, height: 20, display: "grid", placeItems: "center", cursor: "pointer" }}
                title="Bild entfernen"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => { setShowMarkDialog(false); setIsDrawing(true); }}
              style={{ width: "100%", marginTop: 12, padding: "8px", background: "transparent", color: "#94A3B8", border: "1px dashed #334155", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12 }}
            >
              <Camera size={14} /> Screenshot & Zeichnen
            </button>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
            <button onClick={() => setShowMarkDialog(false)} style={{ ...btnStyle, padding: "6px 14px", fontSize: 12 }}>Abbrechen</button>
            <button onClick={handleMark} style={{ padding: "6px 14px", fontSize: 12, fontWeight: 600, background: "#F97316", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}>
              Markieren
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const btnStyle: React.CSSProperties = {
  background: "none", border: "none", color: "#94A3B8", cursor: "pointer", padding: 4, borderRadius: 6,
  display: "grid", placeItems: "center",
};
