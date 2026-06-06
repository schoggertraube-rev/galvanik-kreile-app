# 28 — Analyse-Overlays: Detail-Spec der Wirkungs-Kennzahlen

**Projekt:** Kreile WerkstattCockpit
**Version:** 1.0 · **Datum:** 2026-06-02 · **Status:** ausführungsfertig
**Bindet ein:** 19–27 (Marketing), 12–18 (Buchhaltung)
**Betrifft:** die drei Kacheln im Studio-Block „Was es bringt — diesen Monat": **Anfragen aus Marketing**, **Umsatz daraus**, **Return on Invest** — und ihre klickbaren Analyse-Overlays.

---

## 1. Ziel & Transparenzprinzip

Die Kacheln sind keine Marketing-Phrasen, sondern **nachvollziehbare Verkettungen** aus echten App-Daten. Im Analyse-Overlay sieht der Nutzer für jede Zahl:

1. **Was** gemessen wird (Definition in einem Satz)
2. **Wie** gerechnet wird (Formel + aktuelle Werte)
3. **Woher** die Daten kommen (Datenquellen-Liste, klickbar)
4. **Welche Datensätze** konkret einfließen (Drill-Down-Tabelle)
5. **Wie sicher** die Zahl ist (Datenqualität in %)
6. **Was zu tun ist**, um sie genauer zu machen (konkrete Aktionen)

Das ist gleichzeitig das Verkaufsargument: **„Jede Marketing-Zahl ist bis zum einzelnen Auftrag rückverfolgbar — keine Black Box."**

---

## 2. Verkettung Marketing → Anfrage → Auftrag → Umsatz → ROI

```
[Marketing-Modul]                    [Anfragen-Modul]            [Aufträge-Modul]         [Buchhaltung]
aktion ──erzeugt──▶ touchpoint ──▶ lead.quelle_touchpoint ──▶ auftrag.lead_id ──▶ umsatz
                                                                                  kosten_posten ─┘
                                                                                          │
                                                                                          ▼
                                                                                   ROI = Umsatz/Kosten
```

**Pflicht-Brücken** (siehe §6, neue/erweiterte Felder):
- `lead.quelle_typ`, `lead.quelle_touchpoint_id`, `lead.quelle_manuell`
- `auftrag.lead_id` (falls noch nicht vorhanden)

Ohne diese ist Attribution unmöglich. Das ist der kritische Pfad dieser Spec.

---

## 3. Kachel 1 — Anfragen aus Marketing

### 3.1 Definition
Anzahl der Anfragen (Leads) im Zeitraum, die einem Marketing-Touchpoint zugeordnet werden konnten — automatisch via UTM/Click oder manuell durch „Wie haben Sie von uns gehört?".

### 3.2 Berechnung
```sql
COUNT(lead.id)
WHERE lead.eingegangen_am ∈ Zeitraum
  AND lead.quelle_typ IN ('utm', 'mail_click', 'reaktivierung', 'manuell', 'wiederkehrer')
  AND lead.quelle_typ ≠ 'unbekannt'
```

### 3.3 Datenquellen
| Feld | Tabelle / Modul | Beschreibung |
|---|---|---|
| `lead.eingegangen_am` | Anfragen-Modul (bestehend) | Zeitstempel der Anfrage |
| `lead.quelle_typ` | Anfragen-Modul (**neu**) | Enum: utm \| mail_click \| reaktivierung \| manuell \| wiederkehrer \| unbekannt |
| `lead.quelle_touchpoint_id` | Anfragen → Marketing (**neu**) | FK auf `touchpoint` |
| `lead.quelle_manuell` | Anfragen-Modul (**neu**) | Freitext bei manueller Erfassung |
| `touchpoint` | Marketing (Datei 21) | Ausgeführte Aktion |
| `kommunikation` / `telefonnotiz` | bestehend | Telefon-/Mail-Anfragen, in denen Quelle erfasst wird |

