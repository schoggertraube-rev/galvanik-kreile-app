# VISUAL-PITCH-PFLICHT

Lehre aus der katastrophalen UI-Bewertung deiner App: **UI-Vorschläge kommen nie als Text, immer als klickbares Mockup.** Du sollst sehen und bedienen, nicht lesen und raten.

---

## 1. Regel

Jede sichtbare UI-Änderung — neue Oberfläche, Redesign, neuer Flow, geänderte Navigation — durchläuft vor dem Bau einen **Visual Pitch**. Kein Code für sichtbare Änderungen, bevor du den Pitch abgesegnet hast.

Der UX Architect (Spezialist) darf die App **komplett anders aufbauen**, wenn er das für richtig hält — er muss es dir nur visualisieren, und du nimmst ab. Du hängst nicht an der Oberfläche; der Maßstab sind die Twins und die Messwerte.

---

## 2. Ablauf

```
1. UX Architect analysiert Ist-Zustand gegen Twins
   → misst konkrete Wege: "Auftrag anlegen", "Kunde finden",
     "Status in den ersten 60 Sekunden finden", "Liefertermin beantworten"
   → Befunde als Markdown (was dauert wie lange, wo verliert sich der Nutzer)
        │
        ▼
2. UX Architect baut klickbaren Prototyp
   → HTML-Mockup (im Browser bedienbar) oder Figma-Link
   → CI-konform (Galvanik-Tokens), Desktop + Tablet + Mobile
   → echte Beispieldaten, auch Fehlerzustände
        │
        ▼
3. Twin-Check
   → Prototyp gegen die Test-Aufgaben jedes relevanten Twins durchgespielt
   → dokumentiert: schafft Twin X die Aufgabe? wie schnell? wo hakt es?
        │
        ▼
4. Visual Pitch an DICH
   → du klickst selbst durch, vergleichst mit dem Alten
   → Freigabe: ja / nein, ändere X
        │
        ▼
5. Erst nach deiner Freigabe: Bau (Antigravity/Claude Code)
   → danach normale Beweispflicht + Verifier
```

---

## 3. Pitch-Format (was du bekommst)

```
VISUAL PITCH · <Bereich>
Problem heute:    <z.B. "Auftrag anlegen = 13 Klicks, > 2 Min, Nutzer verliert sich">
Messung Ist:      <konkrete Zahlen aus dem 60-Sek-/Klick-Test>
Vorschlag:        <Link zum klickbaren Mockup>
Was anders ist:   <2–3 Stichpunkte: was der Vorschlag besser macht>
Twin-Check:       <Twin → schafft Aufgabe in X Sek / hakt bei Y>
Messbarer Gewinn: <z.B. "Auftrag in < 30 Sek, Status in < 10 Sek">
Risiko/Aufwand:   <kurz>
Deine Freigabe:   [ ] ja   [ ] nein, ändere: ______
```

---

## 4. Messgrößen, die ein Pitch belegen muss

| Frage | Zielwert (Beispiel, projektabhängig) |
|---|---|
| Findet sich ein neuer Nutzer in den ersten 60 Sek zurecht? | versteht Hauptfunktion ohne Erklärung |
| Wie lange dauert „Auftrag anlegen"? | < 30 Sek |
| Wie lange dauert „Kunde finden"? | < 10 Sek |
| Wie lange bis „Liefertermin beantworten"? | < 30 Sek |
| Klicks bis zum Ziel | so wenig wie möglich, gemessen |

Die echten Zielwerte legen wir aus deinen Twins ab. Der Pitch muss zeigen, dass der Vorschlag sie trifft — sonst keine Freigabe.

---

## 5. Werkzeuge des UX Architect

Claude-Design-Skills (real, im Setup verankert): `frontend-design`, `design-system`, `design-critique`, `ux-copy`, `accessibility-review`, `design-handoff`. Plus Figma-Connector für Prototypen. Das ist das, was ein Solo-Weltklasse-Designer im Team braucht: CI-konforme UI, automatische A11y-Reviews, saubere Handoff-Specs für den Builder.
