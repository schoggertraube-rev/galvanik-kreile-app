"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Shield, Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { getFeatureFlags, updateFeatureFlagRoles } from "@/app/actions/admin.actions";

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
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const flags = await getFeatureFlags();
      const perms = flags
        .filter(f => f.id.startsWith("perm_"))
        .map(f => ({
          id: f.id,
          name: f.name,
          description: f.description || "Allgemein",
          rolesAllowed: f.rolesAllowed || []
        }));
      setPermissions(perms);
    } catch (err) {
      console.error("Failed to fetch permissions", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (permId: string, roleId: string) => {
    setSaving(permId);
    
    // Optimistic update
    setPermissions(prev => prev.map(p => {
      if (p.id === permId) {
        const hasIt = p.rolesAllowed.includes(roleId);
        const newRoles = hasIt 
          ? p.rolesAllowed.filter(r => r !== roleId)
          : [...p.rolesAllowed, roleId];
        
        // Developer is now just a normal role in the array, no special override here
        // Fire background API
        updateFeatureFlagRoles(permId, newRoles).then(() => {
          setSaving(null);
        }).catch(() => {
          setSaving(null);
          alert("Fehler beim Speichern");
          fetchData(); // Rollback
        });

        return { ...p, rolesAllowed: newRoles };
      }
      return p;
    }));
  };

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
        <CardDescription>Übersicht der Berechtigungen im System (Klicken zum Ändern)</CardDescription>
      </CardHeader>
      <CardContent>
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
                        {saving === item.id && <Loader2 className="w-3 h-3 animate-spin text-text-muted" />}
                      </td>
                      {roles.map(role => {
                        const hasAccess = item.rolesAllowed.includes(role.id);
                        return (
                          <td key={role.id} className="px-4 py-3 text-center">
                            <label className="inline-flex items-center justify-center w-6 h-6 rounded cursor-pointer hover:bg-neutral-gray-100 transition-colors">
                              <input 
                                type="checkbox"
                                className="w-4 h-4 text-emerald-600 rounded border-neutral-gray-300 focus:ring-emerald-500 cursor-pointer"
                                checked={hasAccess}
                                onChange={() => handleToggle(item.id, role.id)}
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
