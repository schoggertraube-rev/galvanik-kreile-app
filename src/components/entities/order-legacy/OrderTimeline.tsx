import { TimelineEntry } from "@/lib/repositories/timelineRepository";
import { CheckCircle2, AlertTriangle, Camera, FileText, Info } from "lucide-react";

export function OrderTimeline({ entries }: { entries: TimelineEntry[] }) {
  const getIcon = (entry: TimelineEntry) => {
    if (entry.severity === "critical") return <AlertTriangle className="w-5 h-5 text-danger-red" />;
    if (entry.type === "photo" || entry.title === "Foto aufgenommen") return <Camera className="w-5 h-5 text-text-muted" />;
    if (entry.type === "document") return <FileText className="w-5 h-5 text-navy-700" />;
    if (entry.severity === "good") return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    return <Info className="w-5 h-5 text-text-muted" />;
  };

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-extrabold text-navy-500 uppercase tracking-widest pl-1">Auftragshistorie</h3>
      <div className="relative border-l-2 border-neutral-gray-100 ml-4 space-y-8 pb-4">
        {entries.map((entry, idx) => (
          <div key={entry.id || idx} className="relative pl-8">
            <div className="absolute left-[-11px] top-1 bg-white p-0.5 rounded-full">
              {getIcon(entry)}
            </div>
            <div>
              <p className="text-xs font-bold text-text-muted mb-0.5">
                {new Date(entry.timestamp).toLocaleString("de-DE", { 
                  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" 
                })}
              </p>
              <h4 className={`text-base font-bold ${entry.severity === 'critical' ? 'text-danger-red' : 'text-navy-900'}`}>
                {entry.title}
              </h4>
              {entry.subtitle && (
                <p className="text-sm text-text-muted mt-1 bg-bg-app-soft p-2 rounded-lg border border-neutral-gray-100">
                  {entry.subtitle}
                </p>
              )}
            </div>
          </div>
        ))}

        {entries.length === 0 && (
          <p className="pl-8 text-navy-500 italic">Noch keine Einträge vorhanden.</p>
        )}
      </div>
    </div>
  );
}
