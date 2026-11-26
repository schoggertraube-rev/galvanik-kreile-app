import 'server-only';

/** MAIL_PROZESSLOGIK §1. Each capability retains the conditions named in its entry. */
const mailWirkungen={
  A1:['kunde_ohne_dublette_anlegen','kv_entwurf_anlegen','kv_anhang_ablegen','antwort_senden'],
  A2:['kv_zusage_ablegen','auftrag_aus_kv_anlegen','auftragsbestaetigung_senden'],
  A3:['kv_absage_ablegen','kv_neufassung_entwerfen','antwort_senden'],
  A4:['auftrag_mit_preisquelle_anlegen','kv_entwurf_anlegen','auftragsbestaetigung_senden'],
  A5:['lieferavis_vormerken','lieferschein_am_auftrag_ablegen','antwort_senden'],
  A6:['anhang_ablegen','zeichnung_fassung_ablegen','kv_neufassung_vorschlagen','rueckfrage_senden','antwort_senden'],
  A7:['mengenwunsch_vormerken','aufgabe_buero','kv_neufassung_entwerfen','antwort_senden'],
  A8:['wunschtermin_vormerken','antwort_senden'],
  A9:['uebergabeart_vormerken','abholtermin_vormerken','lieferanschrift_abgleichen','antwort_senden'],
  A10:['abholer_vormerken','antwort_senden'],
  A11:['auftragsadresse_vormerken','stammdaten_bestaetigung_anfordern','antwort_senden'],
  A12:['reklamation_aufnehmen','mahnstopp_vormerken','antwort_senden'],
  A13:['ruecksendung_erwarten','antwort_senden'],
  A14:['rechnungskopie_senden','zahlungsavis_vormerken','aufgabe_buchhaltung','mahnstopp_vormerken','antwort_senden'],
  A15:['stornowunsch_vormerken','aufgabe_buero','antwort_senden'],
  A16:['antwort_senden','stand_bei_werkstatt_anfordern'],
  A17:['vorhandenes_dokument_senden','aufgabe_werkstatt'],
  A18:['antwort_am_anliegen_ablegen','mehrarbeitsfreigabe_vormerken','antwort_senden'],
  A19:['rechnung_im_belegzugang_ablegen','lieferschein_an_bestellung_ablegen'],
  A20:['spedition_einzeltermin_verlegen','betroffene_pakete_markieren'],
  A21:['auf_kundenantwort_warten'],
  A22:['ungebundene_mail_aussortieren'],
  A23:['auswahl_anzeigen','rueckfrage_senden'],
} as const;

export type MailAnliegen=keyof typeof mailWirkungen;
export type MailWirkung=typeof mailWirkungen[MailAnliegen][number];

export function erlaubteWirkung(anliegen:string,wirkung:string):boolean{
  if(!Object.hasOwn(mailWirkungen,anliegen))return false;
  const erlaubt:readonly string[]=mailWirkungen[anliegen as MailAnliegen];
  return erlaubt.includes(wirkung);
}