### 3.4 Wie ein Lead seine Quelle bekommt
| Eingangskanal | Wie die Quelle gesetzt wird |
|---|---|
| Website-Formular | UTM-Parameter (`utm_campaign`, `utm_source`, `utm_medium`) aus Link → automatisch `quelle_typ='utm'` + Touchpoint-Match |
| Antwort auf Reaktivierungs-Mail | Mail-Provider-Webhook (Reply/Click) → `quelle_typ='reaktivierung'` + Touchpoint-FK |
| Instagram-DM / Profil-Klick | Stufe 2: Insights-Match; Stufe 1: manuell |
| Telefon | Mitarbeiter wählt Quelle aus Dropdown bei Telefonnotiz-Erfassung (Pflichtfeld mit Default „unbekannt") |
| Direkter Besuch / Wiederkehrer | `quelle_typ='wiederkehrer'`, wenn Kunde bekannt |

### 3.5 Drill-Down im Overlay
Tabelle aller attribuierten Leads im Zeitraum:
| Datum | Kunde | Quelle | Aktion (Touchpoint) | Status | → Auftrag |
|---|---|---|---|---|---|
| 28.05. | Schmid GmbH | Instagram-Post | Vorher/Nachher Felge | Auftrag | #8061 |
| 24.05. | Museum Lenzburg | Reaktivierungs-Mail | Mai-Reaktivierung Museen | Angebot | – |

Klick auf Zeile → Kundenkarte / Auftrag öffnen. Klick auf Aktion → Marketing-Aktion öffnen.

### 3.6 Datenqualität
```
Vertrauen = Anfragen mit eindeutiger Quelle / Anfragen gesamt
```
Anzeige: „**78 % sicher attribuiert** (18 von 23). 5 Anfragen ohne Quellangabe — [nachpflegen]"

---

## 4. Kachel 2 — Umsatz daraus

### 4.1 Definition
Summe der **bezahlten oder fakturierten** Auftragsumsätze im Zeitraum, deren Lead einer Marketing-Quelle zugeordnet ist.

### 4.2 Berechnung
```sql
SUM(auftrag.brutto)
WHERE auftrag.lead_id IN (
    SELECT id FROM lead WHERE quelle_typ ≠ 'unbekannt'
)
  AND auftrag.status IN ('fakturiert', 'bezahlt')
  AND auftrag.abgerechnet_am ∈ Zeitraum
```

Alternativ wählbar (Einstellung): `auftrag.brutto` oder `auftrag.netto`; Default brutto, weil das die Kachel zeigt.

### 4.3 Datenquellen (zusätzlich zu §3.3)
| Feld | Tabelle / Modul | Beschreibung |
|---|---|---|
| `auftrag.lead_id` | Aufträge-Modul (**neu/sicherzustellen**) | FK auf `lead` |
| `auftrag.brutto` / `netto` | Aufträge (bestehend) | Auftragswert |
| `auftrag.status`, `abgerechnet_am` | Aufträge (bestehend) | nur abgerechnete Aufträge zählen |
| `attribution` | Marketing (Datei 21) | Verknüpfung Touchpoint → Lead → Auftrag mit Modell |

### 4.4 Attribution-Modell (Stufe 1)
- **Last-Touch** (Default): Letzter Touchpoint vor der Anfrage bekommt 100 % des Auftragsumsatzes.
- **Manuell**: explizite Zuordnung durch Mitarbeiter (überschreibt Last-Touch).

Stufe 2: First-Touch, Linear (gleichmäßig auf Touchpoints des Kunden im Zeitraum). Modell ist im Overlay umschaltbar; Zahl rechnet sich live neu.

### 4.5 Drill-Down im Overlay
Tabelle aller einfließenden Aufträge:
| Auftrag | Kunde | Quelle / Aktion | Brutto | Anteil (Modell) | Datum |
|---|---|---|---|---|---|
| #8061 | Schmid GmbH | IG-Post „Felge" | 1.840 € | 100 % (Last-Touch) | 28.05. |
| #8054 | Privatkunde M. | Bewertungs-Klick | 420 € | 100 % | 22.05. |
| … | | | **Σ 5.760 €** | | |

Plus zwei Sichten zum Wechseln:
- **Nach Kanal** (Instagram 3.200 €, Mail 1.840 €, Google 720 €)
- **Nach Segment** (Oldtimer 3.200 €, Museen 1.840 €, …)

### 4.6 Datenqualität
- Anteil der Aufträge mit `lead_id` ≠ NULL
- Hinweis bei manueller Attribution: „**4 von 9 Aufträgen manuell zugeordnet** — Lerngewichte basieren bevorzugt auf automatischer Attribution."

---

## 5. Kachel 3 — Return on Invest

### 5.1 Definition
Verhältnis von attribuiertem Marketing-Umsatz zu Marketing-Kosten im Zeitraum.

### 5.2 Berechnung
```
ROI = Umsatz_attribuiert / Kosten_marketing

Kosten_marketing = SUM(kosten_posten.betrag)
WHERE kosten_posten.modul = 'marketing'
  AND kosten_posten.gebucht_am ∈ Zeitraum
```

Optionale Variante (Einstellung): **Deckungsbeitrags-ROI**
```
ROI_DB = (Umsatz × Deckungsbeitragsquote − Kosten) / Kosten
```
Deckungsbeitragsquote kommt aus Performance-/Auftragsdaten (bestehend, 27,9 % im Demo-Setup).

### 5.3 Datenquellen
| Feld | Modul | Beschreibung |
|---|---|---|
| `kosten_posten.betrag`, `modul`, `kanal`, `kampagne_id` | Buchhaltung (Datei 16/22) | Marketing-Ausgaben, automatisch beim Ausführen einer Aktion mit Budget erzeugt |
| `aufwand_zeit` (optional) | Marketing → `aktion.aufwand_min` × Stundensatz | Eigenarbeit als Kostenfaktor; per Einstellung aktivierbar |
| Deckungsbeitragsquote | Performance / Auftragsdaten | für ROI_DB |

### 5.4 Drill-Down im Overlay
Drei Blöcke:
1. **Kosten**: Aufstellung je Kanal/Kampagne (z. B. Instagram-Boost 240 €, Mailprovider-Anteil 80 €).
2. **Umsatz**: wie §4.5 verkürzt.
3. **Verhältnis**: visualisiert als Balken; Vergleich zum Vormonat (Pfeil + Δ).

### 5.5 Datenqualität
- Wenn `Kosten_marketing = 0` (häufiger Fall bei reiner Eigenarbeit) → ROI als „∞ / nicht aussagekräftig" markieren, stattdessen **Wert pro Stunde Eigenaufwand** zeigen.
- Cold-Start (zu wenig Datenmenge) → ROI als „vorläufig" markieren, ab Schwelle (z. B. 5 abgerechnete Aufträge) als stabil.

---

## 6. Erforderliche Migrationen (Brücken zwischen Modulen)

### 6.1 Erweiterung `lead` (Anfragen-Modul)
```ts
alter table lead add column quelle_typ text not null default 'unbekannt';
alter table lead add column quelle_touchpoint_id uuid references touchpoint(id);
alter table lead add column quelle_manuell text;
alter table lead add column quelle_konfidenz numeric(5,2);  -- 0..1
```

### 6.2 Sicherstellung `auftrag.lead_id`
```ts
alter table auftrag add column lead_id uuid references lead(id);
-- falls bereits vorhanden: keine Aktion. STOPP, falls Spalte mit anderem Typ existiert.
```

### 6.3 UI-Erfassung
- **Telefonnotiz** und **manuelle Anfrage-Erfassung** bekommen ein Dropdown „Wie haben Sie von uns gehört?" (Default: „weiß nicht"). Pflichtfeld nur, falls Inhaber das in Einstellungen aktiviert.
- **Website-Formular**: UTM-Parameter aus dem Anfrageformular werden direkt in `lead.quelle_*` geschrieben.
- **Reaktivierungs-Mail**: Webhook des E-Mail-Providers verknüpft Klick/Antwort mit dem Lead automatisch.

