# 22 — Integrationen & Kanäle: Modul Marketing

**Version:** 1.0 · **Datum:** 2026-06-02
**Bindet ein:** 20 (Hauptspec), 21 (Datenmodell)
**Grundsatz:** jeder Kanal hinter einem `ChannelAdapter`; Keys/Tokens serverseitig; ehrliche Stufen-Trennung; nichts postet ohne Freigabe + aktivem Toggle.

---

## 1. Adapter-Architektur (Pflicht)

```ts
interface ChannelAdapter {
  id: 'instagram' | 'google' | 'email' | 'web';
  isConnected(): Promise<boolean>;
  publish(aktion: Aktion): Promise<Touchpoint>;     // postet/sendet ODER plant
  fetchInsights(touchpoint: Touchpoint): Promise<Insights>;
}
// MockChannelAdapter für Demo + je Kanal eine echte Implementierung.
```

UI ruft nie ein Channel-SDK direkt. Ausführung immer: Aktion freigegeben → `adapter.publish()` → `touchpoint` gespeichert → Tracking startet.

## 2. Instagram (Meta Graph API) — Stufe 1 (Insights) / Stufe 1–2 (Posten)

**Verifizierte Bedingungen (Stand 2026):**
- Posten/Insights nur mit **Instagram-Professional-Konto (Business/Creator)**, verbunden mit einer **Facebook-Seite**; persönliche Konten können **nicht** über die API posten.
- Eigene **Meta-Developer-App** + Berechtigungen `instagram_basic`, `instagram_content_publish`.
- **Meta App Review** für Produktivbetrieb über 25 Test-Nutzer hinaus — Vorlauf **ca. 2–4 Wochen** pro Einreichung.
- Veröffentlichen = **zweistufig**: `POST /{ig-user-id}/media` (Container) → `POST /{ig-user-id}/media_publish`. Container-Verarbeitung kurz abwarten.
- Limits: ~**25 API-Posts / 24 h**, ~200 Requests/h. Token: kurz- → langlebig (60 Tage), Refresh-Logik nötig.
- OAuth: Facebook-Login → Code → kurzlebiges → langlebiges Token; IG-Business-ID über die verknüpfte Seite ermitteln; Token sicher speichern.

**Konsequenz für den Build:** `InstagramAdapter` jetzt gegen die Graph-API bauen, aber **scharf erst nach App-Review** (Feature-Flag). Bis dahin: Aktion erzeugt einen **freigegebenen Entwurf** + Erinnerung „manuell posten" und trackt per UTM-Link in der Bio/Story. **Antrag App-Review sofort starten.**

## 3. Google Unternehmensprofil — Stufe 2

- Beiträge und Bewertungsanfragen über die Google-Business-Profile-APIs (App-Freigabe/Quota erforderlich).
- **Stufe 1:** Bewertungsanfrage als vorbereiteter Link/QR an zufriedene Kunden (kein API-Zwang). **Stufe 2:** Beiträge per API.
- `GoogleAdapter` mit Mock; echte Aktivierung per Flag nach Freigabe.

## 4. E-Mail / Reaktivierung — Stufe 1 (voll)

- Versandprovider (Brevo / Resend / Postmark — Wahl offen, DSGVO + Zustellbarkeit). EU-Datenhaltung bevorzugt.
- **Pflicht:** `einwilligung`-Prüfung vor Versand (Datei 21/24); Abmeldelink in jeder Mail; Bounce-/Beschwerde-Handling.
- Personalisierte Mail je Reaktivierungskandidat (Bestandsfunktion), Versandfenster-Empfehlung aus Lern-Loop.
- Tracking: Öffnungen/Klicks via Provider-Webhook → `touchpoint`. **Öffnungs-Tracking nur mit Consent** (Datei 24).

## 5. Website / Anzeigen — Stufe 1 (UTM) / Stufe 2 (Ads)

- **Stufe 1:** UTM-Parameter auf allen Links + Anbindung an das Anfrageformular der Website → `lead` mit Quelle. Damit ist Web→Anfrage→Auftrag→Umsatz real attribuierbar, ohne Werbekonto.
- **Stufe 2:** Werbekonto-Anbindung (Meta/Google Ads) für bezahlte Anzeigen + Budget/Prognose.
- `WebAdapter` liest UTM-Leads; `AdsAdapter` Stufe 2.

## 6. Verknüpfung Buchhaltung & Performance (Vollintegration)

| Ereignis | Wirkung |
|---|---|
| Aktion mit Budget ausgeführt | `kosten_posten` → Buchhaltung-Ausgabe „Marketing / {Kanal}" |
| Attribution mit Umsatz | Performance-Kachel „Marketing-Wirkung" + Buchhaltung „Umsatz nach Quelle" |
| Reaktivierung führt zu Auftrag | Auftrag erhält Quelle „Reaktivierung {Segment}" |

Keine doppelte Datenhaltung: Marketing schreibt in dieselben Finanz-/Auftragstabellen über definierte Schnittstellen.

## 7. KI-Ideengebung & Texte

- LLM erzeugt **Vorschlagstexte, Bildunterschriften, Hashtags, Mailentwürfe** — immer als **Entwurf zur Freigabe**, nie Auto-Versand.
- Eingaben: Auftragsfotos (Vorher-/Nachher), Segment, Anlass, Lern-Insights.
- Bildquelle bevorzugt echte Auftragsfotos (Asset-Verknüpfung), keine erfundenen Referenzen.
- LLM serverseitig; keine Kundendaten ohne Notwendigkeit an das Modell.

## 8. Sicherheit

Alle Tokens/Keys serverseitig (Secrets). OAuth-Tokens verschlüsselt at-rest, Refresh serverseitig. Rate-Limits abfangen (Backoff). Kein Token im Client-Bundle.

## 9. Akzeptanzkriterien

- [ ] `ChannelAdapter`-Interface + MockAdapter + mind. `EmailAdapter` (Stufe 1) real.
- [ ] `InstagramAdapter` gebaut, hinter Flag bis App-Review; Entwurf+UTM-Fallback funktioniert.
- [ ] UTM-Leads erscheinen als `lead` mit Quelle; Web-Attribution end-to-end.
- [ ] E-Mail prüft Einwilligung, enthält Abmeldelink, trackt nur mit Consent.
- [ ] Kosten/Umsatz landen automatisch in Buchhaltung/Performance.
- [ ] KI-Texte immer Entwurf; kein Auto-Versand/Auto-Post.
- [ ] Keine Tokens im Client.
