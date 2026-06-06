/* ═══════════════════════════════════════════════════════════
   Feedback-Mail Pipeline — Types
   Spec: 27 §5 (Feedback-Mail nach Paketankunft)
   ═══════════════════════════════════════════════════════════ */

/** Auslöser für die Feedback-Mail */
export type AnkunftQuelle = 'manuell' | 'tracking';

/** Status der Feedback-Mail */
export type FeedbackMailStatus = 'geplant' | 'gesendet' | 'geoeffnet' | 'reagiert' | 'storniert';

/** Feedback-Mail-Datensatz */
export interface FeedbackMail {
  id: string;
  auftragId: string;
  kundeId: string;
  segmentId?: string;
  ankunftQuelle: AnkunftQuelle;
  ankunftAm: string;          // ISO timestamp
  geplantFuer: string;         // ISO timestamp — aus Lern-Loop
  status: FeedbackMailStatus;
  gesendetAm?: string;
  tokenUpload: string;         // signierter Link für Foto-Upload
  tokenFeedback: string;       // signierter Link für 1-Klick-Zufriedenheit
  einwilligungOk: boolean;
}

/** Eingehende Rückmeldung eines Kunden */
export interface FeedbackEingang {
  id: string;
  feedbackMailId: string;
  zufriedenheit?: number;       // 1–5 (Sterne)
  googleBewertungGeklickt: boolean;
  fotosHochgeladen: number;
  freitext?: string;
  eingegangenAm: string;
}

/** Konfiguration für die Feedback-Mail */
export interface FeedbackMailConfig {
  pietaetsabstandTage: number;        // Default 1
  defaultFensterB2B: { wochentage: number[]; startStunde: number; endStunde: number };
  defaultFensterB2C: { wochentage: number[]; startStunde: number; endStunde: number };
  googlePlaceId?: string;
  mailVorlageBetreff: string;
  mailVorlageText: string;
}

/** Default Konfiguration */
export const DEFAULT_FEEDBACK_CONFIG: FeedbackMailConfig = {
  pietaetsabstandTage: 1,
  defaultFensterB2B: { wochentage: [2, 3, 4], startStunde: 9, endStunde: 11 },  // Di–Do 09–11
  defaultFensterB2C: { wochentage: [1, 2, 3, 4, 5], startStunde: 18, endStunde: 20 },  // Mo–Fr 18–20
  mailVorlageBetreff: 'Vielen Dank für Ihren Auftrag, {kundenname}!',
  mailVorlageText: `Liebe/r {kundenname},

vielen Dank, dass Sie uns Ihr Vertrauen geschenkt haben! Wir hoffen, dass Sie mit dem Ergebnis an Ihrem {auftragsbezeichnung} zufrieden sind.

Wir würden uns riesig freuen, wenn Sie uns ein kurzes Feedback geben — das hilft uns und anderen Kunden enorm:

⭐ Wie zufrieden sind Sie? (1 Klick)
{feedback_link}

📸 Fotos der eingebauten/aufgestellten Ware
Falls Sie mögen, schicken Sie uns gern ein Foto — wir lieben es zu sehen, wie unsere Arbeit in der Praxis aussieht!
{upload_link}

🌟 Google-Bewertung
Über eine kurze Google-Bewertung würden wir uns sehr freuen:
{google_link}

Herzliche Grüße aus der Werkstatt,
Ihr Team von Galvanik Kreile

PS: Diese Fotos dürfen wir gern für unsere Außendarstellung nutzen, wenn Sie im Upload-Formular zustimmen. Natürlich nur dann!`,
};