---

## 7. UI: Analyse-Overlay (verbindlich)

Statt des Platzhalter-Overlays bekommt jede der drei Kacheln dasselbe Strukturmuster:

```
┌─ Analyse: <KPI-Name> ─────────────────────────────────────────────┐
│                                                                     │
│  ① Definition         (1 Satz, einfache Sprache)                  │
│  ② Aktuelle Zahl      (große Anzeige + Vergleich zum Vormonat)    │
│  ③ Berechnung         (Formel + eingesetzte Werte)                │
│  ④ Datenqualität      (Vertrauen in % + was zur Genauigkeit fehlt)│
│  ⑤ Drill-Down         (Tabelle der einfließenden Datensätze)      │
│  ⑥ Sichten / Filter   (Zeitraum, Modell, Kanal, Segment)          │
│  ⑦ Aktionen           (Quelle nachpflegen, Modell wechseln,       │
│                         Aktion öffnen, Auftrag öffnen)             │
└────────────────────────────────────────────────────────────────────┘
```

Stilistisch im Studio-Look (Datei 26): Verlaufs-Akzent nur im Header; ansonsten ruhig, Daten im Vordergrund.

---

## 8. Vernetzung — welche App-Module geben welche Daten

| Modul (bestehend) | Liefert für Analyse | Bidirektionale Verknüpfung |
|---|---|---|
| **Anfragen** | `lead` mit Quelle | mit Marketing (`touchpoint`) + Aufträge (`auftrag.lead_id`) |
| **Aufträge** | `auftrag.brutto/netto/status` | mit Anfragen (`lead_id`) |
| **Kunden** | Stammdaten für Drill-Down + Segmentierung | mit Marketing-Segmenten |
| **Kommunikation / Telefonnotiz** | manuelle Quelle bei Anrufen/Mails | schreibt `lead.quelle_typ='manuell'` |
| **Buchhaltung** | `kosten_posten`, Deckungsbeitragsquote | mit Marketing-Aktion/Kampagne |
| **Performance** | spiegelt Kennzahlen | gleiche Datenbasis |
| **Marketing** | `aktion`, `touchpoint`, `attribution`, `kosten_posten`, `lern_metrik` | zentrale Drehscheibe |

