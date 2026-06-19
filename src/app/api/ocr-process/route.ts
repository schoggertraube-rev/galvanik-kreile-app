import { NextResponse } from 'next/server';
import { db } from '@/db';
import { beleg, kategorie, lieferant } from '@/db/schema_buchhaltung';
import { KlippaProvider } from '@/lib/ocr/KlippaProvider';
import { GeminiProvider } from '@/lib/ocr/GeminiProvider';
import { verteilBeleg } from '@/lib/ocr/Verteilung';
import { ilike } from 'drizzle-orm';
import { readAppSession } from '@/lib/server/appSession';

export async function POST(req: Request) {
  try {
    const { storagePath } = await req.json();

    if (!storagePath) {
      return NextResponse.json({ error: 'storagePath missing' }, { status: 400 });
    }

    // Determine Provider
    const hasKlippa = !!process.env.KLIPPA_API_KEY;
    const provider = hasKlippa ? new KlippaProvider() : new GeminiProvider();
    
    // Wir können bei Supabase den Public URL abfragen, falls es public ist
    // Da wir hier nur Pfade speichern, simulieren wir die Extraktion
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const imageUrl = `${supabaseUrl}/storage/v1/object/public/belege/${storagePath}`;
    
    // OCR Durchführen (F-BELEG-03)
    const ergebnis = await provider.extractBeleg(imageUrl);
    
    // Kategorisierung (F-BELEG-04)
    const text = ergebnis.rohtext.toLowerCase();
    let kategorieName = 'sonstig';
    if (text.includes('diesel') || text.includes('benzin') || text.includes('tankstelle') || text.includes('aral') || text.includes('shell')) {
      kategorieName = 'kraftstoff';
    } else if (text.includes('strom') || text.includes('mainova') || text.includes('kwh')) {
      kategorieName = 'energie';
    } else if (text.includes('nickel') || text.includes('chemie') || text.includes('galvanik')) {
      kategorieName = 'chemie';
    } else if (text.includes('büro') || text.includes('papier') || text.includes('toner')) {
      kategorieName = 'buero';
    } else if (text.includes('bewirtung') || text.includes('restaurant')) {
      kategorieName = 'bewirtung';
    }

    // Kategorie ID auflösen
    const katRows = await db.select().from(kategorie).where(ilike(kategorie.name, kategorieName));
    let katId = katRows.length > 0 ? katRows[0].id : null;
    
    // Wenn Kategorie nicht existiert, lege sie an (Sicherheitshalber)
    if (!katId) {
      const [newKat] = await db.insert(kategorie).values({
        name: kategorieName,
        typ: 'ausgabe',
      }).returning();
      katId = newKat.id;
    }

    // Lieferant matchen
    let lieferantId = null;
    if (ergebnis.lieferant) {
      const match = await db.select().from(lieferant).where(ilike(lieferant.name, `%${ergebnis.lieferant}%`));
      if (match.length > 0) {
        lieferantId = match[0].id;
        if (!katId && match[0].standardKategorieId) {
            katId = match[0].standardKategorieId;
        }
      } else {
        // Lieferant neu anlegen (für Prototyp)
        const [newLief] = await db.insert(lieferant).values({
            name: ergebnis.lieferant,
            standardKategorieId: katId,
        }).returning();
        lieferantId = newLief.id;
      }
    }

    // Status bestimmen
    const status = ergebnis.confidence >= 0.85 ? 'erfasst' : 'pruefen';

    let erstelltVon: string;
    const sessionRes = await readAppSession();
    if (sessionRes.ok) {
      erstelltVon = sessionRes.session.userId;
    } else {
      if (process.env.NODE_ENV !== "production") {
        const { appUsers } = await import("@/db/schema");
        const users = await db.select().from(appUsers).limit(1);
        if (users.length > 0) {
          erstelltVon = users[0].id;
        } else {
          erstelltVon = "00000000-0000-0000-0000-000000000000";
        }
      } else {
        return NextResponse.json({ error: "Sitzung abgelaufen oder nicht angemeldet" }, { status: 401 });
      }
    }

    // Datensatz in `beleg` anlegen
    const [newBeleg] = await db.insert(beleg).values({
      originalDatei: storagePath,
      belegdatum: ergebnis.datum || new Date().toISOString(),
      lieferantId,
      lieferantText: ergebnis.lieferant,
      brutto: ergebnis.brutto ? String(ergebnis.brutto) : null,
      netto: ergebnis.netto ? String(ergebnis.netto) : null,
      ustSatz: ergebnis.ustSatz ? String(ergebnis.ustSatz) : null,
      ustBetrag: ergebnis.ustBetrag ? String(ergebnis.ustBetrag) : null,
      kategorieId: katId,
      belegart: ergebnis.belegart,
      zahlungsart: ergebnis.zahlungsart,
      rechnungsnummerExtern: ergebnis.rechnungsnummer,
      ocrConfidence: String(ergebnis.confidence),
      ocrRohtext: ergebnis.rohtext,
      ocrPositionen: ergebnis.positionen,
      ocrProvider: hasKlippa ? 'klippa' : 'gemini',
      status,
      erstelltVon
    }).returning();

    // Verteilung starten (F-BELEG-05)
    await verteilBeleg(newBeleg.id, ergebnis, kategorieName);

    return NextResponse.json({ ok: true, belegId: newBeleg.id, status });
  } catch (error: unknown) {
    console.error("OCR API Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
