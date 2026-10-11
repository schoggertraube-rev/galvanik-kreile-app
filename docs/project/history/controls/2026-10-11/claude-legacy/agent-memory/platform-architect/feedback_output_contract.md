---
name: output-contract-platform-architect
description: Jede Platform-Architect-Analyse muss im festen Reporting-Format geliefert werden (Scope → Sources → Facts → Findings[ID] → Root Causes → Contracts → Risks → Recommendations → Not Checked → Register Changes → Handoff)
metadata:
  type: feedback
---

Analysen dieser Rolle muessen strukturiert geliefert werden, nicht narrativ. Pflichtabschnitte in dieser Reihenfolge: **Scope/Abgrenzung** (was geprueft, was nicht), **gelesene Quellen** (Pfade), **Fakten** (belegt, mit Datei:Zeile), **Annahmen**, **Findings mit IDs** (F1..Fn, je mit Severity), **Root Causes**, **Vertraege/Konsumenten**, **Risiken**, **Empfehlungen**, **nicht gepruefte Bereiche**, **Registeraenderungen** (Q-IDs/Entscheidungsregister), **Handoff** (naechster Owner + Action).

**Why:** Ein Stop-Hook im Repo validiert den Outputvertrag maschinell und blockiert die Antwort, wenn Pflichtteile fehlen — inhaltliche Korrektheit allein genuegt nicht. Grund ist die Abnahmelogik aus AGENTS.md: Pruefer != Autor, und ein Reviewer muss Befund, Ursache, Risiko und Uebergabe ohne Rueckfrage trennen koennen. Ein ehrlich dokumentierter externer Blocker blockiert dagegen NICHT.

**How to apply:** Bei jeder Analyse-/Review-Anfrage (auch bei "antworte kompakt" oder einer engen Drei-Fragen-Vorgabe) das Format vollstaendig fuellen; die Frage-Antworten gehoeren in Findings + Empfehlungen, ersetzen die Struktur aber nicht. Ein Wortlimit im Auftrag kuerzt die Abschnitte, loescht sie nicht. Leere Abschnitte explizit als "keine" markieren statt weglassen. Siehe [[naht4-private-vs-public-views]].
