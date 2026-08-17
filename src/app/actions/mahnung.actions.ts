'use server';

export async function sendeZahlungserinnerung(rechnungId: string) {
  void rechnungId;
  return { success: false, error: 'NOT_AVAILABLE: Sicherer W3-Command-Vertrag fehlt.' };
}

export async function sendeMahnung(rechnungId: string) {
  void rechnungId;
  return { success: false, error: 'NOT_AVAILABLE: Sicherer W3-Command-Vertrag fehlt.' };
}