---

## 9. Edge Cases & Fairness

| Fall | Verhalten |
|---|---|
| Keine Anfragen im Zeitraum | „Noch keine Anfragen — beste Aktion: …" (Link zu Studio) |
| Anfrage ohne Auftrag | nicht in Umsatz, aber in Anfragen gezählt; Drill-Down sichtbar |
| Auftrag ohne Lead-Verknüpfung | nicht in Umsatz daraus; im Drill-Down als „nicht attribuiert" angeboten zur Nachpflege |
| Mehrfach-Touchpoints | aktuelles Modell zeigt Anteil; Modellwechsel ändert Zahl live |
| Kosten = 0 | ROI als „∞ / Eigenarbeit" markieren; alternative Anzeige Wert/Stunde |
| Cold-Start | „vorläufig"-Markierung bis Mindest-Datenstand erreicht |

---

## 10. Datenschutz

- Drill-Downs zeigen Kunden-/Auftragsdaten → RLS prüft Rolle (`OWNER`, `ACCOUNTING` voll; `MARKETING` ohne Beträge; `EMPLOYEE` keinen Zugriff).
- Aggregate enthalten keine PII.
- Webhook-Tokens vom Mail-Provider serverseitig; kein PII in URLs.

---

## 11. Akzeptanzkriterien

- [ ] `lead.quelle_*` und `auftrag.lead_id` migriert und auf Supabase verifiziert.
- [ ] Telefonnotiz/manuelle Anfrage erfassen Quelle (Dropdown).
- [ ] Website-Formular schreibt UTM in `lead.quelle_*` automatisch.
- [ ] Reaktivierungs-Mail-Webhook verknüpft Klick mit Lead.
- [ ] Jede der drei Kacheln öffnet ein Overlay mit den 7 Sektionen (§7).
- [ ] Drill-Down-Tabellen sind klickbar (öffnen Auftrag, Lead, Aktion).
- [ ] Modellwechsel (Last-Touch ↔ Manuell) ändert Zahlen live.
- [ ] Datenqualität ist sichtbar (Vertrauens-% + konkrete Lücken).
- [ ] Cold-Start- und Null-Daten-Fälle haben definierte Anzeige.
- [ ] ROI behandelt `Kosten=0` sauber.
- [ ] Performance-Kachel „Marketing-Wirkung" zeigt die gleichen Zahlen mit derselben Berechnung.

---

## 12. Annahmen (nicht blockierend)

- `lead` und `auftrag` sind bereits eigenständige Entitäten im bestehenden System; `auftrag.lead_id` wird ergänzt, falls noch nicht vorhanden. Bei abweichender Datenmodellierung **STOPP** und melden.
- Quellenerfassung bei Telefonnotiz ist Default optional, in Einstellungen auf Pflicht stellbar.
- Deckungsbeitragsquote wird global (über alle Aufträge) ermittelt; segmentweise später möglich.

---

## 13. Verkaufsargument (für den Pitch)

> **„Jede Marketing-Zahl in Kreile WerkstattCockpit ist bis zum einzelnen Auftrag rückverfolgbar. Sie sehen nicht nur, dass etwas wirkt — Sie sehen welche Aktion welche Anfrage erzeugt hat, welche Anfrage welcher Auftrag wurde und was unterm Strich übrig blieb. Inklusive ehrlicher Anzeige, wie sicher die Zuordnung ist."**

Das ist der USP gegenüber jedem Standard-Marketing-Tool, das nur Reichweiten zeigt.
