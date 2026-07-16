"use client";

import { usePageView } from "@/hooks/usePageView";
import { PageHeader } from "@/components/ui/PageHeader";
import Link from "next/link";
import { CheckSquare, MessageSquare, PhoneCall, Lightbulb, Droplet, Package, FileText, Lock, BarChart3 } from "lucide-react";

interface ModuleConfig {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  href: string;
  hasAccess: boolean;
  color: string;
}

export function BetriebDashboardClient({ isAdminOrDev }: { isAdminOrDev: boolean }) {
  usePageView();

  const modules: ModuleConfig[] = [
    {
      id: "kontrolle",
      label: "Kontrolle",
      description: "Produktion & Leitstand Übersicht",
      icon: CheckSquare,
      href: "/kontrolle",
      hasAccess: true,
      color: "text-blue-500",
    },
    {
      id: "performance",
      label: "Performance",
      description: "Serverbestätigte Betriebskennzahlen",
      icon: BarChart3,
      href: "/performance",
      hasAccess: isAdminOrDev,
      color: "text-blue-700",
    },
    {
      id: "kommunikation",
      label: "Kommunikation",
      description: "Interne Nachrichten und Aufgaben",
      icon: MessageSquare,
      href: "/kommunikation",
      hasAccess: true,
      color: "text-indigo-500",
    },
    {
      id: "kundenservice",
      label: "Kundenservice",
      description: "Kundenanfragen & Support",
      icon: PhoneCall,
      href: "/kommunikation",
      hasAccess: true,
      color: "text-emerald-500",
    },
    {
      id: "kvp",
      label: "Betriebs-KVP",
      description: "Kontinuierlicher Verbesserungsprozess",
      icon: Lightbulb,
      href: "/betrieb-kvp",
      hasAccess: true,
      color: "text-yellow-500",
    },
    {
      id: "baeder",
      label: "Bäder",
      description: "Badparameter und Chemie",
      icon: Droplet,
      href: "/baeder",
      hasAccess: true,
      color: "text-cyan-500",
    },
    {
      id: "lager",
      label: "Lager und Teile",
      description: "Inventar und Artikelverwaltung",
      icon: Package,
      href: "/items",
      hasAccess: true,
      color: "text-orange-500",
    },
    {
      id: "buchhaltung",
      label: "Finanzen & Buchhaltung",
      description: "Rechnungen, DATEV & Kostenkontrolle",
      icon: FileText,
      href: "/buchhaltung",
      hasAccess: isAdminOrDev,
      color: "text-purple-500",
    },
  ];

  return (
    <div className="w-full pb-24 px-4 sm:px-6 xl:px-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-semibold text-text-muted mt-4 mb-3">
        <Link href="/" className="hover:text-navy-900 transition-colors">Home</Link>
        <span className="text-neutral-gray-300">/</span>
        <span className="text-navy-900">Betrieb</span>
      </div>

      <PageHeader 
        title="Betriebs-Cockpit" 
        subtitle="Zentrale Übersicht über alle operativen Bereiche und Module." 
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-8">
        {modules.map((mod) => {
          const Icon = mod.icon;
          
          if (!mod.hasAccess) {
            return (
              <div 
                key={mod.id} 
                className="relative bg-white rounded-2xl p-6 border border-neutral-gray-100 shadow-sm flex flex-col items-start gap-4 opacity-60 grayscale cursor-not-allowed group overflow-hidden"
              >
                <div className="absolute inset-0 bg-neutral-gray-50/50 flex items-center justify-center backdrop-blur-[1px] z-10 transition-all opacity-0 group-hover:opacity-100">
                  <div className="bg-white px-4 py-2 rounded-xl shadow-elevated flex items-center gap-2 text-sm font-bold text-navy-900 border border-neutral-gray-100">
                    <Lock className="w-4 h-4 text-danger-red" />
                    Kein Zugriff
                  </div>
                </div>
                
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-neutral-gray-50 ${mod.color}`}>
                  <Icon className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="font-bold text-navy-900 text-lg">{mod.label}</h3>
                  <p className="text-sm text-text-muted mt-1 leading-relaxed">{mod.description}</p>
                </div>
              </div>
            );
          }

          return (
            <Link 
              key={mod.id} 
              href={mod.href}
              className="bg-white rounded-2xl p-6 border border-neutral-gray-100 shadow-card flex flex-col items-start gap-4 hover:-translate-y-1 hover:shadow-elevated transition-all duration-300 group cursor-pointer"
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-neutral-gray-50 group-hover:scale-110 transition-transform duration-300 ${mod.color}`}>
                <Icon className="w-6 h-6" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="font-bold text-navy-900 text-lg group-hover:text-accent-orange transition-colors">{mod.label}</h3>
                <p className="text-sm text-text-muted mt-1 leading-relaxed">{mod.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
