"use client";

import type { Betriebsruhe } from "@/lib/domain/workingDays";
import { BETRIEBSRUHE_COPY } from "@/ui/situationCatalog";
import styles from "./settings.module.css";

export function BetriebsruheEditor({ zeitraeume, gesperrt, onChange }: Readonly<{
  zeitraeume: readonly Betriebsruhe[];
  gesperrt: boolean;
  onChange: (zeitraeume: readonly Betriebsruhe[]) => void;
}>) {
  function aendereDatum(index: number, feld: keyof Betriebsruhe, datum: string) {
    onChange(zeitraeume.map((zeitraum, i) => i === index ? { ...zeitraum, [feld]: datum } : zeitraum));
  }

  return <div data-spec-id="einstellungen.kalender.betriebsruhe">
    <h3>{BETRIEBSRUHE_COPY.titel}</h3>
    {zeitraeume.map((zeitraum, index) => <div className={styles.grid} key={index} role="group"
      aria-label={BETRIEBSRUHE_COPY.zeitraum(index + 1)}>
      <label>{BETRIEBSRUHE_COPY.von}<input type="date" value={zeitraum.von} disabled={gesperrt}
        onChange={event => aendereDatum(index, "von", event.target.value)} /></label>
      <label>{BETRIEBSRUHE_COPY.bis}<input type="date" value={zeitraum.bis} min={zeitraum.von || undefined}
        disabled={gesperrt} onChange={event => aendereDatum(index, "bis", event.target.value)} /></label>
      <button type="button" disabled={gesperrt} onClick={() => onChange(zeitraeume.filter((_, i) => i !== index))}>
        {BETRIEBSRUHE_COPY.entfernen}
      </button>
    </div>)}
    <button type="button" disabled={gesperrt} onClick={() => onChange([...zeitraeume, { von: "", bis: "" }])}>
      {BETRIEBSRUHE_COPY.hinzufuegen}
    </button>
  </div>;
}
