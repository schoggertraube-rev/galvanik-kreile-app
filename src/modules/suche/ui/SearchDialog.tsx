"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  SEARCH_MIN_QUERY_LENGTH,
  type SearchDialogProps,
  type SearchDialogState,
  type SearchHit,
  type SearchTenantResult,
} from "../server/types";
import {
  Befehlspalette,
  type DatenZustand,
  type Geraet,
  type PalettenAktion,
  type SuchTreffer,
} from "@/ui/kr";

type PresentedResult = {
  state: SearchDialogState;
  hits: SearchHit[];
  message: string;
  checkedAt: string | null;
  truncated: boolean;
  checkedSources: string[];
};

function stateForResult(result: SearchTenantResult): PresentedResult {
  switch (result.code) {
    case "OK":
      return result.hits.length > 0
        ? { state: "data", hits: result.hits, message: "", checkedAt: result.checkedAt, truncated: result.coverage.truncated, checkedSources: result.checkedSources }
        : { state: "empty", hits: [], message: `Kein Treffer für „${result.query}“ · durchsucht: ${result.checkedSources.join(", ")}.`, checkedAt: result.checkedAt, truncated: false, checkedSources: result.checkedSources };
    case "UNAUTHENTICATED":
    case "FORBIDDEN":
      return { state: "denial", hits: [], message: result.message, checkedAt: null, truncated: false, checkedSources: [] };
    case "CONFLICT":
      return { state: "conflict", hits: [], message: result.message, checkedAt: null, truncated: false, checkedSources: [] };
    case "VALIDATION_ERROR":
    case "UNAVAILABLE":
      return { state: "error", hits: [], message: result.message, checkedAt: null, truncated: false, checkedSources: [] };
  }
}

function readDevice(): Geraet {
  if (window.innerWidth <= 699) return "handy";
  if (window.innerWidth <= 1399 && window.matchMedia?.("(pointer: coarse)").matches) return "tablet";
  return "desktop";
}

function subscribeDevice(onChange: () => void) {
  const coarse = window.matchMedia?.("(pointer: coarse)");
  window.addEventListener("resize", onChange);
  coarse?.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("resize", onChange);
    coarse?.removeEventListener("change", onChange);
  };
}

const readServerDevice = (): Geraet => "desktop";

function sourceFor(hit: SearchHit): SuchTreffer["quelle"] {
  if (hit.type === "ORDER") return "Auftrag";
  if (hit.type === "CUSTOMER") return "Kunde";
  if (hit.type === "QUOTE") return "KV";
  if (hit.type === "INVOICE") return "Rechnung";
  if (hit.matchField === "note") return "Notiz";
  return "Dokument";
}

function stateForPalette(state: SearchDialogState): DatenZustand {
  if (state === "loading") return "laedt";
  if (state === "empty") return "leer";
  if (state === "denial") return "gesperrt";
  if (state === "error" || state === "conflict") return "fehler";
  return "daten";
}

