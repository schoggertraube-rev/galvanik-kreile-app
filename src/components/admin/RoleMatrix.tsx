"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Shield, Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { getFeatureFlags } from "@/app/actions/admin.actions";

const roles = [
  { id: 'developer', name: 'Developer', description: 'Voller Systemzugriff' },
  { id: 'admin', name: 'Admin', description: 'Alle Daten und Einstellungen' },
  { id: 'meister', name: 'Meister', description: 'Produktion und Leitstand' },
  { id: 'buero', name: 'Büro', description: 'Kunden und Rechnungen' },
  { id: 'werkstatt', name: 'Werkstatt', description: 'Status und Fotos' },
  { id: 'readonly', name: 'Nur Lesen', description: 'Keine Änderungen' },
];

type PermissionItem = {
  id: string;
  name: string;
  description: string;
  rolesAllowed: string[];
};

export function RoleMatrix() {
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getFeatureFlags()
      .then((flags) => {
        const perms = flags
          .filter(f => f.id.startsWith("perm_"))
          .map(f => ({
            id: f.id,
            name: f.name,
            description: f.description || "Allgemein",
            rolesAllowed: f.rolesAllowed || []
          }));
        setPermissions(perms);
      })
      .catch((err) => console.error("Failed to fetch permissions", err))
      .finally(() => setLoading(false));
  }, []);

  // Group permissions by description (category)
  const grouped = permissions.reduce((acc, curr) => {
    if (!acc[curr.description]) acc[curr.description] = [];
    acc[curr.description].push(curr);
    return acc;
  }, {} as Record<string, PermissionItem[]>);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-navy-900" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5"/> Rollen und Rechte</CardTitle>
        <CardDescription>Read-only-Übersicht der geladenen Rollenrechte. Änderungen warten auf den W3-Command-Vertrag.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950">NOT_AVAILABLE: Sichere Feature- und Rollenverwaltung benötigt den W3-Command-Vertrag.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-bg-app-soft text-navy-900 border-b">
              <tr>
                <th className="px-4 py-3 font-bold">Recht / Modul</th>
                {roles.map(role => (
                  <th key={role.id} className="px-4 py-3 font-bold text-center">
                    {role.name}
                    <span className="block text-[9px] font-normal text-text-muted">{role.description}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped).map(([category, items]) => (
                <React.Fragment key={category}>
                  <tr className="bg-neutral-gray-50 border-y">
                    <td colSpan={roles.length + 1} className="px-4 py-2 font-bold text-xs text-navy-700 uppercase tracking-wider">
                      {category}
                    </td>
                  </tr>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b last:border-0 hover:bg-bg-app-soft/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-navy-900 flex items-center gap-2">
                        {item.name}
                      </td>
                      {roles.map(role => {
                        const hasAccess = item.rolesAllowed.includes(role.id);
                        return (
                          <td key={role.id} className="px-4 py-3 text-center">
                            <label className="inline-flex items-center justify-center w-6 h-6 rounded">
                              <input 
                                type="checkbox"
                                disabled
                                className="w-4 h-4 text-emerald-600 rounded border-neutral-gray-300 focus:ring-emerald-500 cursor-pointer"
                                checked={hasAccess}
                              />
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
