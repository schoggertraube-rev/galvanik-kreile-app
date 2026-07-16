"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Clock, RefreshCw } from "lucide-react";
import {
  applyCaptureTemplate,
  getCaptureOverview,
  type CaptureOverview,
} from "@/app/actions/capture.actions";
import { Button } from "@/components/ui/button";
import { VorschlagBanner } from "./VorschlagBanner";
import { CaptureSheet } from "./CaptureSheet";

type CaptureCardProps = {
  orderId: string;
  stationKuerzel: string | null | undefined;
};

export function CaptureCard({ orderId, stationKuerzel }: CaptureCardProps) {
  const [overview, setOverview] = useState<CaptureOverview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedStation, setSelectedStation] = useState<string | null>(stationKuerzel || null);
  const templateRequestId = useRef<string | null>(null);

  const load = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    setLoadError(null);
    try {
      const result = await getCaptureOverview(orderId, stationKuerzel || undefined);
      if (!result.ok) {
        setOverview(null);
        setLoadError(result.message);
        return;
      }
      setOverview(result.data);
      setSelectedStation((current) => current || result.data.currentStation);
    } catch {
      setOverview(null);
      setLoadError("Erfassungsdaten konnten nicht vom Server bestätigt werden.");
    } finally {
      setLoading(false);
    }
  }, [orderId, stationKuerzel]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  useEffect(() => {
    const refresh = () => void load();
    window.addEventListener("kreile:data-refresh", refresh);
    return () => window.removeEventListener("kreile:data-refresh", refresh);
  }, [load]);

  const stations = useMemo(() => {
    const result = new Set<string>();
    if (overview?.currentStation) result.add(overview.currentStation);
    overview?.timeBookings.forEach((booking) => result.add(booking.station));
    overview?.materialBookings.forEach((booking) => {
      if (booking.station !== "nicht_zugeordnet") result.add(booking.station);
    });
    return [...result].sort((left, right) => left.localeCompare(right, "de"));
  }, [overview]);

  const applyTemplate = async () => {
    setMutationError(null);
    try {
      templateRequestId.current ||= crypto.randomUUID();
      const result = await applyCaptureTemplate({
        orderId,
        clientRequestId: templateRequestId.current,
      });
      if (!result.ok) {
        setMutationError(result.message);
        if (result.error !== "STORAGE_UNAVAILABLE") templateRequestId.current = null;
        return;
      }
      templateRequestId.current = null;
      await load();
    } catch {
      setMutationError("Vorlage konnte nicht belastbar bestätigt werden. Ein erneuter Versuch verwendet dieselbe Anforderungs-ID.");
    }
  };

  const openSheet = (station: string) => {
    setSelectedStation(station);
    setMutationError(null);
    setSheetOpen(true);
  };

  return (
    <section className="bg-white border-2 border-neutral-gray-300 rounded-3xl p-6 md:p-8 shadow-sm" aria-labelledby="capture-title">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h3 id="capture-title" className="text-xl font-black font-serif text-navy-900">Verbrauch & Zeit</h3>
          <p className="text-xs font-semibold text-text-muted mt-1">Serverbestätigte Buchungen und Ist-Kosten</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading} aria-label="Erfassungsdaten neu laden">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {loadError && (
        <div role="alert" className="bg-red-50 border-2 border-red-200 text-red-800 rounded-2xl p-4 mb-5 text-sm font-bold">
          {loadError}
        </div>
      )}
      {mutationError && (
        <div role="alert" className="bg-amber-50 border-2 border-amber-200 text-amber-900 rounded-2xl p-4 mb-5 text-sm font-bold">
          {mutationError}
        </div>
      )}

      {loading && !overview ? (
        <div className="animate-pulse bg-neutral-gray-100 h-32 rounded-2xl mb-6" />
      ) : overview ? (
        <>
          {overview.template.hat_vorlage ? (
            <VorschlagBanner
              vorlage={overview.template}
              onUebernehmen={applyTemplate}
              onAnpassen={() => overview.currentStation && openSheet(overview.currentStation)}
            />
          ) : (
            <div className="bg-neutral-gray-50 border-2 border-dashed border-neutral-gray-200 rounded-2xl p-4 mb-6 text-center text-sm font-bold text-text-muted">
              Noch kein belastbarer Erfahrungswert für diese Auftragsart. Es wird nichts automatisch vorbelegt.
            </div>
          )}

          <div className="space-y-2 mb-6">
            {stations.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-neutral-gray-200 p-4 text-sm font-semibold text-text-muted">
                Keine Station ist am Auftrag hinterlegt und es existiert noch keine Buchung. Bitte zuerst den Auftrag einer Station zuordnen.
              </div>
            ) : stations.map((station) => {
              const time = overview.timeBookings.filter((booking) => booking.station === station);
              const material = overview.materialBookings.filter((booking) => booking.station === station);
              const minutes = time.reduce((sum, booking) => sum + booking.minutes, 0);
              const hasBookings = time.length > 0 || material.length > 0;
              const summary = hasBookings
                ? `${minutes} Min · ${material.length} Materialbuchung${material.length === 1 ? "" : "en"}`
                : "Noch keine Buchung";
              return (
                <div key={station} className="flex items-center justify-between p-4 bg-bg-app-soft rounded-2xl border-2 border-neutral-gray-100">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-3 h-3 rounded-full shrink-0 ${hasBookings ? "bg-success-green" : "bg-neutral-gray-300"}`} />
                    <div className="min-w-0">
                      <div className="font-bold text-navy-900 truncate">{station}</div>
                      <div className="text-sm font-semibold text-text-muted">{summary}</div>
                    </div>
                  </div>
                  <Button variant="ghost" className="font-bold" onClick={() => openSheet(station)}>
                    {hasBookings ? "Nachtragen" : "Erfassen"}
                  </Button>
                </div>
              );
            })}
          </div>

          <Button
            onClick={() => selectedStation && openSheet(selectedStation)}
            disabled={!selectedStation}
            className="w-full bg-white border-2 border-neutral-gray-200 text-navy-900 font-bold hover:bg-neutral-gray-50 hover:border-navy-300 h-14 rounded-2xl"
          >
            <Clock className="w-5 h-5 mr-2" /> <Box className="w-5 h-5 mr-2" /> Verbrauch oder Zeit nachtragen
          </Button>
        </>
      ) : null}

      {sheetOpen && selectedStation && (
        <CaptureSheet
          orderId={orderId}
          stationKuerzel={selectedStation}
          onSuccess={async () => {
            setSheetOpen(false);
            await load();
          }}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </section>
  );
}
