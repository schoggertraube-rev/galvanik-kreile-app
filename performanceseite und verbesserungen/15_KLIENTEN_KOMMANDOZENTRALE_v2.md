# 15_KLIENTEN_KOMMANDOZENTRALE_v2.md

**Projekt:** Galvanik Kreile · WerkstattCockpit
**Modul:** Klienten-Kommandozentrale
**Status:** Aktiv · **überschreibt v1**
**Begleitdokument:** `kreile_kommandozentrale_v2.html`

---

## 1. Ziel

Aus dem „Kommzentrale"-Button in der Kommunikationszentrale eine vollständige, klientenzentrierte Arbeitsfläche öffnen. Alle Informationen zu diesem Kunden ohne Suchen, Nachfragen oder Kanalwechsel. Chat zentral, Klient- und Vorgangsdaten als Kacheln drumherum, relevante Themen automatisch hervorgehoben.

**Leitsatz:** Man konzentriert sich komplett auf diesen einen Kunden. Nichts zusammensuchen.

---

## 2. Trigger

Der Button „Kommzentrale" existiert bereits im Chat-Header der Kommunikationszentrale. Bei Klick öffnet sich die Kommandozentrale als Vollbild-Fokus-Overlay (blur backdrop über Layer 0). Schließen per ‹ Zurück, X oder ESC.

Liquid-Open: clip-path-Circle-Morph vom Buttonpunkt, ~0,7 s, weiches Easing. Kacheln cascaden gestaffelt ein.

---

## 3. Layout (Tablet/Desktop)

```
┌───────────────────────────────────────────────────────────────────────┐
│ ‹ Zurück │ [Avatar] Name · A-Kunde · Tags           [Smart|Alles] [X]│
├──────────────┬─────────────────────────────┬──────────────────────────┤
│ BENTO LINKS  │ CHAT (alle Kanäle, zentral) │ BENTO RECHTS             │
│ „Klient"     │ Inline-Highlights klickbar  │ „Dieser Vorgang"         │
│ ~380 px      │ Composer unten              │ ~360 px                  │
│              │ flex, min 420 px            │                          │
└──────────────┴─────────────────────────────┴──────────────────────────┘
```

---

## 4. Chat zentral

Zeigt den Gesprächsverlauf aller Kanäle chronologisch. Jede Nachricht ist gekennzeichnet:

| Kanal | Markierung |
|---|---|
| E-Mail | 📧 E-Mail |
| Telefonnotiz | 📞-Symbol + „Telefonnotiz" |
| WhatsApp | 💬 WhatsApp |
| Instagram | 📷 Instagram |
| Website | 🌐 Website |
| SMS | 📱 SMS |
| Interne Notiz | 📝 Intern |

Anhänge werden inline angezeigt (Thumbnail + Name + Größe), klickbar → öffnet Anhänge-Detail.

**Inline-Highlighting:** Erkannte Begriffe im Text sind leicht farbig hinterlegt und klickbar. Schema identisch zur Telefonnotiz:

| Entität | Farbe |
|---|---|
| Kunde | blau |
| Auftrag | violett |
| Zahlung | orange |
| Termin | grün |

Klick auf Inline-Highlight → öffnet zugehöriges Kachel-Detail.

Composer unten: Kanalwahl + Anhang + Senden. Voll funktional.

---

## 5. Kachel-System

### 5.1 Drei Zustände

| Zustand | Visuell | Bedeutung |
|---|---|---|
| **grau** | neutral | Daten vorhanden, nicht im aktuellen Gesprächsthema |
| **blau** | blauer Linksstreifen + blauer Hintergrund | Texterkennung hat Bezug erkannt |
| **dim** (Smart-Modus) | reduzierte Deckkraft | nicht relevant, tritt zurück |

### 5.2 Dynamische Größe

| Kriterium | Bento-Span |
|---|---|
| relevant (blau) + mehrzeilige Daten | groß (span 2) |
| relevant (blau) + simpel | span 2, kompakte Höhe |
| grau + komplex | span 2 |
| grau + eine Kennzahl | span 1 |

Im **Smart-Modus** (Default): relevante Kacheln oben + groß, Rest tritt zurück.
Im **Alles-Modus**: alle gleichberechtigt sichtbar.

Keine Prozess-Meta, keine Confidence. Erkennung zeigt sich nur als Inline-Highlight + blaue Kachel.

### 5.3 Kachel-Katalog

**Links — Klient:**

