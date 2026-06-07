"use server";

import { db } from "@/db";
import { kampagne, kanal, segment, aktion, touchpoint, lernMetrik, statistikKennzahl, marketingAsset } from "@/db/schema_marketing";
import { eq, desc, asc, isNull } from "drizzle-orm";
import type { AktionVorschlag, Kampagne as MKampagne, FunnelDaten, Segment as MSegment, LernInsight, WirkungMini, StoryIdee, SortMode } from "@/lib/marketing/marketingTypes";

// Seed if empty
async function ensureMarketingData() {
  const existing = await db.select().from(kanal).limit(1);
  if (existing.length > 0) return;

  // Insert Kanal
  const kId = crypto.randomUUID();
  await db.insert(kanal).values([
    { id: kId, typ: "instagram", name: "Instagram (galvanik_kreile)", verbunden: true },
    { id: crypto.randomUUID(), typ: "email", name: "E-Mail Newsletter", verbunden: true },
    { id: crypto.randomUUID(), typ: "google", name: "Google MyBusiness", verbunden: true }
  ]);

  // Insert Segmente
  const s1 = crypto.randomUUID();
  const s2 = crypto.randomUUID();
  const s3 = crypto.randomUUID();
  await db.insert(segment).values([
    { id: s1, name: "Oldtimer / Fahrzeuge", icon: "🚗" },
    { id: s2, name: "Museen / Restaurierung", icon: "🏛️" },
    { id: s3, name: "Besteck / Silber", icon: "🍴" }
  ]);

  // Insert Kampagnen
  const k1 = crypto.randomUUID();
  await db.insert(kampagne).values([
    { id: k1, name: "Oldtimer-Saison 2026", status: "aktiv" },
    { id: crypto.randomUUID(), name: "Stammkunden-Reaktivierung Q2", status: "geplant" }
  ]);

  // Insert Aktionen
  await db.insert(aktion).values([
    { id: crypto.randomUUID(), kampagneId: k1, typ: "post", titel: "Vorher-/Nachher der Oldtimer-Felge posten", inhalt: { caption: "Aus matt wird Glanz ✨ Diese Oldtimer-Felge kam rostig zu uns — und ging verchromt zurück.", hashtags: "#galvanik #restauration #oldtimer" }, status: "vorschlag", erwarteterOutput: "4", aufwandMin: 2, score: "94", segmentId: s1 },
    { id: crypto.randomUUID(), typ: "mail", titel: "Museen & Restaurierung wecken", inhalt: { caption: "Lange nichts von uns gehört? Wir frischen Ihre Schätze wieder auf — melden Sie sich gern." }, status: "vorschlag", erwarteterOutput: "2", aufwandMin: 5, score: "88", segmentId: s2 },
    { id: crypto.randomUUID(), typ: "review_request", titel: "3 Google-Bewertungen anfragen", inhalt: { caption: "Zufrieden mit unserer Arbeit? Über eine kurze Google-Bewertung freuen wir uns riesig ⭐" }, status: "vorschlag", erwarteterOutput: "1", aufwandMin: 1, score: "76" },
    { id: crypto.randomUUID(), typ: "post", titel: "Wissens-Post „Was ist Vernickeln?\"", inhalt: { caption: "Wussten Sie? Vernickeln schützt Metall jahrzehntelang vor Korrosion. Wir zeigen, wie." }, status: "vorschlag", erwarteterOutput: "3", aufwandMin: 10, score: "68" }
  ]);

  // Insert LernMetrik
  await db.insert(lernMetrik).values([
    { id: crypto.randomUUID(), dimension: "timing", wert: "Dienstag 9–11 Uhr ist Gold", anfragen: 18, konfidenz: "0.8" },
    { id: crypto.randomUUID(), dimension: "format", wert: "Vorher-/Nachher schlägt alles", anfragen: 40, konfidenz: "0.9" }
  ]);
}

