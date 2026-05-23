"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, CheckCircle, Archive, ChevronRight, Flame, Package, Droplets, Clock } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface QuoteRequest {
  id: string;
  customerName: string;
  customerId: string;
  subject: string;
  description: string;
  receivedAt: string;
  rustLevel: "Leicht" | "Mittel" | "Stark" | "Sehr stark";
  dirtLevel: "Sauber" | "Leicht" | "Stark";
  partCount: number;
  material: string;
  status: "offen" | "angeboten" | "archiviert";
  photo?: string;
  pricing: {
    grundarbeit: number;
    reinigung: number;
    entmetallisierung: number;
    schleifaufwand: number;
    badchemie: number;
    risikopuffer: number;
    marge: number;
  };
}

const MOCK_REQUESTS: QuoteRequest[] = [
  {
    id: "q1",
    customerName: "Rosa Schneider",
    customerId: "K-000131",
    subject: "Vespa V50 Lampenmaske – Verchromung",
    description: "Hallo, ich möchte die Lampenmaske meiner Vespa V50 (Baujahr 1968) neu verchromen lassen. Das Teil hat leichte Rostflecken und eine alte Lackschicht. Sehr gerne würde ich ein Angebot erhalten. MfG Rosa Schneider",
    receivedAt: "2026-05-21",
    rustLevel: "Leicht",
    dirtLevel: "Leicht",
    partCount: 1,
    material: "Stahlblech",
    status: "offen",
    pricing: { grundarbeit: 120, reinigung: 20, entmetallisierung: 35, schleifaufwand: 40, badchemie: 25, risikopuffer: 15, marge: 30 },
  },
  {
    id: "q2",
    customerName: "Atelier Schmid",
    customerId: "K-000125",
    subject: "BMW R75 Motorradtank – Glanzverchromung",
    description: "Wir haben einen originalen BMW R75 Tank aus den 1940er-Jahren. Der Tank hat Beulen, tiefe Kratzer und Flugrost. Wir benötigen eine vollständige Glanzverchromung inkl. Entlackung und Entmetallisierung. Gibt es Erfahrung mit dieser Epoche?",
    receivedAt: "2026-05-20",
    rustLevel: "Stark",
    dirtLevel: "Stark",
    partCount: 1,
    material: "Stahlblech (Oldtimer)",
    status: "offen",
    pricing: { grundarbeit: 280, reinigung: 60, entmetallisierung: 90, schleifaufwand: 180, badchemie: 70, risikopuffer: 60, marge: 80 },
  },
  {
    id: "q3",
    customerName: "Kirchenverwaltung St. Urban",
    customerId: "K-000132",
    subject: "Historisches Besteck-Set (48-teilig) – Versilberung",
    description: "Wir besitzen ein historisches Silberbesteck (48 Teile, Messing/Alpacca), das für den kirchlichen Einsatz aufgearbeitet werden soll. Der Großteil ist stark oxidiert, einige Stücke haben leichte Dellen. Wir wünschen eine komplette Versilberung (90g/12).",
    receivedAt: "2026-05-19",
    rustLevel: "Mittel",
    dirtLevel: "Stark",
    partCount: 48,
    material: "Messing / Alpacca",
    status: "offen",
    pricing: { grundarbeit: 350, reinigung: 80, entmetallisierung: 120, schleifaufwand: 90, badchemie: 95, risikopuffer: 40, marge: 90 },
  },
];

const RUST_BADGE: Record<QuoteRequest["rustLevel"], string> = {
  "Leicht": "bg-yellow-50 text-yellow-700 border-yellow-200",
  "Mittel": "bg-orange-50 text-orange-700 border-orange-200",
  "Stark": "bg-red-50 text-red-700 border-red-200",
  "Sehr stark": "bg-red-100 text-red-800 border-red-300",
};

