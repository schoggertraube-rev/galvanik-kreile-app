"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import {
  getCaptureOverview,
  recordMaterialCapture,
  recordTimeCapture,
  type CaptureOverview,
} from "@/app/actions/capture.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BestaetigenButton } from "./BestaetigenButton";
import { MengenStepper } from "./MengenStepper";
import { ZeitSlider } from "./ZeitSlider";

type CaptureSheetProps = {
  orderId: string;
  stationKuerzel: string;
  onSuccess: () => void | Promise<void>;
  onClose: () => void;
};

function money(value: number): string {
  return value.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

export function CaptureSheet({ orderId, stationKuerzel, onSuccess, onClose }: CaptureSheetProps) {
  const [activeTab, setActiveTab] = useState<"zeit" | "material">("zeit");
  const [overview, setOverview] = useState<CaptureOverview | null>(null);
  const [minutes, setMinutes] = useState(15);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeRequestId = useRef<string | null>(null);
  const materialRequestId = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setLoadingData(true);
      setError(null);
      try {
        const result = await getCaptureOverview(orderId, stationKuerzel);
        if (!active) return;
        if (!result.ok) {
          setOverview(null);
          setError(result.message);
          return;
        }
        setOverview(result.data);
        const suggested = result.data.template.zeit?.find((row) => row.station === stationKuerzel)?.median_min;
        setMinutes(suggested && suggested > 0 ? suggested : 15);
      } catch {
        if (active) setError("Erfassungsdaten konnten nicht vom Server bestätigt werden.");
      } finally {
        if (active) setLoadingData(false);
      }
    });
    return () => { active = false; };
  }, [orderId, stationKuerzel]);

  const articles = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("de-DE");
    return (overview?.articles || []).filter((article) => !query || article.name.toLocaleLowerCase("de-DE").includes(query));
  }, [overview, search]);

  const selectedMaterials = useMemo(() => Object.entries(quantities)
    .filter(([, quantity]) => quantity > 0)
    .map(([inventoryItemId, quantity]) => ({ inventoryItemId, quantity })), [quantities]);
  const selectedArticles = selectedMaterials.map((line) => ({
    ...line,
    article: overview?.articles.find((article) => article.id === line.inventoryItemId) || null,
  }));
  const missingPrice = selectedArticles.some((line) => line.article?.unitCostEur === null || !line.article);
  const insufficientStock = selectedArticles.some((line) => !line.article || line.quantity > line.article.currentStock);
  const materialCost = missingPrice
    ? null
    : selectedArticles.reduce((sum, line) => sum + line.quantity * (line.article?.unitCostEur || 0), 0);
  const rate = overview?.selectedRate?.valueEurPerHour ?? null;
  const timeCost = rate === null ? null : (minutes / 60) * rate;
  const suggestedMinutes = overview?.template.zeit?.find((row) => row.station === stationKuerzel)?.median_min;

  const setQuantity = (id: string, value: number) => {
    materialRequestId.current = null;
    setQuantities((current) => ({ ...current, [id]: Math.max(0, Math.round(value * 10_000) / 10_000) }));
  };

  const saveTime = async () => {
    setSaving(true);
    setError(null);
    try {
      timeRequestId.current ||= crypto.randomUUID();
      const result = await recordTimeCapture({
        orderId,
        stationKuerzel,
        minutes,
        clientRequestId: timeRequestId.current,
      });
      if (!result.ok) {
        setError(result.message);
        if (result.error !== "STORAGE_UNAVAILABLE") timeRequestId.current = null;
        return;
      }
      timeRequestId.current = null;
      await onSuccess();
    } catch {
      setError("Zeitbuchung konnte nicht bestätigt werden. Ein erneuter Versuch verwendet dieselbe Anforderungs-ID.");
    } finally {
      setSaving(false);
    }
  };

  const saveMaterial = async () => {
    setSaving(true);
    setError(null);
    try {
      materialRequestId.current ||= crypto.randomUUID();
      const result = await recordMaterialCapture({
        orderId,
        stationKuerzel,
        materials: selectedMaterials,
        clientRequestId: materialRequestId.current,
      });
      if (!result.ok) {
        setError(result.message);
        if (result.error !== "STORAGE_UNAVAILABLE") materialRequestId.current = null;
        return;
      }
      materialRequestId.current = null;
      await onSuccess();
    } catch {
      setError("Materialbuchung konnte nicht bestätigt werden. Ein erneuter Versuch verwendet dieselbe Anforderungs-ID.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex flex-col justify-end z-50 md:items-end md:justify-start" role="dialog" aria-modal="true" aria-labelledby="capture-sheet-title">
      <div className="w-full md:max-w-[520px] bg-white h-[85vh] md:h-full rounded-t-3xl md:rounded-none shadow-2xl flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-neutral-gray-100 shrink-0">
          <div>
            <h2 id="capture-sheet-title" className="text-2xl font-black font-serif text-navy-900">Erfassung</h2>
            <p className="text-text-muted text-xs font-bold mt-1">Station: {stationKuerzel}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 bg-neutral-gray-100 hover:bg-neutral-gray-200 rounded-full" aria-label="Erfassung schließen">
            <X className="w-5 h-5 text-navy-900" />
          </button>
        </div>

        <div className="flex px-6 pt-4 shrink-0 border-b border-neutral-gray-100">
          {(["zeit", "material"] as const).map((tab) => (
            <button
              type="button"
              key={tab}
              className={`flex-1 pb-3 text-sm font-bold border-b-4 ${activeTab === tab ? "border-[#C2185B] text-[#C2185B]" : "border-transparent text-text-muted"}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "zeit" ? "Zeit" : "Material"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && <div role="alert" className="bg-red-50 border-2 border-red-200 text-red-800 p-4 mb-6 text-sm font-bold rounded-2xl">{error}</div>}
          {loadingData ? (
            <div className="animate-pulse h-36 bg-neutral-gray-100 rounded-2xl" />
          ) : activeTab === "zeit" ? (
            <div className="space-y-8 mt-4">
              {rate === null && (
                <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 text-sm font-bold text-amber-900">
                  Für Mitarbeiter und Station ist kein gültiger Kostensatz hinterlegt. Eine Kostenbuchung wird deshalb nicht zugelassen.
                </div>
              )}
              <div className="flex gap-2 justify-center flex-wrap">
                {[15, 30, 45, 60, 90, 120].map((value) => (
                  <Button key={value} variant="outline" className="border-2 rounded-xl h-12 font-bold" onClick={() => {
                    timeRequestId.current = null;
                    setMinutes(value);
                  }}>{value}</Button>
                ))}
              </div>
              <ZeitSlider value={minutes} onChange={(value) => {
                timeRequestId.current = null;
                setMinutes(value);
              }} vorschlagWert={suggestedMinutes} />
              <p className="text-xs font-semibold text-text-muted text-center">
                {overview?.selectedRate?.source === "employee" ? "Mitarbeiter-Kostensatz" : overview?.selectedRate ? "Stations-Kostensatz" : "Kostensatz fehlt"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Lagerartikel suchen" className="pl-10" />
              </div>
              {articles.length === 0 ? (
                <div className="text-center py-8 text-text-muted font-bold text-sm bg-neutral-gray-50 rounded-2xl border-2 border-dashed border-neutral-gray-200">
                  {overview?.articles.length === 0 ? "Keine mandantengebundenen Lagerartikel vorhanden." : "Kein passender Lagerartikel gefunden."}
                </div>
              ) : articles.map((article) => {
                const quantity = quantities[article.id] || 0;
                const overStock = quantity > article.currentStock;
                return (
                  <div key={article.id} className={`p-4 rounded-2xl border-2 ${quantity > 0 ? "bg-blue-50 border-blue-200" : "bg-white border-neutral-gray-200"}`}>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="font-bold text-navy-900">{article.name}</div>
                        <div className="text-xs font-semibold text-text-muted mt-1">
                          Bestand {article.currentStock.toLocaleString("de-DE")} {article.unit}
                          {article.frequencyPercent !== null ? ` · Erfahrungswert ${article.frequencyPercent.toLocaleString("de-DE")} %` : ""}
                        </div>
                        <div className={`text-xs font-bold mt-1 ${article.unitCostEur === null ? "text-red-700" : "text-emerald-700"}`}>
                          {article.unitCostEur === null ? "Einkaufspreis fehlt" : `${money(article.unitCostEur)} je ${article.unit}`}
                        </div>
                      </div>
                      {quantity <= 0 && (
                        <Button variant="outline" onClick={() => setQuantity(article.id, article.suggestedQuantity || 1)}>+ aufnehmen</Button>
                      )}
                    </div>
                    {quantity > 0 && (
                      <>
                        <MengenStepper value={quantity} onChange={(value) => setQuantity(article.id, value)} einheit={article.unit} step={0.1} />
                        {overStock && <p className="text-xs font-bold text-red-700 mt-2">Menge überschreitet den bestätigten Bestand.</p>}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-neutral-gray-100 bg-white shrink-0">
          {activeTab === "zeit" ? (
            <BestaetigenButton
              label="Zeit verbindlich buchen"
              euroBetrag={timeCost}
              dauerMinuten={minutes}
              loading={saving}
              disabled={loadingData || rate === null || minutes <= 0}
              disabledHinweis={rate === null ? "Kostensatz fehlt" : undefined}
              onClick={() => void saveTime()}
            />
          ) : (
            <BestaetigenButton
              label="Material atomar buchen"
              euroBetrag={materialCost}
              loading={saving}
              disabled={loadingData || selectedMaterials.length === 0 || missingPrice || insufficientStock}
              disabledHinweis={missingPrice ? "Einkaufspreis fehlt" : insufficientStock ? "Bestand reicht nicht" : undefined}
              onClick={() => void saveMaterial()}
            />
          )}
        </div>
      </div>
    </div>
  );
}
