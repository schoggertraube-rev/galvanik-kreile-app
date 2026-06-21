# IDEA-FORMULAR (Spezifikation)

Drei Felder. So nimmt die Firma eine Idee auf und startet automatisch den Lebenszyklus.

---

## 1. Das Formular (was du eingibst)

```
1. WAS:     [freier Text — Stichworte, Sätze, egal wie roh]      ← Pflicht
2. WOFÜR:   [optional, 1 Satz: welches Problem / welcher Nutzen]  ← optional
3. ANHANG:  [optional: Screenshot, Link, Datei, Beispiel]        ← optional
```

Nur Feld 1 ist Pflicht. Lässt du WOFÜR weg und die Firma kann das Ziel nicht sicher ableiten, kommt **eine** kurze Rückfrage — kein Fragenkatalog.

---

## 2. Sofort-Antwort (was die Firma erzeugt)

```
IDEA-ID:            <Projekt-Kürzel>-<Jahr>-<lfd. Nr.>
Originalidee:       <dein Text, unverändert gespeichert>
Verstanden als:     <Ziel in einem Satz>
Betroffene Nutzer:  <welche Twins/Rollen>
Erste Einschätzung: <Quick-Win | Mission | Forschung | Klärung nötig>
Vorläufige Rollen:  <welche Spezialisten werden voraussichtlich eingestellt>
Risikoklasse:       <R0 | R1 | R2 | R3>
Nächster Schritt:   <konkret>
Rückmeldung bis:    <Datum>
Lernhinweis:        <1 Satz für den Stakeholder>
```

Die Idee wird ins `05_REGISTER/IDEA_REGISTER.md` eingetragen und bekommt einen Status aus dem Lebenszyklus (unten).

---

## 3. Einschätzungstypen

| Typ | Bedeutung | Was passiert |
|---|---|---|
| **Quick-Win** | klein, klar, geringes Risiko | direkt als kleine Mission, R0/R1 |
| **Mission** | echtes Feature/Umbau | voller Lebenszyklus, Konzept → Visual Pitch → Bau → Verifikation → Live |
| **Forschung** | offene Frage, Machbarkeit unklar | Research-Auftrag, Ergebnis als Entscheidungsvorlage |
| **Klärung nötig** | Ziel mehrdeutig | eine kurze Rückfrage an dich |

---

## 4. Ideen-Lebenszyklus (Status im Register)

```
CAPTURED → ENRICHING → DISCOVERY → CONCEPTING → VISUAL_PITCH (bei UI)
→ TWIN_REVIEW → FEASIBILITY → DECISION → PLANNED → BUILDING
→ VERIFYING → RELEASE_READY → LIVE_VERIFIED → EFFECT_MEASURED → EVOLVING
```

Zusatzstatus: `DEFERRED` · `REJECTED_WITH_REASON` · `BLOCKED_EXTERNAL` · `RESEARCH_REQUIRED`.

Keine Idee bleibt ohne Status. Keine angenommene Idee ohne Owner.

---

## 5. Regel „erst erweitern, dann begrenzen"

Bevor eine Idee an der Machbarkeit gemessen wird, wird sie **entfaltet**: vollständiger Nutzerweg, Folgeprozesse, Automatisierungen, wirtschaftliche Wirkung. Beispiel „Termin anzeigen" wird zu: Kunde ohne Auftragsnummer finden → Auftrag/Teil erkennen → Standort zeigen → Blocker erklären → Prognose mit Unsicherheit → Antwort vorbereiten → Gespräch dokumentieren → Wiedervorlage → später Prognosegüte messen. **Erst danach** Realitätsprüfung (Daten, Architektur, Security, Performance, Kosten, Recht, Migration) mit Ergebnis: Idealversion / realisierbare Version / sichere erste Stufe / Ausbaupfad.

Für triviale Quick-Wins entfällt die große Entfaltung — sonst Overkill. Der Mission Coordinator entscheidet anhand der Einschätzung.
