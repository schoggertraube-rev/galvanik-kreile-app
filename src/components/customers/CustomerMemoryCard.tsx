import "@/lib/types/customer";
import { generateCustomerInsights } from "@/lib/services/customerInsights";
import { Customer } from "@/lib/types/customer";
import { AlertTriangle, Info, CheckCircle, ShieldAlert, Zap } from "lucide-react";

interface CustomerMemoryCardProps {
  customer: Customer;
}

export function CustomerMemoryCard({ customer }: CustomerMemoryCardProps) {
  const insights = generateCustomerInsights(customer);

  if (!insights || insights.length === 0) return null;

  return (
    <div className="bg-navy-900 rounded-xl p-5 border border-navy-700 shadow-sm relative overflow-hidden mb-6">
      {/* Decorative background element */}
      <div className="absolute top-0 right-0 p-4 opacity-5">
        <Zap className="w-32 h-32 text-white" />
      </div>

      <div className="flex items-center gap-2 mb-4 relative z-10">
        <Zap className="h-5 w-5 text-gold-600" />
        <h2 className="text-lg font-bold text-white font-serif tracking-tight">Werkstattgedächtnis</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative z-10">
        {insights.map((insight) => {
          let bgColor = "bg-white/10 border-white/20";
          const textColor = "text-white";
          let titleColor = "text-white";
          let Icon = Info;

          if (insight.severity === "critical") {
            bgColor = "bg-danger-red/20 border-danger-red/50";
            titleColor = "text-red-300";
            Icon = ShieldAlert;
          } else if (insight.severity === "watch") {
            bgColor = "bg-gold-600/20 border-gold-600/50";
            titleColor = "text-gold-100";
            Icon = AlertTriangle;
          } else if (insight.severity === "positive") {
            bgColor = "bg-success-green/20 border-success-green/50";
            titleColor = "text-emerald-300";
            Icon = CheckCircle;
          }

          return (
            <div key={insight.id} className={`p-3.5 rounded-lg border flex gap-3 ${bgColor}`}>
              <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${titleColor}`} />
              <div>
                <h4 className={`text-xs font-bold uppercase tracking-wider ${titleColor} mb-1`}>
                  {insight.title}
                </h4>
                <p className={`text-sm ${textColor} leading-snug opacity-90`}>
                  {insight.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
