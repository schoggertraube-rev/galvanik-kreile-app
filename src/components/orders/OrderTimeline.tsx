import { TimelineEntry } from "@/lib/repositories/timelineRepository";
import { CheckCircle2, AlertTriangle, Camera, FileText, Info } from "lucide-react";

export function OrderTimeline({ entries }: { entries: TimelineEntry[] }) {
  const getIcon = (type: string, severity?: string) => {
    if (severity === "critical") return <AlertTriangle className="w-5 h-5 text-red-500" />;
    if (type === "photo") return <Camera className="w-5 h-5 text-slate-400" />;
    if (type === "document") return <FileText className="w-5 h-5 text-blue-500" />;
    if (severity === "good") return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    return <Info className="w-5 h-5 text-slate-400" />;
  };

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-extrabold text-slate-500 uppercase tracking-widest pl-1">Auftragshistorie</h3>
      <div className="relative border-l-2 border-slate-200 ml-4 space-y-8 pb-4">
        {entries.map((entry, idx) => (
          <div key={entry.id || idx} className="relative pl-8">
            <div className="absolute left-[-11px] top-1 bg-white p-0.5 rounded-full">
              {getIcon(entry.type, entry.severity)}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 mb-0.5">
                {new Date(entry.timestamp).toLocaleString("de-DE", { 
                  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" 
                })}
              </p>
              <h4 className={`text-base font-bold ${entry.severity === 'critical' ? 'text-red-700' : 'text-slate-800'}`}>
                {entry.title}
              </h4>
              {entry.subtitle && (
                <p className="text-sm text-slate-600 mt-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  {entry.subtitle}
                </p>
              )}
            </div>
          </div>
        ))}

        {entries.length === 0 && (
          <p className="pl-8 text-slate-500 italic">Noch keine Einträge vorhanden.</p>
        )}
      </div>
    </div>
  );
}
