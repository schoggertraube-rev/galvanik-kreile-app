/* ═══════════════════════════════════════════════════════════
   Feedback-Mail Service — Mock Implementation
   Spec: 27 §5 (Feedback-Mail nach Paketankunft)
   ═══════════════════════════════════════════════════════════ */

import { DEFAULT_FEEDBACK_CONFIG } from './feedbackMailTypes';
import type { FeedbackMail, FeedbackEingang, FeedbackMailConfig } from './feedbackMailTypes';

/** 
 * Berechnet das beste Versand-Zeitfenster basierend auf Lern-Loop
 * oder fällt auf Default-Fenster zurück.
 * Spec 27 §5.2: Pietätsabstand + beste Öffnungszeit je Segment
 */
export function berechneVersandZeitpunkt(
  ankunftAm: Date,
  segmentTyp: 'b2b' | 'b2c',
  config: FeedbackMailConfig = DEFAULT_FEEDBACK_CONFIG
): Date {
  const fenster = segmentTyp === 'b2b' ? config.defaultFensterB2B : config.defaultFensterB2C;
  
  // Pietätsabstand: frühestens X Tage nach Ankunft
  const fruehestens = new Date(ankunftAm);
  fruehestens.setDate(fruehestens.getDate() + config.pietaetsabstandTage);
  
  // Nächsten passenden Wochentag finden
  let geplant = new Date(fruehestens);
  geplant.setHours(fenster.startStunde, 0, 0, 0);
  
  // Wenn frühester Zeitpunkt schon am richtigen Wochentag + vor der Startzeit -> nehmen
  // Sonst nächsten passenden Tag suchen
  let gefunden = false;
  for (let versuche = 0; versuche < 14; versuche++) {
    const tag = geplant.getDay(); // 0=So, 1=Mo, ...
    if (fenster.wochentage.includes(tag) && geplant >= fruehestens) {
      gefunden = true;
      break;
    }
    geplant.setDate(geplant.getDate() + 1);
    geplant.setHours(fenster.startStunde, 0, 0, 0);
  }
  
  if (!gefunden) {
    // Fallback: morgen um 10 Uhr
    geplant = new Date(fruehestens);
    geplant.setDate(geplant.getDate() + 1);
    geplant.setHours(10, 0, 0, 0);
  }
  
  return geplant;
}

/**
 * Erstellt eine Feedback-Mail nach Ankunft (manuell oder Tracking)
 * Spec 27 §5.1: Auslöser, §5.3: Datenmodell
 */
export function erstelleFeedbackMail(
  auftragId: string,
  kundeId: string,
  quelle: 'manuell' | 'tracking',
  segmentTyp: 'b2b' | 'b2c' = 'b2b',
  einwilligungOk: boolean = false,
  config?: FeedbackMailConfig
): FeedbackMail {
  const jetzt = new Date();
  const geplant = berechneVersandZeitpunkt(jetzt, segmentTyp, config);
  
  return {
    id: `fm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    auftragId,
    kundeId,
    ankunftQuelle: quelle,
    ankunftAm: jetzt.toISOString(),
    geplantFuer: geplant.toISOString(),
    status: einwilligungOk ? 'geplant' : 'storniert',  // Kein Versand ohne Einwilligung!
    tokenUpload: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
    tokenFeedback: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
    einwilligungOk,
  };
}

/**
 * Verarbeitet eingehende Kunden-Rückmeldung
 * Spec 27 §5.4: Mail-Inhalt (Fotos, Google, Zufriedenheit)
 */
export function verarbeiteFeedbackEingang(
  feedbackMailId: string,
  zufriedenheit?: number,
  googleBewertungGeklickt = false,
  fotosHochgeladen = 0,
  freitext?: string
): FeedbackEingang {
  return {
    id: `fe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    feedbackMailId,
    zufriedenheit,
    googleBewertungGeklickt,
    fotosHochgeladen,
    freitext,
    eingegangenAm: new Date().toISOString(),
  };
}

/**
 * Personalisiert die E-Mail-Vorlage mit Kundendaten
 * Spec 27 §5.4: Platzhalter
 */
export function personalisiereMail(
  vorlage: string,
  kundenname: string,
  auftragsbezeichnung: string,
  feedbackLink: string,
  uploadLink: string,
  googleLink: string
): string {
  return vorlage
    .replace(/\{kundenname\}/g, kundenname)
    .replace(/\{auftragsbezeichnung\}/g, auftragsbezeichnung)
    .replace(/\{feedback_link\}/g, feedbackLink)
    .replace(/\{upload_link\}/g, uploadLink)
    .replace(/\{google_link\}/g, googleLink);
}
