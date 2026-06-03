"use client";

import { usePageView } from "@/hooks/usePageView";
import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { UserManagement } from "@/components/admin/UserManagement";
import { RoleMatrix } from "@/components/admin/RoleMatrix";
import { FeatureToggles } from "@/components/admin/FeatureToggles";
import { DataImportCenter } from "@/components/admin/DataImportCenter";
import { CompanySettingsForm } from "@/components/admin/CompanySettingsForm";
import { Server, Users, Shield, Power, Database, Settings, Building2, BarChart2, Lightbulb } from "lucide-react";
import Link from "next/link";

type Tab = "status" | "company" | "users" | "roles" | "features" | "import" | "system";

export function SettingsClient({ isAdmin, isDeveloper }: { isAdmin: boolean, isDeveloper: boolean }) {
  usePageView();
  const [activeTab, setActiveTab] = useState<Tab>("status");

  return (
    <div className="space-y-6 pb-12 font-sans antialiased text-navy-900 w-full px-4 sm:px-6 xl:px-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <PageHeader
          title="Admin Console & Einstellungen"
          subtitle="Verwalte Einstellungen und Systemparameter."
        />
        {isDeveloper && (
          <div className="flex items-center gap-3">
            <Link href="/admin/analytics" className="inline-flex items-center gap-2 px-4 py-2 bg-kreile-yellow text-navy-900 font-semibold rounded-xl hover:bg-yellow-500 transition-colors shadow-sm">
              <BarChart2 className="w-5 h-5" />
              App-Nutzung / Analytics
            </Link>
            <Link href="/kvp" className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-gray-100 text-navy-900 font-semibold rounded-xl hover:bg-neutral-gray-200 transition-colors shadow-sm">
              <Lightbulb className="w-5 h-5" />
              App verbessern (Dev-KVP)
            </Link>
          </div>
        )}
      </div>

      <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide border-b border-neutral-gray-200">
        <TabButton active={activeTab === "status"} onClick={() => setActiveTab("status")} icon={<Server />} label="Status & Diagnose" />
        
        {isAdmin && (
          <>
            <TabButton active={activeTab === "company"} onClick={() => setActiveTab("company")} icon={<Building2 />} label="Firmendaten" />
            <TabButton active={activeTab === "users"} onClick={() => setActiveTab("users")} icon={<Users />} label="Benutzer" />
            <TabButton active={activeTab === "roles"} onClick={() => setActiveTab("roles")} icon={<Shield />} label="Rollen & Rechte" />
            {isDeveloper && <TabButton active={activeTab === "features"} onClick={() => setActiveTab("features")} icon={<Power />} label="Feature-Toggles" />}
            <TabButton active={activeTab === "import"} onClick={() => setActiveTab("import")} icon={<Database />} label="Daten-Import" />
            <TabButton active={activeTab === "system"} onClick={() => setActiveTab("system")} icon={<Settings />} label="System" />
          </>
        )}
      </div>

      <div className="pt-2">
        {activeTab === "status" && <AdminDashboard />}
        
        {isAdmin && (
          <>
            {activeTab === "company" && <CompanySettingsForm />}
            {activeTab === "users" && <UserManagement />}
            {activeTab === "roles" && <RoleMatrix />}
            {isDeveloper && activeTab === "features" && <FeatureToggles />}
            {activeTab === "import" && <DataImportCenter />}
            {activeTab === "system" && (
              <div className="p-12 text-center border-2 border-dashed border-neutral-gray-200 rounded-2xl text-text-muted space-y-2">
                <Settings className="w-8 h-8 mx-auto opacity-50" />
                <h3 className="font-bold text-navy-900">Systemeinstellungen</h3>
                <p className="text-sm">Globale Parameter, Backup-Jobs und API-Keys folgen hier.</p>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${
        active 
          ? "border-navy-900 text-navy-900 bg-white" 
          : "border-transparent text-text-muted hover:text-navy-900 hover:bg-bg-app-soft"
      }`}
    >
      <div className="w-4 h-4 shrink-0 flex items-center justify-center">
        {icon}
      </div>
      {label}
    </button>
  );
}
