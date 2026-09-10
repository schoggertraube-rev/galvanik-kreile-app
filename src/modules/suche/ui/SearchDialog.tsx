"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { Search } from "lucide-react";
import {
  SEARCH_MIN_QUERY_LENGTH,
  type SearchDialogProps,
  type SearchDialogState,
  type SearchHit,
  type SearchTenantResult,
} from "../server/types";
import styles from "./SearchDialog.module.css";

const HIT_LABEL: Record<SearchHit["type"], string> = {
  ORDER: "Auftrag",
  CUSTOMER: "Kunde",
};

function stateForResult(result: SearchTenantResult): {
  state: SearchDialogState;
  hits: SearchHit[];
  message: string;
} {
  switch (result.code) {
    case "OK":
      return result.hits.length > 0
        ? { state: "data", hits: result.hits, message: "" }
        : {
            state: "empty",
            hits: [],
            message: `Ergebnis für „${result.query}“: Auftragsbestand und Kundenstamm wurden geprüft. Es gibt derzeit keine belegte exakte Übereinstimmung.`,
          };
    case "NOT_FOUND":
      return { state: "empty", hits: [], message: "Keine Treffer gefunden." };
    case "UNAUTHENTICATED":
    case "FORBIDDEN":
      return { state: "denial", hits: [], message: result.message };
    case "CONFLICT":
      return { state: "conflict", hits: [], message: result.message };
    case "VALIDATION_ERROR":
    case "UNAVAILABLE":
      return { state: "error", hits: [], message: result.message };
  }
}

export function SearchDialog({
  open,
  onOpenChange,
  search,
  onSelect,
  debounceMs = 220,
}: SearchDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSequence = useRef(0);
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchDialogState>("idle");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [message, setMessage] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);

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
    setActiveIndex(-1);
  }, [clearPending]);

  const close = useCallback(() => {
    reset();
    onOpenChange(false);
  }, [onOpenChange, reset]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase("de-DE") === "k") {
        event.preventDefault();
        if (open) close();
        else onOpenChange(true);
        return;
      }
      if (open && event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, [close, onOpenChange, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    return clearPending;
  }, [clearPending, open]);

  const runSearch = useCallback(async (term: string) => {
    const sequence = ++requestSequence.current;
    setState("loading");
    setHits([]);
    setMessage("");
    setActiveIndex(-1);
    try {
      const result = await search(term);
      if (sequence !== requestSequence.current) return;
      const next = stateForResult(result);
      setState(next.state);
      setHits(next.hits);
      setMessage(next.message);
      setActiveIndex(next.hits.length > 0 ? 0 : -1);
    } catch {
      if (sequence !== requestSequence.current) return;
      setState("error");
      setHits([]);
      setMessage("Suche ist derzeit nicht verfügbar.");
      setActiveIndex(-1);
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
      setActiveIndex(-1);
      return;
    }
    debounceRef.current = setTimeout(() => void runSearch(term), debounceMs);
  }, [clearPending, debounceMs, runSearch]);

  const select = useCallback((hit: SearchHit) => {
    onSelect(hit);
    close();
  }, [close, onSelect]);

  const handleInputKeyDown = useCallback((event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (state !== "data" || hits.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % hits.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + hits.length) % hits.length);
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      const hit = hits[activeIndex];
      if (hit) select(hit);
    }
  }, [activeIndex, hits, select, state]);

  if (!open) return null;
  const expanded = state === "data" && hits.length > 0;
  const activeDescendant = expanded && activeIndex >= 0
    ? `${listboxId}-option-${activeIndex}`
    : undefined;

  return (
    <div className={styles.backdrop} data-testid="search-backdrop" onMouseDown={close}>
      <section
        aria-labelledby="global-search-title"
        aria-modal="true"
        className={styles.dialog}
        data-state={state}
        data-testid="search-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Schnell finden</p>
            <h2 className={styles.title} id="global-search-title">Kunden und Aufträge</h2>
          </div>
          <button aria-label="Suche schließen" className={styles.closeButton} onClick={close} type="button">×</button>
        </header>
        <div className={styles.body}>
          <div className={styles.inputWrap}>
            <Search aria-hidden="true" size={20} strokeWidth={1.7} />
            <input
              aria-activedescendant={activeDescendant}
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-expanded={expanded}
              aria-label="Kunde, Auftrag, Teil, Material, Oberfläche oder Termin suchen"
              autoComplete="off"
              className={styles.input}
              onChange={(event) => changeQuery(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Kunde, Auftrag, Teil, Material, Oberfläche oder Termin"
              ref={inputRef}
              role="combobox"
              type="search"
              value={query}
            />
          </div>
          <p className={styles.hint}>Mindestens zwei Zeichen · ↑↓ wählen · Enter öffnen · Esc schließen</p>
          {state === "loading" ? <p aria-live="polite" className={styles.statePanel} role="status">Suche läuft …</p> : null}
          {state === "empty" ? (
            <div aria-live="polite" className={styles.statePanel} role="status">
              <p><strong>Prüfergebnis</strong></p>
              <p>{message}</p>
              <p className={styles.checked}>Geprüft: Auftragsbestand und Kundenstamm.</p>
              <p className={styles.alternatives}>Sicher weitersuchen mit Kundenname, Auftragsnummer, Teil oder Material, Oberfläche oder Datum.</p>
            </div>
          ) : null}
          {state === "denial" ? <p className={`${styles.statePanel} ${styles.denial}`} role="alert"><strong>Kein Zugriff.</strong> {message}</p> : null}
          {state === "conflict" ? <p className={`${styles.statePanel} ${styles.conflict}`} role="alert"><strong>Datenkonflikt.</strong> {message}</p> : null}
          {state === "error" ? <p className={`${styles.statePanel} ${styles.error}`} role="alert"><strong>Suche nicht möglich.</strong> {message}</p> : null}
          <ul aria-label="Suchtreffer" className={expanded ? styles.results : "hidden"} id={listboxId} role="listbox">
            {expanded ? hits.map((hit, index) => (
              <li key={`${hit.type}-${hit.id}`} role="presentation">
                <button
                  aria-selected={index === activeIndex}
                  className={styles.resultButton}
                  data-active={index === activeIndex}
                  data-hit-type={hit.type}
                  id={`${listboxId}-option-${index}`}
                  onClick={() => select(hit)}
                  onMouseEnter={() => setActiveIndex(index)}
                  role="option"
                  type="button"
                >
                  <span>
                    <span className={styles.resultTitle}>{hit.title}</span>
                    <span className={styles.resultSubtitle}>{hit.subtitle}</span>
                    <span className={styles.resultEvidence}><strong>{hit.source}</strong> · Treffer über {hit.matchLabel}: „{hit.matchValue}“</span>
                    <span className={styles.resultContext}>Zusammenhang: {hit.context}</span>
                  </span>
                  <span className={styles.resultAction}><span className={styles.type}>{HIT_LABEL[hit.type]}</span><span>{hit.actionLabel}</span></span>
                </button>
              </li>
            )) : null}
          </ul>
        </div>
      </section>
    </div>
  );
}
