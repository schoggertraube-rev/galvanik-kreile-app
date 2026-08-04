"use client";

import { useState, useRef, useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { INFO_TEXTS } from "@/lib/analytics/plainLanguage";

interface InfoPopoverProps {
  infoKey: string;
}

const subscribeToNothing = () => () => {};
const getClientMountState = () => true;
const getServerMountState = () => false;

export function InfoPopover({ infoKey }: InfoPopoverProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const mounted = useSyncExternalStore(
    subscribeToNothing,
    getClientMountState,
    getServerMountState,
  );

  const info = INFO_TEXTS[infoKey];

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (open) {
      setOpen(false);
      return;
    }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      let x = r.left;
      if (x + 280 > window.innerWidth) x = window.innerWidth - 296;
      setPos({ x, y: r.bottom + 8 });
    }
    setOpen(true);
  };

  // Close on click outside
  useEffect(() => {
    if (!info || !open) return;
    const close = () => setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [info, open]);

  if (!info) return null;

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        aria-label="Info"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 17,
          height: 17,
          borderRadius: "50%",
          border: "1px solid rgba(20,18,12,0.16)",
          color: "#928F86",
          fontSize: 10.5,
          fontWeight: 700,
          fontStyle: "italic",
          cursor: "pointer",
          background: "#FFFFFF",
          flexShrink: 0,
          lineHeight: 1,
        }}
      >
        i
      </button>

      {open && mounted && createPortal(
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            zIndex: 60,
            maxWidth: 280,
            background: "#1B1A16",
            color: "#fff",
            fontSize: 12.5,
            lineHeight: 1.55,
            padding: "12px 14px",
            borderRadius: 10,
            boxShadow: "0 2px 6px rgba(20,18,12,.06), 0 12px 32px rgba(20,18,12,.08)",
            left: pos.x,
            top: pos.y,
          }}
        >
          <div style={{ fontWeight: 650, marginBottom: 4 }}>{info.title}</div>
          <div style={{ marginBottom: 4 }}>{info.explanation}</div>
          {info.formula && (
            <code
              style={{
                fontFamily: "ui-monospace, Menlo, monospace",
                fontSize: 11.5,
                background: "rgba(255,255,255,0.12)",
                padding: "2px 6px",
                borderRadius: 5,
                display: "inline-block",
                margin: "4px 0",
              }}
            >
              {info.formula}
            </code>
          )}
          <div style={{ marginTop: 4, opacity: 0.8 }}>
            <strong>Farbe:</strong> {info.colorLogic}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
