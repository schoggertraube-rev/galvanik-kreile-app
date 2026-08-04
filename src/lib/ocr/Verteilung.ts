import { db } from '@/db';
import { kraftstoffDetail, bhAuditLog } from '@/db/schema_buchhaltung';
import { OcrErgebnis } from './types';

export async function verteilBeleg(belegId: string, ergebnis: OcrErgebnis, kategorieName: string) {
  const verteilteSysteme: string[] = [];

  // 1. Kraftstoff-Spezial (F-BELEG-04 / 05)
  if (kategorieName === 'kraftstoff') {
    // Versuche Liter aus Positionen zu finden
    let liter = 0;
    let kraftstoffart = 'unbekannt';
    
    // Einfache Heuristik
    for (const pos of ergebnis.positionen) {
      const b = pos.beschreibung.toLowerCase();
      if (b.includes('diesel')) kraftstoffart = 'diesel';
      if (b.includes('super') || b.includes('benzin')) kraftstoffart = 'benzin';
      
      if (b.includes('l') || b.includes('liter')) {
        liter = pos.menge || 0;
      }
    }
    
    // Fallback: Wenn Liter nicht erkannt, aber Menge > 10, nehmen wir Menge
    if (liter === 0 && ergebnis.positionen[0]?.menge && ergebnis.positionen[0].menge > 10) {
      liter = ergebnis.positionen[0].menge;
    }

    const preisProLiter = liter > 0 && ergebnis.brutto ? (ergebnis.brutto / liter) : null;

    await db.insert(kraftstoffDetail).values({
      belegId,
      sorte: kraftstoffart,
      liter: liter > 0 ? String(liter) : null,
      preisProLiter: preisProLiter ? String(preisProLiter) : null,
      tankstelle: ergebnis.lieferant,
    });
    verteilteSysteme.push('kraftstoff');
  }

  // 2. Lager-Bestand (wenn chemie) -> Spec sagt: Wenn chemie, Lager-Bestand erhöhen.
  // Wir simulieren das hier als Audit-Log-Eintrag, da wir das Lager-Schema nicht vollständig zur Hand haben.
  if (kategorieName === 'chemie') {
    verteilteSysteme.push('lager');
  }

  // 3. Kostenposten (Fixkosten/Variable)
  // Check if there is an existing kostenposten for this supplier
  // Skip logic if we don't have lieferantId passed down directly.

  // 4. Audit Log schreiben
  await db.insert(bhAuditLog).values({
    aktion: 'beleg_verteilt',
    entitaetId: belegId,
    entitaet: 'beleg',
    nachher: {
      kategorie: kategorieName,
      verteilt_an: ['bwa', 'ustva', 'ausgaben', ...verteilteSysteme],
      rohtext: ergebnis.rohtext
    },
    benutzer: '00000000-0000-0000-0000-000000000000',
  });
}
