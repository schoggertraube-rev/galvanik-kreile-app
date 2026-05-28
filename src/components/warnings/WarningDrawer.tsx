"use client";
import { X, AlertTriangle, AlertCircle, Info, CheckCircle, ChevronRight, CheckCheck } from "lucide-react";
import { useWarnings } from "@/lib/warnings/hooks";
import type { WarningEvent, WarningSeverity } from "@/types/warnings";
import { useRouter } from "next/navigation";

function SeverityIcon({ severity }: { severity: WarningSeverity }) {
  if (severity === "critical") return <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />;
  if (severity === "warn") return <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />;
  return <Info className="w-5 h-5 text-blue-500 shrink-0" />;
}

function WarningCard({
  event,
  onAcknowledge,
  onNavigate,
}: {
  event: WarningEvent;
  onAcknowledge: (id: string) => void;
  onNavigate: (route: string) => void;
}) {
  const borderColor =
    event.severity === "critical"
      ? "border-red-200 bg-red-50"
      : event.severity === "warn"
      ? "border-amber-200 bg-amber-50"
      : "border-blue-200 bg-blue-50";

  return (
    <div className={`rounded-2xl border-2 p-4 space-y-2 ${borderColor}`}>
      <div className="flex items-start gap-3">
        <SeverityIcon severity={event.severity} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-navy-900 text-sm leading-tight">{event.message}</p>
          {event.proposedAction && (
            <p className="text-xs text-navy-500 mt-0.5">💡 {event.proposedAction}</p>
          )}
          <p className="text-[10px] text-text-muted mt-1">
            {new Date(event.detectedAt).toLocaleString("de-DE", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        {event.routeOnClick && (
          <button
            onClick={() => onNavigate(event.routeOnClick!)}
            className="flex items-center gap-1 text-xs font-bold text-navy-700 hover:text-navy-900 bg-white border border-navy-700 px-3 py-1.5 rounded-xl transition-colors"
          >
            Ansehen <ChevronRight className="w-3 h-3" />
          </button>
        )}
        {!event.acknowledgedAt && (
          <button
            onClick={() => onAcknowledge(event.id)}
            className="flex items-center gap-1 text-xs font-bold text-text-muted hover:text-navy-900 bg-white border border-neutral-gray-100 px-3 py-1.5 rounded-xl transition-colors"
          >
            <CheckCheck className="w-3 h-3" /> Quittieren
          </button>
        )}
      </div>
    </div>
  );
}

export function WarningDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { events, totalCount, acknowledge } = useWarnings();
  const router = useRouter();

  const active = events.filter((e) => !e.acknowledgedAt && !e.resolvedAt);
  const acknowledged = events.filter((e) => e.acknowledgedAt && !e.resolvedAt);

  const sorted = [...active].sort((a, b) => {
    const order = { critical: 0, warn: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  const handleNavigate = (route: string) => {
    router.push(route);
    onClose();
  };

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-navy-900/30 backdrop-blur-xs z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-gray-100">
          <div>
            <h2 className="font-black text-navy-900 text-lg">Warnungen</h2>
            <p className="text-xs text-navy-500">{totalCount} aktiv</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {sorted.length === 0 && acknowledged.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <CheckCircle className="w-14 h-14 text-success-green" />
              <p className="font-extrabold text-navy-900">Alles in Ordnung!</p>
              <p className="text-sm text-navy-500">Keine aktiven Warnungen.</p>
            </div>
          )}

          {sorted.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-text-muted px-1">Aktiv</p>
              {sorted.map((e) => (
                <WarningCard
                  key={e.id}
                  event={e}
                  onAcknowledge={acknowledge}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          )}

          {acknowledged.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-text-muted px-1">
                Quittiert (letzte 7 Tage)
              </p>
              {acknowledged.map((e) => (
                <div
                  key={e.id}
                  className="rounded-xl border border-neutral-gray-100 bg-bg-app-soft p-3 opacity-60"
                >
                  <p className="font-bold text-sm text-navy-900">{e.message}</p>
                  <p className="text-[10px] text-text-muted mt-0.5">
                    Quittiert{" "}
                    {e.acknowledgedAt
                      ? new Date(e.acknowledgedAt).toLocaleString("de-DE", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
