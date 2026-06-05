"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Shield, Mail, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { getUsers, createUser, toggleUserStatus, updateUserRole, updateUserPin } from "@/app/actions/admin.actions";

type AppUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  active: boolean;
  location: string | null;
  language: string | null;
  pinHash: string | null;
};

export function UserManagement() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create User State
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPin, setNewPin] = useState("1234");
  const [newRole, setNewRole] = useState("werkstatt");
  const [isCreating, setIsCreating] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await getUsers();
      setUsers(data as AppUser[]);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async () => {
    if (!newEmail || !newName) return;
    setIsCreating(true);
    setError(null);
    try {
      await createUser({ email: newEmail, fullName: newName, role: newRole, pinHash: newPin });
      setShowCreate(false);
      setNewEmail("");
      setNewName("");
      setNewPin("1234");
      await fetchUsers();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      await toggleUserStatus(id, !currentStatus);
      await fetchUsers();
    } catch (err) {
      alert(String(err));
    }
  };

  const handleRoleChange = async (id: string, newRole: string) => {
    try {
      await updateUserRole(id, newRole);
      await fetchUsers();
    } catch (err) {
      alert(String(err));
    }
  };

  const handlePinChange = async (id: string, newPin: string) => {
    if (newPin.length !== 4) return;
    try {
      await updateUserPin(id, newPin);
      await fetchUsers();
      alert("PIN erfolgreich geändert!");
    } catch (err) {
      alert(String(err));
    }
  };

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
        <Button onClick={() => setShowCreate(!showCreate)} variant="outline" size="sm" className="gap-2">
          {showCreate ? <XCircle className="w-4 h-4"/> : <Plus className="w-4 h-4"/>}
          {showCreate ? "Abbrechen" : "Neuer Benutzer"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">

        {error && (
          <div className="p-3 bg-red-50 text-danger-red border border-red-200 rounded-md text-sm">
            {error}
          </div>
        )}

        {showCreate && (
          <div className="p-4 bg-bg-app-soft border border-neutral-gray-200 rounded-xl space-y-4">
            <h4 className="font-bold text-navy-900 text-sm">Neuen Benutzer anlegen</h4>
            <p className="text-xs text-text-muted">Der Benutzer erhält eine Einladung per E-Mail von Supabase Auth.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-navy-700">Name</label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Max Mustermann" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-navy-700">E-Mail</label>
                <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="max@kreile.de" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-navy-700">Rolle</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-neutral-gray-200 bg-white px-3 py-2 text-sm text-navy-900 outline-none focus:border-navy-900"
                  value={newRole}
                  onChange={e => setNewRole(e.target.value)}
                >
                  <option value="developer">Developer (Voller Zugriff)</option>
                  <option value="admin">Admin (Alle Daten)</option>
                  <option value="meister">Meister (Produktion)</option>
                  <option value="buero">Büro (Kunden und Rechnungen)</option>
                  <option value="werkstatt">Werkstatt (Status & Fotos)</option>
                  <option value="readonly">Nur Lesen</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-navy-700">Tablet-PIN (4 Ziffern)</label>
                <Input value={newPin} onChange={e => setNewPin(e.target.value)} maxLength={4} placeholder="1234" />
              </div>
            </div>
            <Button onClick={handleCreateUser} disabled={isCreating || !newEmail || !newName || newPin.length !== 4} className="w-full md:w-auto">
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Benutzer anlegen
            </Button>
          </div>
        )}

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
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    disabled={!user.active}
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
                    defaultValue={user.pinHash || "1234"} 
                    maxLength={4}
                    className="w-12 h-6 text-xs text-center p-0 bg-transparent border-none focus-visible:ring-0"
                    onBlur={(e) => {
                      if (e.target.value !== user.pinHash && e.target.value.length === 4) {
                        handlePinChange(user.id, e.target.value);
                      }
                    }}
                    disabled={!user.active}
                  />
                </div>
                
                <Button 
                  variant={user.active ? "outline" : "default"} 
                  size="sm"
                  className={`text-xs h-8 ${user.active ? 'text-danger-red hover:bg-danger-red hover:text-white border-danger-red/30' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                  onClick={() => handleToggleStatus(user.id, user.active)}
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