| Kachel | Schlüsselwerte | Relevanz-Trigger | Detail |
|---|---|---|---|
| Zahlung | offener Betrag, Moral, ⌀ Tage | zahlung/rechnung/bar/offen | Balken-Verlauf + Scorecards + Belegtabelle |
| Offene Aufträge | Liste + Status-Pills | Auftragsnr. / auftrag | Tabelle + Volumen-Trend |
| Auftragsverlauf | Gesamt + Sparkline | — | Linie + Material-Donut + Scorecards |
| Reklamationen | Anzahl | reklamation/mangel/defekt | Score oder Cluster-Tabelle |
| Kommunikation | Kontakte pro Kanal | — | Kanal-Donut + Kontakt-Verlauf |
| Stammdaten | Telefon, Adresse | kunde/name | Volltabelle + Bearbeiten |
| Notizen & Tags | Freitext + Tags | — | Notiz-Editor |

**Rechts — Dieser Vorgang:**

| Kachel | Inhalt |
|---|---|
| Vorbereitete Aktionen | Kalender/Auftrag/Notiz/Mahnung mit auto/prüfen-Tags + „Alle anwenden" |
| Kalender | Wunschtermin geprüft (frei/Konflikt) |
| Antwort-Vorschlag | fertige Antwort + „Übernehmen" |
| Anhänge | Dateien des Klienten, Thumbnail + Meta |
| Schnellzugriff | Wo ist Ware? · Zahlung |

**Bewusst entfernt:** Lager/Material-Kachel.

### 5.4 Kachel-Detail

Klick auf Kachel → vorgelagertes Detail-Overlay mit einheitlichem Aufbau:

```
Scorecards oben → 1-2 Charts → Datentabelle → Aktions-Footer
```

Jedes Detail hat 0–2 kontextuelle Aktionen (Zahlungserinnerung, Termin eintragen, Etikett drucken, Bearbeiten etc.).

---

## 6. Texterkennung

Gleiche Matching-Engine wie Telefonnotiz (lokal + Gemini). Kein doppelter Code. Output steuert:

1. Inline-Highlight im Chat
2. Blaue Kachel-Hervorhebung + Größe

Keine separate „Erkannte Themen"-Kachel.

---

## 7. Visualisierungs-Schemata (Recharts)

Sechs Standard-Schemata, damit Antigravity nicht improvisiert:

| Schema | Recharts | Einsatz |
|---|---|---|
| Verlaufs-Balken | `BarChart` | Zahlungen/Kontakte pro Monat |
| Trend-Linie | `AreaChart` | Auftragsvolumen pro Jahr |
| Verteilung | `PieChart` (Donut) | Kanal-/Materialverteilung |
| Scorecards | eigene Cards | Kennzahlen |
| Datentabelle | HTML-Table | Belege, Aufträge, Anhänge |
| Status-Flow | eigene Step-Komponente | Warenstandort, Kalender-Tagesansicht |

---

## 8. Anti-Sackgasse beim Schließen

| Zustand | Verhalten |
|---|---|
| Alle Aktionen erledigt / nichts offen | sauberes Schließen |
| Pending Actions | automatisches Zwischenspeichern → `automation_status='pending_review'` → Tagesfokus · Toast |
| Ungesendeter Composer-Entwurf | Draft in `message_drafts`, beim nächsten Öffnen wiederhergestellt |

Kein Datenverlust, keine stille Sackgasse.

---

## 9. Mobile

Tablet/Desktop = volle Kommandozentrale. Smartphone:

- Chat-View wie gewohnt
- Erkannte Schlagworte sind tippbar → Kachel-Detail vorgelagert als Bottom-Sheet
- Schließen per Wegwisch-Geste
- Kein Bento-Grid auf dem Handy

---

## 10. Datenmodell

### Ein Dossier-RPC

```sql
create or replace function get_client_dossier(p_customer_id uuid)
returns jsonb language plpgsql security definer as $$
begin
  return jsonb_build_object(
    'stamm',       (select to_jsonb(c) from customers c where c.id = p_customer_id),
    'open_orders', (select coalesce(jsonb_agg(o), '[]') from orders o
                     where o.customer_id = p_customer_id and o.status <> 'done'),
    'order_stats', (select jsonb_build_object('total', count(*), 'revenue', coalesce(sum(amount),0))
                     from orders where customer_id = p_customer_id),
    'payments',    (select jsonb_build_object(
                      'open_total', coalesce(sum(amount) filter (where status='open'),0),
                      'invoices', coalesce(jsonb_agg(i), '[]'))
                     from invoices i where i.customer_id = p_customer_id),
    'complaints',  (select jsonb_build_object('count', count(*))
                     from complaints where customer_id = p_customer_id),
    'comm_stats',  (select coalesce(jsonb_object_agg(channel, cnt), '{}') from (
                      select channel, count(*) cnt from messages
                      where customer_id = p_customer_id group by channel) t),
    'attachments', (select coalesce(jsonb_agg(a), '[]') from message_attachments a
                     join messages m on m.id = a.message_id
                     where m.customer_id = p_customer_id),
    'calendar',    (select coalesce(jsonb_agg(e), '[]') from calendar_events e
                     where e.starts_at between now() and now() + interval '14 days')
  );
end; $$;
```

