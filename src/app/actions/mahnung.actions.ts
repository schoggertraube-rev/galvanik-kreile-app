"use server";

import { createClient } from "@/lib/supabase/server";
import { foundationUnavailableAction, isFoundationAreaEnabled } from "@/lib/server/foundationGate";

function assertDunningContract(): void {
  if (!isFoundationAreaEnabled("Zahlungserinnerungen und Mahnungen")) {
    foundationUnavailableAction("Zahlungserinnerungen und Mahnungen");
  }
}

export async function sendeZahlungserinnerung(rechnungId: string) {
  assertDunningContract();
  const supabase = await createClient();

  const { data: rechnung, error } = await supabase
    .from('ausgangsrechnung')
    .select('*, customer(company_name, contact_name, email)')
    .eq('id', rechnungId)
    .single();

  if (error || !rechnung) {
    console.error("Fehler beim Laden der Rechnung für Erinnerung:", error);
    throw new Error("Rechnung konnte nicht geladen werden.");
  }

  const kunde = Array.isArray(rechnung.customer) ? rechnung.customer[0] : rechnung.customer;
  const kundenName = kunde?.contact_name || kunde?.company_name || "sehr geehrte Damen und Herren";
  const empfaengerEmail = kunde?.email || "unbekannt@kunde.de";

  const brutto = Number(rechnung.brutto).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const datum = new Date(rechnung.rechnungsdatum).toLocaleDateString('de-DE');
  const faelligAm = new Date(rechnung.faellig_am).toLocaleDateString('de-DE');

  const generierterText = `Sehr geehrte/r ${kundenName},

wir erlauben uns, Sie freundlich an die offene Rechnung ${rechnung.rechnungsnummer} vom ${datum} über ${brutto} € hinzuweisen.
Die Fälligkeit war am ${faelligAm}.

Wir bitten um zeitnahe Überweisung.

Mit freundlichen Grüßen,
Galvanik Kreile`;

  await supabase.from('communication_messages').insert({
    tenant_id: 'galvanik-kreile',
    typ: 'email',
    titel: `Zahlungserinnerung Rechnung ${rechnung.rechnungsnummer}`,
    status: 'entwurf',
    empfaenger: empfaengerEmail,
    inhalt: generierterText,
    referenz_typ: 'ausgangsrechnung',
    referenz_id: rechnungId
  });

  return {
    success: true,
    modus: 'manuell',
    text: generierterText,
    empfaenger_email: empfaengerEmail,
    hinweis: "Kein E-Mail-Provider konfiguriert. Text wurde als Entwurf gespeichert. Bitte manuell versenden."
  };
}

export async function sendeMahnung(rechnungId: string) {
  assertDunningContract();
  const supabase = await createClient();

  const { data: rechnung, error } = await supabase
    .from('ausgangsrechnung')
    .select('*, customer(company_name, contact_name, email)')
    .eq('id', rechnungId)
    .single();

  if (error || !rechnung) {
    console.error("Fehler beim Laden der Rechnung für Mahnung:", error);
    throw new Error("Rechnung konnte nicht geladen werden.");
  }

  const neueMahnstufe = (rechnung.mahnstufe || 0) + 1;
  const mahngebuehr = neueMahnstufe > 1 ? 5.00 : 0.00;

  await supabase
    .from('ausgangsrechnung')
    .update({ mahnstufe: neueMahnstufe })
    .eq('id', rechnungId);

  const kunde = Array.isArray(rechnung.customer) ? rechnung.customer[0] : rechnung.customer;
  const kundenName = kunde?.contact_name || kunde?.company_name || "sehr geehrte Damen und Herren";
  const empfaengerEmail = kunde?.email || "unbekannt@kunde.de";

  const brutto = Number(rechnung.brutto).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const datum = new Date(rechnung.rechnungsdatum).toLocaleDateString('de-DE');
  
  const neueFrist = new Date();
  neueFrist.setDate(neueFrist.getDate() + 7);
  const fristStr = neueFrist.toLocaleDateString('de-DE');

  const generierterText = `Sehr geehrte/r ${kundenName},

trotz unserer vorherigen Erinnerung konnten wir bisher keinen Zahlungseingang für die Rechnung ${rechnung.rechnungsnummer} vom ${datum} über ${brutto} € feststellen.
Wir setzen Ihnen hiermit eine letzte Frist zur Begleichung bis zum ${fristStr}.
${mahngebuehr > 0 ? `Zuzüglich berechnen wir eine Mahngebühr in Höhe von ${mahngebuehr.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €.` : ''}

Bitte überweisen Sie den ausstehenden Betrag umgehend.

Mit freundlichen Grüßen,
Galvanik Kreile`;

  await supabase.from('communication_messages').insert({
    tenant_id: 'galvanik-kreile',
    typ: 'email',
    titel: `Mahnung Stufe ${neueMahnstufe} Rechnung ${rechnung.rechnungsnummer}`,
    status: 'entwurf',
    empfaenger: empfaengerEmail,
    inhalt: generierterText,
    referenz_typ: 'ausgangsrechnung',
    referenz_id: rechnungId
  });

  return {
    success: true,
    modus: 'manuell',
    text: generierterText,
    empfaenger_email: empfaengerEmail,
    neueMahnstufe: neueMahnstufe,
    hinweis: "Kein E-Mail-Provider konfiguriert. Text wurde als Entwurf gespeichert. Bitte manuell versenden."
  };
}
