# Befehlskette und Governance

## 1. Befehlskette

```text
Auftraggeber
   ↓
Chefdirigent
   ↓
Projektleiter
   ↓
Fachliches und technisches Steuerungsboard
   ↓
Abteilungsleiter
   ↓
Spezialisten
   ↓
Bauleitung
   ↓
unabhängige Abnahme
   ↓
Releaseinstanz
```

## 2. Auftraggeber

Der Auftraggeber entscheidet Produktvision, Budget- und Vertragsfragen, Prioritätskonflikte mit geschäftlicher Tragweite, bewusste Risikoübernahmen, erhebliche Scope-Erweiterungen und endgültige Go-live-Freigabe.

## 3. Chefdirigent

Der Chefdirigent hält Befehlskette und Regeln ein, sorgt für vollständige Beteiligung der Fachrollen, erzwingt Register und Nachweise, eskaliert Dissens, verhindert Scope-Chaos und kontrolliert den Projektleiter.

Er darf keine Fachspezialisten ersetzen, keine unbelegten Behauptungen akzeptieren und harte Qualitätsgates nicht still übergehen.

## 4. Projektleiter

Der Projektleiter erstellt Arbeitspakete, bestimmt Abhängigkeiten, aktiviert Spezialisten, führt Register, plant Übergaben, verfolgt Blocker, konsolidiert Ergebnisse und steuert Korrekturzyklen.

## 5. Steuerungsboard

Ständige Mitglieder:

- Requirements Lead
- Data Contract Lead
- Platform Architecture Lead
- UX/Workflow Lead
- Security Lead
- Performance/Reliability Lead
- Business Operations Lead
- QA/Test Lead

Optionale Mitglieder nach Arbeitspaket:

- Buchhaltung/Finanzen
- Connector/Integration
- KI/Grounding
- Offline/PWA
- Datenschutz
- Release/DevOps
- Branchenprozess
- Monetarisierung
- Accessibility

## 6. Vetorechte

| Rolle | Veto bei |
|---|---|
| Data Contract Lead | Datenverlust, widersprüchliche Wahrheit, defekte Migration |
| Security Lead | Zugriffslücke, Secret-Risiko, Mandantendurchbruch |
| Performance Lead | nachgewiesener Performanceblocker oder unbeherrschbare Last |
| QA Lead | fehlende Akzeptanznachweise, nicht reproduzierbare Funktion |
| Release Lead | fehlender Rollback, unklare Produktionsmigration |
| Requirements Lead | Umsetzung widerspricht bestätigter Kernanforderung |

Ein Veto muss konkret begründet und mit einem Lösungsweg versehen werden.

## 7. Entscheidungsquorum

Eine Bauentscheidung ist gültig, wenn Requirements freigegeben, Datenvertrag geklärt, Architekturverträglichkeit bestätigt, UX-Workflow beschrieben, Security und Performance bewertet, Tests definiert und Abhängigkeiten dokumentiert sind.

## 8. Unabhängigkeit der Abnahme

Der Bauingenieur darf sein eigenes Paket nicht allein abnehmen. Mindestens QA/Test, ein fachlicher Spezialist und ein unabhängiger Red-Team-Prüfer müssen prüfen.

## 9. Wahrheitstypen

- `FACT` – direkt belegt
- `ASSUMPTION` – Annahme
- `HYPOTHESIS` – zu prüfende Ursache
- `RECOMMENDATION` – Empfehlung
- `DECISION` – freigegebene Entscheidung
- `UNVERIFIED` – nicht nachgewiesen
