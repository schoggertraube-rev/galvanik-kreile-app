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
import { BackupRestoreCenter } from "@/components/admin/BackupRestoreCenter";
import { Server, Users, Shield, Power, Database, Settings, Building2, BarChart2, Lightbulb, MonitorSmartphone } from "lucide-react";
import Link from "next/link";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import { TextTemplates } from "@/components/admin/TextTemplates";

type Tab = "status" | "company" | "users" | "roles" | "features" | "import" | "system" | "devices" | "backup" | "textvorlagen";

export function SettingsClient() {
  usePageView();
  const { hasPermission } = usePermissions();
  const [activeTab, setActiveTab] = useState<Tab>("status");

  const canManageUsers = hasPermission("perm_sys_users");
  const canSeeDiag = hasPermission("perm_sys_diag");
  const canManageToggles = hasPermission("perm_sys_toggles");

  return (
    <div className="space-y-6 pb-12 font-sans antialiased text-navy-900 w-full px-4 sm:px-6 xl:px-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <PageHeader
          title="Admin Console & Einstellungen"
          subtitle="Verwalte Einstellungen und Systemparameter."
        />
        {canManageUsers && (
          <div className="flex items-center gap-3">
            {canSeeDiag && (
              <>
                <Link href="/admin/analytics" className="inline-flex items-center gap-2 px-4 py-2 bg-kreile-yellow text-navy-900 font-semibold rounded-xl hover:bg-yellow-500 transition-colors shadow-sm">
                  <BarChart2 className="w-5 h-5" />
                  App-Nutzung / Analytics
                </Link>
                <Link href="/kvp" className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-gray-100 text-navy-900 font-semibold rounded-xl hover:bg-neutral-gray-200 transition-colors shadow-sm">
                  <Lightbulb className="w-5 h-5" />
                  App verbessern (Dev-KVP)
                </Link>
              </>
            )}
            <Link href="/admin/testanalyse" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-900 font-semibold rounded-xl hover:bg-blue-200 transition-colors shadow-sm border border-blue-200">
              <Shield className="w-5 h-5" />
              Testanalyse (Testpilot)
            </Link>
          </div>
        )}
      </div>

      <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide border-b border-neutral-gray-200">
        {canSeeDiag && <TabButton active={activeTab === "status"} onClick={() => setActiveTab("status")} icon={<Server />} label="Status & Diagnose" />}
        
        {canManageUsers && (
          <>
            <TabButton active={activeTab === "company"} onClick={() => setActiveTab("company")} icon={<Building2 />} label="Firmendaten" />
            <TabButton active={activeTab === "users"} onClick={() => setActiveTab("users")} icon={<Users />} label="Benutzer" />
            <TabButton active={activeTab === "roles"} onClick={() => setActiveTab("roles")} icon={<Shield />} label="Rollen & Rechte" />
            <TabButton active={activeTab === "devices"} onClick={() => setActiveTab("devices")} icon={<MonitorSmartphone />} label="Geräte & Sessions" />
            <TabButton active={activeTab === "textvorlagen"} onClick={() => setActiveTab("textvorlagen")} icon={<Settings />} label="Textvorlagen & E-Mails" />
            {canManageToggles && <TabButton active={activeTab === "features"} onClick={() => setActiveTab("features")} icon={<Power />} label="Feature-Toggles" />}
            <TabButton active={activeTab === "import"} onClick={() => setActiveTab("import")} icon={<Database />} label="Daten-Import" />
            <TabButton active={activeTab === "backup"} onClick={() => setActiveTab("backup")} icon={<Database />} label="Sicherung & Wiederherstellung" />
            <TabButton active={activeTab === "system"} onClick={() => setActiveTab("system")} icon={<Settings />} label="System" />
          </>
        )}
      </div>

      <div className="pt-2">
        {activeTab === "status" && (canSeeDiag ? <AdminDashboard /> : (
          <div className="rounded-2xl border border-neutral-gray-200 bg-white p-6 text-sm text-text-muted">Systemdiagnose ist für diese Rolle nicht freigegeben.</div>
        ))}
        
        {canManageUsers && (
          <>
            {activeTab === "company" && <CompanySettingsForm />}
            {activeTab === "users" && <UserManagement />}
            {activeTab === "roles" && <RoleMatrix />}
            {activeTab === "devices" && (
              <div className="rounded-2xl border border-neutral-gray-200 bg-white p-6">
                <h3 className="font-bold text-navy-900">Geräte & Sessions nicht instrumentiert</h3>
                <p className="mt-2 text-sm text-text-muted">Eindeutige Geräte, Sitzungen, Lizenzplätze und Fernsperren besitzen noch keinen bestätigten Backendvertrag. Deshalb werden keine Geräte, Zählstände oder Sperrerfolge simuliert.</p>
                {canSeeDiag && <Link href="/admin/analytics" className="mt-4 inline-block text-sm font-bold text-navy-900 underline">Zur bestätigten Telemetrie</Link>}
              </div>
            )}
            {activeTab === "textvorlagen" && <TextTemplates />}
            {canManageToggles && activeTab === "features" && <FeatureToggles />}
            {activeTab === "import" && <DataImportCenter />}
            {activeTab === "backup" && <BackupRestoreCenter />}
            {activeTab === "system" && (
              <div className="p-12 text-center border-2 border-dashed border-neutral-gray-200 rounded-2xl text-text-muted space-y-4">
                <Settings className="w-8 h-8 mx-auto opacity-50" />
                <h3 className="font-bold text-navy-900">Systemeinstellungen</h3>
                <p className="text-sm max-w-md mx-auto">Globale Parameter, API-Keys und weitere Funktionen, die nicht im Standardmenü Platz finden.</p>
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