Client-seitig 60 s Cache, Realtime-Invalidierung bei neuer Nachricht.
Keine neuen Tabellen nötig.

---

## 11. Komponentenstruktur

```
src/components/kommunikation/kommandozentrale/
├── Kommandozentrale.tsx            Overlay-Shell, Liquid-Open
├── BentoGrid.tsx                   links/rechts, Smart-Sortierung
├── ClientTile.tsx                  generisch (type, relevant, size)
├── ClientTileDetail.tsx            Detail-Layer (type → Recharts)
├── charts/                         VerlaufBars, TrendLine, Donut, Scorecards, Flow
└── hooks/
    ├── useClientDossier.ts         RPC + Cache
    └── useTopicRelevance.ts        Texterkennung → relevante Kachel-Keys
```

`ClientTile` + `ClientTileDetail` wiederverwendbar in Kundenakte und Performance-Dashboard.

---

## 12. Bauplan (3 Phasen)

### Phase A — Overlay + Bento + Dossier (2 Tage)

- `get_client_dossier`-RPC
- Kommandozentrale-Overlay mit Liquid-Open
- BentoGrid mit `ClientTile`
- Chat zentral mit Kanal-Kennzeichnung
- Schließen mit Anti-Sackgasse-Zwischenspeichern
- **Akzeptanz:** Trigger öffnet Overlay, Kacheln zeigen echte Daten aus 1 RPC, Schließen mit pending speichert zwischen

### Phase B — Relevanz + Inline-Highlight (1,5 Tage)

- `useTopicRelevance` auf bestehender Matching-Engine
- Inline-Highlight klickbar
- Blaue Kacheln + dynamische Größe + Smart/Alles-Toggle
- **Akzeptanz:** Begriffe im Chat farbig markiert, Klick öffnet Detail, blaue Kacheln im Smart-Modus prominenter

### Phase C — Detail-Layer + Recharts + Aktionen (2 Tage)

- `ClientTileDetail` mit 6 Visualisierungs-Schemata
- Recharts-Charts
- Detail-Aktionen
- Composer + Action-Executor voll funktional
- **Akzeptanz:** Jede Kachel öffnet Detail (Scorecards → Chart → Tabelle → Aktion), Antworten/Aktionen aus Kommandozentrale möglich

---

## 13. Akzeptanzkriterien Gesamt

- [ ] Öffnet als Vollbild-Overlay via bestehendem „Kommzentrale"-Button
- [ ] Liquid-Open-Animation vom Buttonpunkt
- [ ] Ein RPC lädt alle Kacheldaten
- [ ] Relevante Kacheln blau + größer, Smart-Modus default
- [ ] Inline-Highlight im Chat klickbar → Detail
- [ ] Alle Kanäle mit Symbol gekennzeichnet, Telefonnotizen als 📞-Nachricht
- [ ] Anhänge inline im Chat + in Anhänge-Kachel
- [ ] Kein Lager/Material-Kachel
- [ ] Keine Prozess-Meta/Confidence
- [ ] Jede Kachel → einheitliches Detail (Scorecards, Chart, Tabelle, Aktion)
- [ ] Composer + Aktionen voll funktional
- [ ] Schließen mit pending → Zwischenspeichern + Toast
- [ ] Layer-weises Schließen (ESC)
- [ ] Design-Tokens konsistent (Cream, Fraunces, Manrope)

---

## 14. STOPP-Bedingungen

- Schreibzugriff auf bestehende Tabellen-Spalten die nicht additiv sind → STOPP
- Recharts-Bundle sprengt PWA-Performance → melden, Lazy-Load prüfen
- Liquid-Animation ruckelt auf Ziel-Hardware → Fallback einfaches Fade

---

## 15. Nächster Schritt

Diese Spec reiht sich hinter 12–14 ein. Antigravity-Diagnose-Ergänzung:

```
Zusätzlich prüfen für Kommandozentrale (15):
- Existieren alle für get_client_dossier nötigen Tabellen?
- Ist Recharts bereits im Projekt?
- Performance-Budget: clip-path-Animation auf Tablet-Hardware?
```

---

**Ende v2.**
