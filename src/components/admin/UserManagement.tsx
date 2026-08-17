"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Shield, Mail } from "lucide-react";
import { getUsers } from "@/app/actions/admin.actions";
import type { AdminUserDto } from "@/lib/auth/userDtos";

export function UserManagement() {
  const [users, setUsers] = useState<AdminUserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await getUsers();
      setUsers(data as AdminUserDto[]);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      await fetchUsers();
    })();
  }, []);

  if (loading && users.length === 0) {
    return <div className="p-8 text-center text-text-muted animate-pulse">Lade Benutzer...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5"/> Benutzerverwaltung</CardTitle>
          <CardDescription>Mitarbeiter, Rollen und Zugänge steuern</CardDescription>
        </div>
        <Button disabled variant="outline" size="sm" className="gap-2">
          <Plus className="w-4 h-4"/>
          Neuer Benutzer
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">

        {error && (
          <div className="p-3 bg-red-50 text-danger-red border border-red-200 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="p-3 bg-bg-app-soft border border-neutral-gray-200 rounded-md text-sm text-text-muted">
          NOT_AVAILABLE: Sichere Benutzerverwaltung benötigt den W3-Command-Vertrag. Benutzermutationen warten auf W3.
        </div>

        <div className="space-y-3">
          {users.map(user => (
            <div key={user.id} className={`p-4 border rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${user.active ? 'bg-white border-neutral-gray-200' : 'bg-neutral-gray-50 border-neutral-gray-100 opacity-70'}`}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-navy-100 flex items-center justify-center text-navy-900 font-bold shrink-0">
                  {user.fullName.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-bold text-navy-900 flex items-center gap-2">
                    {user.fullName}
                    {!user.active && <Badge variant="outline" className="text-[10px] text-danger-red border-danger-red">Deaktiviert</Badge>}
                  </h4>
                  <div className="flex items-center gap-3 text-xs text-text-muted mt-0.5">
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3"/> {user.email}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap md:flex-nowrap items-center gap-3">
                <div className="flex items-center gap-2 bg-bg-app-soft px-3 py-1.5 rounded-lg border border-neutral-gray-200">
                  <Shield className="w-3.5 h-3.5 text-navy-700" />
                  <select 
                    className="bg-transparent text-xs font-bold text-navy-900 outline-none cursor-pointer"
                    value={user.role}
                    disabled
                  >
                    <option value="developer">Developer</option>
                    <option value="admin">Admin</option>
                    <option value="meister">Meister</option>
                    <option value="buero">Büro</option>
                    <option value="werkstatt">Werkstatt</option>
                    <option value="readonly">Nur Lesen</option>
                  </select>
                </div>
                
                <div className="flex items-center gap-1 border border-neutral-gray-200 rounded-lg bg-white px-2 py-1">
                  <span className="text-[10px] text-text-muted font-bold">PIN:</span>
                  <Input
                    type="password"
                    disabled
                    readOnly
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="Nicht verfügbar"
                    aria-label={`PIN für ${user.fullName} ist nicht verfügbar`}
                    title="PIN-Änderung ist nicht verfügbar"
                    className="w-24 h-6 text-xs text-center p-0 bg-transparent border-none focus-visible:ring-0"
                  />
                </div>
                
                <Button 
                  variant={user.active ? "outline" : "default"} 
                  size="sm"
                  className={`text-xs h-8 ${user.active ? 'text-danger-red hover:bg-danger-red hover:text-white border-danger-red/30' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                  disabled
                >
                  {user.active ? "Deaktivieren" : "Aktivieren"}
                </Button>
              </div>
            </div>
          ))}
          {users.length === 0 && !loading && (
            <p className="text-sm text-text-muted text-center py-4">Keine Benutzer gefunden.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