export function SearchDialog({ open, onOpenChange, search, onSelect, commands, debounceMs = 220 }: SearchDialogProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSequence = useRef(0);
  const device = useSyncExternalStore(subscribeDevice, readDevice, readServerDevice);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchDialogState>("idle");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [message, setMessage] = useState("");
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [checkedSources, setCheckedSources] = useState<string[]>([]);

  const clearPending = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = null;
  }, []);

  const reset = useCallback(() => {
    requestSequence.current += 1;
    clearPending();
    setQuery("");
    setState("idle");
    setHits([]);
    setMessage("");
    setCheckedAt(null);
    setTruncated(false);
    setCheckedSources([]);
  }, [clearPending]);

  const close = useCallback(() => { reset(); onOpenChange(false); }, [onOpenChange, reset]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const isTyping = target?.matches("input, textarea, select, [contenteditable='true']") ?? false;
      const ctrlK = (event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase("de-DE") === "k";
      const slash = event.key === "/" && !isTyping && !event.ctrlKey && !event.metaKey && !event.altKey;
      if (ctrlK || slash) {
        event.preventDefault();
        if (open) close(); else onOpenChange(true);
        return;
      }
      if (open && event.key === "Escape") { event.preventDefault(); close(); }
    };
    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, [close, onOpenChange, open]);

  useEffect(() => clearPending, [clearPending]);

  const runSearch = useCallback(async (term: string) => {
    const sequence = ++requestSequence.current;
    setState("loading");
    setHits([]);
    setMessage("");
    setCheckedAt(null);
    setTruncated(false);
    setCheckedSources([]);
    try {
      const result = await search(term);
      if (sequence !== requestSequence.current) return;
      const next = stateForResult(result);
      setState(next.state);
      setHits(next.hits);
      setMessage(next.message);
      setCheckedAt(next.checkedAt);
      setTruncated(next.truncated);
      setCheckedSources(next.checkedSources);
    } catch {
      if (sequence !== requestSequence.current) return;
      setState("error");
      setHits([]);
      setMessage("Die internen Bestände konnten nicht sicher durchsucht werden.");
      setCheckedAt(null);
      setTruncated(false);
      setCheckedSources([]);
    }
  }, [search]);

  const changeQuery = useCallback((value: string) => {
    setQuery(value);
    clearPending();
    const term = value.trim();
    if (term.length < SEARCH_MIN_QUERY_LENGTH) {
      requestSequence.current += 1;
      setState("idle");
      setHits([]);
      setMessage("");
      setCheckedAt(null);
      setTruncated(false);
      setCheckedSources([]);
      return;
    }
    debounceRef.current = setTimeout(() => void runSearch(term), debounceMs);
  }, [clearPending, debounceMs, runSearch]);

  const select = useCallback((hit: SearchHit) => { onSelect(hit); close(); }, [close, onSelect]);
  if (!open || typeof document === "undefined") return null;

  const checked = checkedSources.length
    ? `Durchsucht: ${checkedSources.join(", ")}${checkedAt ? ` · ${new Date(checkedAt).toLocaleString("de-DE")}` : ""}`
    : "";
  const presentedHits: SuchTreffer[] = hits.map((hit) => ({
    key: `${hit.type}-${hit.id}`,
    titel: hit.title,
    grund: <>{`Treffer über ${hit.matchLabel}: „${hit.matchValue}“ · ${hit.context}${truncated ? " · Weitere Treffer möglich" : ""}${checked ? ` · ${checked}` : ""}`}</>,
    quelle: sourceFor(hit),
    dringend: /überfällig|kritisch|gesperrt/i.test(hit.status),
    onOeffnen: () => select(hit),
  }));
  const command = (id: PalettenAktion["id"], text: string, icon: PalettenAktion["icon"], onTun: (() => void) | undefined, kbd?: string): PalettenAktion[] => onTun ? [{ id, text, icon, kbd, onTun: () => { close(); onTun(); } }] : [];
  const actions: PalettenAktion[] = [
    ...command("eingang", "Neu erfassen", "inbox", commands?.onNewIntake, "N"),
    ...command("raus", "Ware raus", "truck", commands?.onGoodsOut),
    ...command("fertig", "Fertig melden", "check", commands?.onFinish),
    ...command("mehrarbeit", "Mehrarbeit", "layers", commands?.onExtraWork),
    ...command("woche", "Woche ansehen", "calendar", commands?.onWeek),
  ];
  const paletteState = stateForPalette(state);

  return createPortal(<Befehlspalette
    wert={query}
    onWert={changeQuery}
    treffer={presentedHits}
    aktionen={actions}
    zustand={paletteState}
    texte={{
      laedtText: "Interne Bestände werden durchsucht …",
      leerText: message || `Kein Treffer für „${query}“.`,
      fehlerText: message || "Suche nicht möglich.",
      gesperrtText: message || "Suche ist für diese Sitzung nicht freigegeben.",
    }}
    geraet={device}
    onSchliessen={close}
  />, document.body);
}
