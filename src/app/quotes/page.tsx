"use client";

import { usePageView } from "@/hooks/usePageView";
import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, CheckCircle, Archive, ChevronRight, Flame, Package, Droplets, Clock } from "lucide-react";
import { ordersRepository } from "@/lib/repositories/ordersRepository";
import { inquiriesRepository, QuoteRequest } from "@/lib/repositories/inquiriesRepository";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  isRouteTemplateId,
  ROUTE_TEMPLATE_IDS,
  ROUTE_TEMPLATES,
  type RouteTemplateId,
} from "@/lib/orders/routeSnapshot";

const RUST_BADGE: Record<QuoteRequest["rustLevel"], string> = {
  "Leicht": "bg-gold-100 text-yellow-700 border-yellow-200",
  "Mittel": "bg-gold-100 text-accent-orange border-accent-orange",
  "Stark": "bg-accent-orange-soft text-danger-red border-danger-red",
  "Sehr stark": "bg-danger-red text-danger-red border-danger-red",
};

function calcTotal(p: QuoteRequest["pricing"]) {
  return Object.values(p).reduce((a, b) => a + b, 0);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function QuotesPage() {
  usePageView();
  const [requests, setRequests] = useState<QuoteRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pricing, setPricing] = useState<Record<string, QuoteRequest["pricing"]>>({});
  const [showEmail, setShowEmail] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [conversionRoutes, setConversionRoutes] = useState<Record<string, RouteTemplateId | "">>({});
  const conversionRequestIds = useRef(new Map<string, string>());

  useEffect(() => {
    const loadRequests = async () => {
      try {
        const data = await inquiriesRepository.getAll();
        setRequests(data);
        if (data.length > 0 && !selectedId) {
          setSelectedId(data[0].id);
        }
        setPricing(Object.fromEntries(data.map(r => [r.id, { ...r.pricing }])));
        setDataError(null);
      } catch (error) {
        console.error(error);
        setDataError("Anfragen konnten nicht geladen werden.");
      }
    };
    loadRequests();

    const handleUpdate = () => loadRequests();
    window.addEventListener("kreile-inquiries-updated", handleUpdate);
    return () => window.removeEventListener("kreile-inquiries-updated", handleUpdate);
  }, [selectedId]);

  const selected = requests.find(r => r.id === selectedId) || null;
  const currentPricing = selectedId ? pricing[selectedId] : null;
  const total = currentPricing ? calcTotal(currentPricing) : 0;

  const handlePriceChange = async (field: keyof QuoteRequest["pricing"], value: number) => {
    if (!selectedId) return;
    const previousPricing = pricing[selectedId];
    const newPricing = { ...pricing[selectedId], [field]: value };
    setPricing(prev => ({ ...prev, [selectedId]: newPricing }));
    try {
      await inquiriesRepository.updatePricing(selectedId, newPricing);
      setDataError(null);
    } catch (error) {
      console.error(error);
      setPricing(prev => ({ ...prev, [selectedId]: previousPricing }));
      setDataError("Preiskalkulation konnte nicht gespeichert werden.");
    }
  };

  const handleStatusChange = async (id: string, status: QuoteRequest["status"]) => {
    const updated = await inquiriesRepository.updateStatus(id, status);
    if (!updated) throw new Error("Anfrage wurde nicht gefunden.");
    setRequests(prev => prev.map(r => r.id === id ? updated : r));
    setDataError(null);
  };

  const handleTakeAsOrder = async (req: QuoteRequest) => {
    const routeTemplateId = conversionRoutes[req.id];
    if (!isRouteTemplateId(routeTemplateId)) {
      setDataError("Vor der Übernahme muss die tatsächliche Bearbeitungsroute bestätigt werden.");
      return;
    }
    let clientRequestId = conversionRequestIds.current.get(req.id);
    if (!clientRequestId) {
      clientRequestId = crypto.randomUUID();
      conversionRequestIds.current.set(req.id, clientRequestId);
    }
    const newOrder = {
      clientRequestId,
      task: req.subject,
      customerId: req.customerId,
      parts: Array.from({ length: req.partCount }, (_, i) => ({
        name: `${req.subject} – Teil ${i + 1}`,
        quantity: 1,
        material: req.material,
        routeTemplateId,
      })),
      source: "manual" as const,
    };

    let created;
    try {
      created = await ordersRepository.create({
        ...newOrder,
        title: newOrder.task,
      });
    } catch (e) {
      console.error("Fehler beim Erstellen des Auftrags aus dem Angebot", e);
      setDataError("Der Auftrag konnte nicht angelegt werden. Es wurde keine erfolgreiche Übernahme verbucht.");
      return;
    }

    try {
      await handleStatusChange(req.id, "angenommen");
      conversionRequestIds.current.delete(req.id);
      alert(`Auftrag ${created.orderNumber} wurde im Wareneingang angelegt.`);
    } catch (e) {
      console.error("Auftrag erstellt, Anfrage-Status konnte nicht aktualisiert werden", e);
      setDataError(`Auftrag ${created.orderNumber} wurde angelegt, aber der Anfrage-Status konnte nicht aktualisiert werden.`);
    }
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

Liefertermin: nach technischer Prüfung und ausdrücklicher Bestätigung.

Wir stehen Ihnen für Rückfragen jederzeit zur Verfügung.

Mit freundlichen Grüssen
Galvanik Kreile
Tel: +41 32 622 11 22
kreile-galvanik.ch`;
  };

  const PRICE_FIELDS: { key: keyof QuoteRequest["pricing"]; label: string; color: string }[] = [
    { key: "grundarbeit",       label: "Grundarbeit",         color: "bg-navy-700" },
    { key: "reinigung",         label: "Reinigung",           color: "bg-sky-100" },
    { key: "entmetallisierung", label: "Entmetallisierung",   color: "bg-purple-100" },
    { key: "schleifaufwand",    label: "Schleifaufwand",      color: "bg-orange-100" },
    { key: "badchemie",         label: "Badchemie",           color: "bg-teal-100" },
    { key: "risikopuffer",      label: "Risikopuffer",        color: "bg-danger-red" },
    { key: "marge",             label: "Marge / Overhead",    color: "bg-success-green" },
  ];

  return (
    <div className="space-y-6 pb-12 font-sans max-w-6xl">
      <PageHeader
        title="Angebotsanfragen"
        subtitle="Website-Anfragen strukturieren · kalkulieren · beantworten"
        action={{
          label: "+ Neue Anfrage",
          href: "/quotes/new",
        }}
      />

      {dataError && <p className="rounded-xl border border-danger-red bg-accent-orange-soft p-3 text-sm font-bold text-danger-red">{dataError}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left: Anfragenliste */}
        <div className="space-y-3">
          {requests.map(req => (
            <Card
              key={req.id}
              onClick={() => { setSelectedId(req.id); setShowEmail(false); }}
              className={`cursor-pointer transition-all border-l-4 ${
                req.id === selectedId
                  ? "ring-2 ring-navy-900 border-transparent shadow-md"
                  : "border-neutral-gray-300 hover:shadow-sm"
              } ${req.status === "archiviert" ? "opacity-50" : ""}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-text-muted font-bold uppercase tracking-wider">{req.receivedAt}</p>
                    <h3 className="font-bold text-navy-900 text-sm leading-tight mt-1 truncate">{req.subject}</h3>
                    <p className="text-xs text-text-muted mt-0.5">{req.customerName}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant="outline" className={`text-[9px] font-bold ${RUST_BADGE[req.rustLevel]}`}>
                      Rost: {req.rustLevel}
                    </Badge>
                    {req.status === "angeboten" && (
                      <Badge className="bg-success-green text-success-green border-success-green text-[9px] font-bold">Angeboten</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2 text-[10px] text-text-muted font-semibold">
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
            <Card className="border-neutral-gray-300 shadow-sm">
              <CardHeader className="pb-3 border-b border-neutral-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base font-black font-serif">{selected.subject}</CardTitle>
                    <p className="text-xs text-text-muted mt-1">{selected.customerName} · {selected.receivedAt} · {selected.partCount} Teil(e)</p>
                  </div>
                  <Badge variant="outline" className={`text-[9px] font-bold ${RUST_BADGE[selected.rustLevel]}`}>
                    Rost: {selected.rustLevel}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="text-sm text-text-muted leading-relaxed italic bg-bg-app-soft p-3 rounded-lg border border-neutral-gray-100">
                  &ldquo;{selected.description}&rdquo;
                </p>
              </CardContent>
            </Card>

            {/* Preiskalkulation */}
            <Card className="border-neutral-gray-300 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold font-serif flex items-center gap-2">
                    <Clock className="h-4 w-4 text-navy-900" /> Preiskalkulation
                  </CardTitle>
                  <span className="text-2xl font-black text-navy-900">CHF {total.toFixed(2)}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {PRICE_FIELDS.map(({ key, label, color }) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-sm shrink-0 ${color}`} />
                    <label className="text-sm font-semibold text-text-muted w-44 shrink-0">{label}</label>
                    <input
                      type="range"
                      min={0} max={500} step={5}
                      value={currentPricing[key]}
                      onChange={e => handlePriceChange(key, Number(e.target.value))}
                      className="flex-1 accent-navy-900 h-1.5"
                    />
                    <span className="text-sm font-bold text-navy-900 w-16 text-right">
                      CHF {currentPricing[key]}
                    </span>
                  </div>
                ))}

                <div className="pt-3 border-t border-neutral-gray-300 flex items-center justify-between">
                  <div className="text-xs text-text-muted">
                    Netto <span className="font-bold text-navy-900">CHF {total.toFixed(2)}</span>
                    {" "}· Brutto (8.1% MwSt){" "}
                    <span className="font-bold text-navy-900">CHF {(total * 1.081).toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Auto-Mail Generator */}
            <Card className="border-neutral-gray-300 shadow-sm">
              <CardContent className="p-4">
                <button
                  onClick={() => setShowEmail(v => !v)}
                  className="flex items-center gap-2 text-sm font-bold text-navy-900 hover:text-accent-orange transition-colors"
                >
                  <Mail className="h-4 w-4" />
                  {showEmail ? "Antwort-Email ausblenden" : "Antwort-Email generieren"}
                  <ChevronRight className={`h-4 w-4 transition-transform ${showEmail ? "rotate-90" : ""}`} />
                </button>
                {showEmail && (
                  <pre className="mt-3 bg-bg-app-soft border border-neutral-gray-300 rounded-lg p-4 text-xs text-navy-900 font-mono whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                    {generateEmail(selected, currentPricing)}
                  </pre>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="space-y-3">
              <label className="block max-w-xl text-sm font-bold text-navy-900">
                Verbindliche Bearbeitungsroute
                <select
                  value={conversionRoutes[selected.id] ?? ""}
                  onChange={(event) => setConversionRoutes((current) => ({
                    ...current,
                    [selected.id]: event.target.value as RouteTemplateId | "",
                  }))}
                  className="mt-1 w-full rounded-xl border border-neutral-gray-300 bg-white px-3 py-2 text-sm font-semibold"
                >
                  <option value="">Route auswählen …</option>
                  {ROUTE_TEMPLATE_IDS.map((templateId) => (
                    <option key={templateId} value={templateId}>
                      {ROUTE_TEMPLATES[templateId].label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-text-muted">
                Die Auswahl wird unveränderlich am Auftrag gespeichert; ohne bestätigte Route wird kein Auftrag angelegt.
              </p>
              <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => handleTakeAsOrder(selected)}
                disabled={selected.status === "archiviert" || selected.status === "angenommen" || !isRouteTemplateId(conversionRoutes[selected.id])}
                className="bg-navy-900 hover:bg-navy-700 text-white font-bold rounded-xl shadow-md"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Als Auftrag übernehmen
              </Button>
              <Button
                variant="outline"
                onClick={() => handleStatusChange(selected.id, "angeboten")}
                disabled={selected.status !== "offen"}
                className="font-bold rounded-xl border-success-green text-success-green hover:bg-success-green-soft"
              >
                <Mail className="h-4 w-4 mr-2" />
                Als angeboten markieren (manuell)
              </Button>
              <Button
                variant="ghost"
                onClick={() => handleStatusChange(selected.id, "archiviert")}
                className="font-bold rounded-xl text-text-muted hover:text-danger-red"
              >
                <Archive className="h-4 w-4 mr-2" />
                Archivieren
              </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-2 flex items-center justify-center h-64 text-text-muted text-sm font-semibold bg-bg-app-soft rounded-2xl border border-dashed border-neutral-gray-300">
            Wähle eine Anfrage links aus
          </div>
        )}
      </div>
    </div>
  );
}
