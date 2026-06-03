# 12 — AGENTS-Constraints: Modul Buchhaltung & Finanzen

**Zweck:** Ergänzung zur AGENTS.md im Projektroot. Gilt ausschließlich für die Arbeit am Modul „Buchhaltung & Finanzen". Bindet `00_PRIORITY_RULES_KREILE.md` und `SPEC_LICENSE_FEATURE_TOGGLES_v1.md` ein.

---

## 1. Geltungsbereich & Ziel

Antigravity baut das Modul **strikt nach diesem Spec-Paket** (Dateien 12–18). Kein Funktionsumfang außerhalb dieser Dateien. Ziel ist ein **funktionierendes Stufe-1-System** (erfassen, kategorisieren, auswerten, exportieren) — Livegang in Tagen.

## 2. STOPP-Bedingungen (Build sofort anhalten, Rückfrage stellen)

Antigravity STOPPT und fragt, wenn eine der folgenden Situationen eintritt:

- Eine geplante Änderung würde **bestehende Finanzdatensätze löschen oder überschreiben** (statt Storno).
- Eine Migration würde **bestehende Tabellen droppen** oder Spalten entfernen.
- Es ist unklar, ob eine bestehende „rudimentäre Buchhaltung" ersetzt oder ergänzt wird (→ Regel 4).
- Eine Funktion verlangt **ELSTER-Direktversand, Live-Bank-Buchung oder SV-Lohnmeldung** (das ist Stufe 2, nicht ohne Zertifikat/Zugang/Freigabe).
- Ein Beleg- oder Kundendatensatz soll an eine **nicht in der Spec genannte externe Adresse** gesendet werden.
- Der Git-Status ist nicht sauber (uncommittete Änderungen) bevor eine strukturelle Migration läuft.

## 3. Anti-Drift-Regeln

- **Kein Feature erfinden.** Nur was in 12–18 steht. Ideen außerhalb → als Kommentar `// VORSCHLAG (nicht bauen):` notieren, nicht implementieren.
- **Keine toten Buttons, keine Navigation ohne Funktion, keine doppelten Menüpunkte** (siehe Masterprompt).
- **Keine Tabellenoptik als Hauptdesign**; Karten + Statusfarben mit fachlicher Bedeutung.
- **Keine harte Backend-Festlegung im UI-Code** — alles über Data-Provider-Pattern.
- **Plan strikt vor opportunistischen Ergänzungen.** Im Zweifel weniger bauen, nicht mehr.
- **Eine Aktion pro Bildschirm im Vordergrund** (Hero), Rest sekundär.

## 4. Bestehende rudimentäre Buchhaltung: ersetzen vs. ergänzen

Es existiert bereits eine Buchhaltungs-/Finanzen-Kachelseite (Bestand). Regel:

| Situation | Aktion |
|---|---|
| Funktion existiert bereits identisch (z. B. DATEV-Export, Steuerberater-Paket) | **ersetzen/zusammenführen** — keine Dopplung |
| Funktion existiert bereits, aber nur als Demo/Platzhalter | **durch echte Implementierung ersetzen** |
| Funktion ist neu (Belege, Kraftstoff, KI-Hinweise, BWA, Fix/Variable, Steuerprofil, Zahlungsbereich) | **ergänzen** |
| Bestehende Funktion, die in der Spec fehlt | **erhalten und anbinden**, nicht löschen — vorher melden |

Vor dem Bauen: bestehende Buchhaltungs-Komponenten/Routen **auflisten** und gegen die Funktionsliste (Datei 14, §3) abgleichen.

## 5. Tabuzonen (nicht anfassen)

- Module außerhalb Buchhaltung (Warendurchlauf, Bäder, Kontrolle …) — nur lesend referenzieren (Umsatzdaten).
- Linke Navigations-Leiste & obere Suchzeile: **Rahmen unverändert**, nur „Buchhaltung" als fixer Menüpunkt ergänzen.
- Lizenz-/Feature-Toggle-Logik aus `SPEC_LICENSE_FEATURE_TOGGLES_v1.md`: nutzen, nicht neu erfinden.

## 6. Sicherheits-Workflow vor strukturellen Änderungen (Pflicht)

1. `git status` prüfen — sauberer Stand.
2. Commit/Snapshot anlegen: `git commit -am "F-BH-00 snapshot vor Buchhaltungsmodul"`.
3. Betroffene Dateien auflisten und im Plan benennen.
4. Migration schreiben, **review**, dann anwenden.
5. Nach Supabase-Migration **Pflicht-Workflow** (siehe Datei 18, §Go-Live) ausführen und **verifizieren**, dass die Migration wirklich auf Supabase liegt — nicht nur lokal als SQL-Datei.

## 7. Commit-Konvention

Pattern: `F-BH-XX kurze Beschreibung` (BH = Buchhaltung). Ein Commit pro abgeschlossenem, lauffähigem Schritt.
