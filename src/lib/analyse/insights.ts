export interface KachelDaten {
  trend?: { prozent: number; positivIstGut: boolean };
  vormonat?: any;
  [key: string]: any;
}

export interface InsightAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface Insight {
  beobachtungen: string[];
  vermutungen: string[];
  vorschlaege: InsightAction[];
}

export function generateInsight(kachel: string, daten: KachelDaten): Insight {
  const beobachtungen: string[] = [];
  const vermutungen: string[] = [];
  const vorschlaege: InsightAction[] = [];

  const delta = daten.trend?.prozent || 0;

  switch (kachel) {
    case 'ustva':
      if (delta > 10) beobachtungen.push(`Zahllast ${delta}% über Vormonat.`);
      if (daten.offeneBelege > 0) {
        vermutungen.push(`Es gibt noch ${daten.offeneBelege} Belege, die die Zahllast mindern könnten.`);
        vorschlaege.push({ label: 'Ausstehende Belege prüfen', href: '/buchhaltung/belege' });
      }
      if (delta > 20) {
        vorschlaege.push({ label: 'Dauerfristverlängerung prüfen', href: '/buchhaltung/steuerprofil' });
      }
      break;

    case 'kraftstoff':
      if (delta > 10) beobachtungen.push(`Kraftstoffkosten ${delta}% über Vormonat.`);
      if (daten.tankungenCount && daten.vormonat?.tankungenCount && daten.tankungenCount > daten.vormonat.tankungenCount + 2) {
        vermutungen.push('Mehr Auslieferungen im Umland oder gestiegene Literpreise.');
      }
      if (delta > 15) {
        vorschlaege.push({ label: 'Sammelfahrten prüfen', href: '/buchhaltung/kraftstoff' });
      }
      break;

    case 'offene_posten':
      if (daten.ueberfaelligCount > 0) {
        beobachtungen.push(`${daten.ueberfaelligCount} Posten sind aktuell überfällig.`);
        vermutungen.push('Erfahrungsgemäß zahlen einige Kunden erst nach der ersten Mahnung.');
        vorschlaege.push({ label: 'Zahlungserinnerungen senden', href: '/buchhaltung/zahlung' });
      } else {
        beobachtungen.push('Alle Zahlungen sind aktuell im Zeitrahmen.');
      }
      break;

    case 'bwa':
      if (daten.materialQuote && daten.vormonat?.materialQuote && daten.materialQuote > daten.vormonat.materialQuote + 2) {
        beobachtungen.push(`Materialquote um ${daten.materialQuote - daten.vormonat.materialQuote} Punkte gestiegen.`);
        vermutungen.push('Möglicherweise sind Rohstoffpreise (z.B. Nickel) gestiegen.');
        vorschlaege.push({ label: 'Lieferantenvergleich starten', href: '/buchhaltung/ausgaben' });
      }
      break;

    case 'fixkosten':
      if (delta > 5) beobachtungen.push(`Fixkosten sind um ${delta}% gestiegen.`);
      if (daten.stromGestiegen) {
        vermutungen.push('Tariferhöhung beim Energieversorger festgestellt.');
        vorschlaege.push({ label: 'Anbieterwechsel prüfen', href: '/buchhaltung/ausgaben' });
      }
      break;

    case 'variable_kosten':
      if (delta > 10) beobachtungen.push(`Variable Kosten um ${delta}% gestiegen.`);
      break;

    case 'ausgaben_gesamt':
      if (daten.bewirtungDelta > 20) {
        beobachtungen.push(`Bewirtungskosten ${daten.bewirtungDelta}% über Vormonat.`);
        vermutungen.push('Vermutlich gab es mehrere Kundenevents.');
        vorschlaege.push({ label: 'Anlass ergänzen (§4 Abs.5 Nr.2)', href: '/buchhaltung/belege' });
      }
      break;

    case 'sparzaehler':
      if (daten.quoteAutomatisch > 90) {
        beobachtungen.push(`${Math.round(daten.quoteAutomatisch)}% automatisch kontiert.`);
        if (daten.fehlendeLieferantenMappings > 0) {
          vorschlaege.push({ label: `${daten.fehlendeLieferantenMappings} Lieferanten ohne Mapping ergänzen`, href: '/buchhaltung/steuerprofil' });
        }
      }
      break;

    case 'anfragen_marketing':
      if (daten.instaCount > daten.mailCount * 2) {
        beobachtungen.push('Instagram bringt mehr als doppelt so viele Anfragen wie E-Mail.');
        vorschlaege.push({ label: 'Vorher/Nachher-Post diese Woche planen', href: '/marketing' });
      }
      break;

    case 'umsatz_marketing':
      if (daten.topSegment === 'Oldtimer') {
        beobachtungen.push(`Oldtimer-Segment bringt ${daten.topSegmentShare}% des Marketing-Umsatzes.`);
        vorschlaege.push({ label: 'Segment verstärken', href: '/marketing' });
      }
      break;

    case 'roi_marketing':
      if (daten.emailRoi > daten.instaRoi) {
        beobachtungen.push(`E-Mail ROI (${daten.emailRoi}x) schlägt Instagram (${daten.instaRoi}x).`);
        vorschlaege.push({ label: 'E-Mail-Budget erhöhen', href: '/marketing' });
      }
      break;

    case 'zufriedenheit':
      if (daten.topSegmentScore > 4.5) {
        beobachtungen.push(`${daten.topSegmentName}-Segment hat extrem hohe Zufriedenheit (${daten.topSegmentScore}/5).`);
        vorschlaege.push({ label: 'Dieses Segment für Referenzfotos ansprechen', href: '/marketing' });
      }
      break;

    default:
      beobachtungen.push('Datenlage ist stabil.');
  }

  return { beobachtungen, vermutungen, vorschlaege };
}