export async function getBesteAktionAction(): Promise<AktionVorschlag | null> {
  await ensureMarketingData();
  const res = await db.select().from(aktion).where(eq(aktion.status, "vorschlag")).orderBy(desc(aktion.score)).limit(1);
  if (!res.length) return null;
  const a = res[0];
  const chanId = a.typ === "post" ? "instagram" : a.typ === "mail" ? "email" : "google";
  return {
    id: a.id,
    titel: a.titel,
    kanal: chanId as any,
    kanalLabel: chanId === "instagram" ? "Instagram" : chanId === "email" ? "E-Mail" : "Google",
    score: Number(a.score),
    caption: (a.inhalt as any)?.caption || "",
    hashtags: (a.inhalt as any)?.hashtags || "",
    begruendung: "Basierend auf bisheriger Performance.",
    erwarteterOutput: `~${a.erwarteterOutput} Anfragen`,
    aufwand: `${a.aufwandMin} Min`,
    kosten: `${a.kostenBudget} €`,
    varianten: [
      { titel: a.titel, caption: (a.inhalt as any)?.caption || "", hashtags: (a.inhalt as any)?.hashtags || "" }
    ],
    segment: ""
  };
}

export async function listVorschlaegeAction(sort: SortMode = "output"): Promise<AktionVorschlag[]> {
  // Empty state for Ideen as requested
  return [];
}

export async function getKampagnenAction(): Promise<MKampagne[]> {
  await ensureMarketingData();
  const res = await db.select().from(kampagne).orderBy(desc(kampagne.erstelltAm));
  return res.map(k => ({
    id: k.id,
    titel: k.name,
    kanal: "Multi-Kanal",
    status: k.status as any,
    statusLabel: k.status === "aktiv" ? "läuft" : "geplant",
    fortschritt: k.status === "aktiv" ? 66 : 25,
    ergebnis: k.status === "aktiv" ? "+3.200 €" : "Prognose +1.800 €",
    statusColor: k.status === "aktiv" ? "var(--good)" : "var(--watch)"
  }));
}

export async function getSegmenteAction(): Promise<MSegment[]> {
  await ensureMarketingData();
  const res = await db.select().from(segment);
  return res.map(s => ({
    id: s.id,
    name: s.name,
    emoji: s.icon || "👤",
    kundenAnzahl: 30,
    weckbar: 5
  }));
}

export async function getLernInsightsAction(): Promise<LernInsight[]> {
  await ensureMarketingData();
  const res = await db.select().from(lernMetrik);
  return res.map(l => ({
    id: l.id,
    titel: l.wert,
    text: l.dimension === "timing" ? "Posts in diesem Fenster bringen <b>3× mehr Profilbesuche</b>." : "Restaurations-Fotos erzeugen <b>doppelt so viele Anfragen</b>.",
  }));
}

export async function getWirkungMiniAction(): Promise<WirkungMini[]> {
  return [
    { label: "Anfragen aus Marketing", wert: 23, suffix: "", sparkValues: [30, 45, 40, 62, 55, 85, 100] },
    { label: "Umsatz daraus", wert: 5760, suffix: " €", sparkValues: [35, 30, 55, 48, 70, 78, 100] },
    { label: "Return on Invest", wert: 91, suffix: "×", divisor: 10, sparkValues: [40, 52, 48, 66, 60, 82, 100] }
  ];
}

export async function getFunnelAction(): Promise<FunnelDaten> {
  return {
    stufen: [
      { label: "Posts / Mails", wert: 14, breite: 10 },
      { label: "Reichweite", wert: 8420, breite: 100 },
      { label: "Klicks / Profil", wert: 612, breite: 34 },
      { label: "Anfragen", wert: 23, breite: 18 },
      { label: "Aufträge", wert: 9, breite: 11 }
    ],
    umsatz: 5760,
    roi: 9.1
  };
}

export async function getStoryIdeenAction(): Promise<StoryIdee[]> {
  const v = await listVorschlaegeAction();
  return [
    ...v.map(vorschlag => ({
      id: "st-" + vorschlag.id,
      label: vorschlag.titel,
      caption: vorschlag.caption,
      hashtags: vorschlag.hashtags,
      titel: vorschlag.titel,
      icon: vorschlag.kanal === "instagram" ? "Star" : vorschlag.kanal === "email" ? "Landmark" : "Building2"
    })),
    { id: "st-add", label: "Eigene Idee", caption: "", hashtags: "", titel: "Eigene Idee", icon: "Plus", isAdd: true }
  ];
}
