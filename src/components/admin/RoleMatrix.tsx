"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Shield, Check, Minus } from "lucide-react";
import React from "react";

const roles = [
  { id: 'developer', name: 'Developer', description: 'Voller Systemzugriff' },
  { id: 'admin', name: 'Admin', description: 'Alle Daten & Einstellungen' },
  { id: 'meister', name: 'Meister', description: 'Produktion & Leitstand' },
  { id: 'office', name: 'Büro', description: 'Kunden & Rechnungen' },
  { id: 'workshop', name: 'Werkstatt', description: 'Status & Fotos' },
  { id: 'readonly', name: 'Nur Lesen', description: 'Keine Änderungen' },
];

const permissions = [
  { category: 'System', items: [
    { name: 'Feature-Toggles steuern', access: ['developer'] },
    { name: 'Diagnose & Tests', access: ['developer', 'admin'] },
    { name: 'Benutzer verwalten', access: ['developer', 'admin'] },
  ]},
  { category: 'Daten & Import', items: [
    { name: 'CSV Massenimport', access: ['developer', 'admin'] },
    { name: 'Kunden anlegen/löschen', access: ['developer', 'admin', 'office'] },
    { name: 'Aufträge anlegen', access: ['developer', 'admin', 'office', 'meister'] },
  ]},
  { category: 'Operativ (Werkstatt)', items: [
    { name: 'Auftragsstatus ändern', access: ['developer', 'admin', 'meister', 'workshop'] },
    { name: 'Priorität / Risiko ändern', access: ['developer', 'admin', 'meister'] },
    { name: 'Fotos hochladen', access: ['developer', 'admin', 'meister', 'workshop'] },
    { name: 'Qualitätskontrolle', access: ['developer', 'admin', 'meister'] },
  ]},
  { category: 'Ansicht', items: [
    { name: 'Leitstand sehen', access: ['developer', 'admin', 'meister', 'office', 'workshop', 'readonly'] },
    { name: 'Kundendaten sehen', access: ['developer', 'admin', 'meister', 'office', 'workshop', 'readonly'] },
    { name: 'Preise & Rechnungen sehen', access: ['developer', 'admin', 'office'] },
  ]},
];

export function RoleMatrix() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5"/> Rollen & Rechte</CardTitle>
        <CardDescription>Übersicht der Berechtigungen im System</CardDescription>
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
              {permissions.map((group, i) => (
                <React.Fragment key={i}>
                  <tr className="bg-neutral-gray-50 border-y">
                    <td colSpan={roles.length + 1} className="px-4 py-2 font-bold text-xs text-navy-700 uppercase tracking-wider">
                      {group.category}
                    </td>
                  </tr>
                  {group.items.map((item, j) => (
                    <tr key={j} className="border-b last:border-0 hover:bg-bg-app-soft/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-navy-900">{item.name}</td>
                      {roles.map(role => {
                        const hasAccess = item.access.includes(role.id);
                        return (
                          <td key={role.id} className="px-4 py-3 text-center">
                            {hasAccess ? (
                              <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-600">
                                <Check className="w-3.5 h-3.5" />
                              </div>
                            ) : (
                              <div className="inline-flex items-center justify-center w-6 h-6 text-neutral-gray-300">
                                <Minus className="w-3.5 h-3.5" />
                              </div>
                            )}
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