function calcTotal(p: QuoteRequest["pricing"]) {
  return Object.values(p).reduce((a, b) => a + b, 0);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function QuotesPage() {
  const [requests, setRequests] = useState<QuoteRequest[]>(MOCK_REQUESTS);
  const [selectedId, setSelectedId] = useState<string | null>(MOCK_REQUESTS[0].id);
  const [pricing, setPricing] = useState<Record<string, QuoteRequest["pricing"]>>(
    Object.fromEntries(MOCK_REQUESTS.map(r => [r.id, { ...r.pricing }]))
  );
  const [showEmail, setShowEmail] = useState(false);

  const selected = requests.find(r => r.id === selectedId) || null;
  const currentPricing = selectedId ? pricing[selectedId] : null;
  const total = currentPricing ? calcTotal(currentPricing) : 0;

  const handlePriceChange = (field: keyof QuoteRequest["pricing"], value: number) => {
    if (!selectedId) return;
    setPricing(prev => ({ ...prev, [selectedId]: { ...prev[selectedId], [field]: value } }));
  };

  const handleStatusChange = (id: string, status: QuoteRequest["status"]) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  };

  const handleTakeAsOrder = (req: QuoteRequest) => {
    const newOrder = {
      id: `order-from-${req.id}-${Date.now()}`,
      orderNumber: `A-2026-QUOTE-${req.id.toUpperCase()}`,
      task: req.subject,
      customerName: req.customerName,
      customerId: req.customerId,
      intakeDate: new Date().toLocaleDateString("de-CH"),
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      dueLabel: "Fällig in",
      dueValue: "14 Tagen",
      station: "wareneingang" as const,
      currentStationId: "wareneingang",
      risk: "green" as const,
      statusText: "IM PLAN",
      parts: Array.from({ length: req.partCount }, (_, i) => ({
        id: `${req.id}-part-${i + 1}`,
        name: `${req.subject} – Teil ${i + 1}`,
        material: req.material,
        finish: "Zu bestimmen",
        location: "Wareneingang",
        hours: "0.0h",
        station: "wareneingang" as const,
        status: "Neu" as const,
      })),
    };

    const savedOrders = localStorage.getItem("kreile_orders");
    const existing = savedOrders ? JSON.parse(savedOrders) : [];
    localStorage.setItem("kreile_orders", JSON.stringify([newOrder, ...existing]));
    window.dispatchEvent(new Event("storage"));
    handleStatusChange(req.id, "angeboten");
    alert(`✓ Auftrag "${req.subject}" wurde im Wareneingang angelegt!`);
  };

  const generateEmail = (req: QuoteRequest, p: QuoteRequest["pricing"]) => {
    const t = calcTotal(p);
    return `Sehr geehrte/r ${req.customerName},

vielen Dank für Ihre Anfrage bezüglich: „${req.subject}".

Wir freuen uns, Ihnen folgendes Angebot zu unterbreiten:

─ Grundarbeit:          CHF ${p.grundarbeit.toFixed(2)}
─ Reinigung:            CHF ${p.reinigung.toFixed(2)}
─ Entmetallisierung:    CHF ${p.entmetallisierung.toFixed(2)}
─ Schleifaufwand:       CHF ${p.schleifaufwand.toFixed(2)}
─ Badchemie:            CHF ${p.badchemie.toFixed(2)}
─ Risikopuffer:         CHF ${p.risikopuffer.toFixed(2)}
─ Marge / Overhead:     CHF ${p.marge.toFixed(2)}
─────────────────────────────────────────
Total (Netto):          CHF ${t.toFixed(2)}
(zzgl. 8.1% MwSt → CHF ${(t * 1.081).toFixed(2)} brutto)

Lieferzeit: ca. 10–14 Werktage nach Auftragserteilung.

Wir stehen Ihnen für Rückfragen jederzeit zur Verfügung.

Mit freundlichen Grüssen
Galvanik Kreile
Tel: +41 32 622 11 22
kreile-galvanik.ch`;
  };

  const PRICE_FIELDS: { key: keyof QuoteRequest["pricing"]; label: string; color: string }[] = [
    { key: "grundarbeit",       label: "Grundarbeit",         color: "bg-blue-100" },
    { key: "reinigung",         label: "Reinigung",           color: "bg-sky-100" },
    { key: "entmetallisierung", label: "Entmetallisierung",   color: "bg-purple-100" },
    { key: "schleifaufwand",    label: "Schleifaufwand",      color: "bg-orange-100" },
    { key: "badchemie",         label: "Badchemie",           color: "bg-teal-100" },
    { key: "risikopuffer",      label: "Risikopuffer",        color: "bg-red-100" },
    { key: "marge",             label: "Marge / Overhead",    color: "bg-emerald-100" },
  ];

  return (
    <div className="space-y-6 pb-12 font-sans max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/" className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-3xl font-extrabold font-serif text-slate-900 tracking-tight">Angebotsanfragen</h1>
          <p className="text-slate-500 text-sm mt-0.5">Website-Anfragen strukturieren · kalkulieren · beantworten</p>
        </div>
        <Badge className="ml-auto bg-orange-100 text-orange-700 border border-orange-200 font-bold">
          {requests.filter(r => r.status === "offen").length} Offen
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left: Anfragenliste */}
        <div className="space-y-3">
          {requests.map(req => (
            <Card
              key={req.id}
              onClick={() => { setSelectedId(req.id); setShowEmail(false); }}
              className={`cursor-pointer transition-all border-l-4 ${
                req.id === selectedId
                  ? "ring-2 ring-blue-900 border-transparent shadow-md"
                  : "border-slate-200 hover:shadow-sm"
              } ${req.status === "archiviert" ? "opacity-50" : ""}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{req.receivedAt}</p>
                    <h3 className="font-bold text-slate-800 text-sm leading-tight mt-1 truncate">{req.subject}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{req.customerName}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant="outline" className={`text-[9px] font-bold ${RUST_BADGE[req.rustLevel]}`}>
                      Rost: {req.rustLevel}
                    </Badge>
                    {req.status === "angeboten" && (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[9px] font-bold">Angeboten</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400 font-semibold">
                  <span className="flex items-center gap-1"><Package className="h-3 w-3" />{req.partCount} Tl.</span>
                  <span className="flex items-center gap-1"><Droplets className="h-3 w-3" />Schmutz: {req.dirtLevel}</span>
                  <span className="flex items-center gap-1"><Flame className="h-3 w-3" />{req.material.split("/")[0].trim()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Right: Detail + Kalkulation */}
        {selected && currentPricing ? (
          <div className="lg:col-span-2 space-y-4">
            {/* Anfrage Detail */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base font-black font-serif">{selected.subject}</CardTitle>
                    <p className="text-xs text-slate-500 mt-1">{selected.customerName} · {selected.receivedAt} · {selected.partCount} Teil(e)</p>
                  </div>
                  <Badge variant="outline" className={`text-[9px] font-bold ${RUST_BADGE[selected.rustLevel]}`}>
                    Rost: {selected.rustLevel}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="text-sm text-slate-600 leading-relaxed italic bg-slate-50 p-3 rounded-lg border border-slate-100">
                  &ldquo;{selected.description}&rdquo;
                </p>
              </CardContent>
            </Card>

            {/* Preiskalkulation */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold font-serif flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-700" /> Preiskalkulation
                  </CardTitle>
                  <span className="text-2xl font-black text-blue-900">CHF {total.toFixed(2)}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {PRICE_FIELDS.map(({ key, label, color }) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-sm shrink-0 ${color}`} />
                    <label className="text-sm font-semibold text-slate-600 w-44 shrink-0">{label}</label>
                    <input
                      type="range"
                      min={0} max={500} step={5}
                      value={currentPricing[key]}
                      onChange={e => handlePriceChange(key, Number(e.target.value))}
                      className="flex-1 accent-blue-600 h-1.5"
                    />
                    <span className="text-sm font-bold text-slate-800 w-16 text-right">
                      CHF {currentPricing[key]}
                    </span>
                  </div>
                ))}

                <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    Netto <span className="font-bold text-slate-800">CHF {total.toFixed(2)}</span>
                    {" "}· Brutto (8.1% MwSt){" "}
                    <span className="font-bold text-slate-800">CHF {(total * 1.081).toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Auto-Mail Generator */}
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-4">
                <button
                  onClick={() => setShowEmail(v => !v)}
                  className="flex items-center gap-2 text-sm font-bold text-blue-700 hover:text-blue-900 transition-colors"
                >
                  <Mail className="h-4 w-4" />
                  {showEmail ? "Antwort-Email ausblenden" : "Antwort-Email generieren"}
                  <ChevronRight className={`h-4 w-4 transition-transform ${showEmail ? "rotate-90" : ""}`} />
                </button>
                {showEmail && (
                  <pre className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-700 font-mono whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                    {generateEmail(selected, currentPricing)}
                  </pre>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => handleTakeAsOrder(selected)}
                disabled={selected.status === "archiviert"}
                className="bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-xl shadow-md"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Als Auftrag übernehmen
              </Button>
              <Button
                variant="outline"
                onClick={() => handleStatusChange(selected.id, "angeboten")}
                disabled={selected.status !== "offen"}
                className="font-bold rounded-xl border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              >
                <Mail className="h-4 w-4 mr-2" />
                Angebot gesendet
              </Button>
              <Button
                variant="ghost"
                onClick={() => handleStatusChange(selected.id, "archiviert")}
                className="font-bold rounded-xl text-slate-500 hover:text-red-600"
              >
                <Archive className="h-4 w-4 mr-2" />
                Archivieren
              </Button>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-2 flex items-center justify-center h-64 text-slate-400 text-sm font-semibold bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            Wähle eine Anfrage links aus
          </div>
        )}
      </div>
    </div>
  );
}
