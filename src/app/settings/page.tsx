"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, User, Bell, Factory } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

export default function SettingsPage() {
  return (
    <div className="space-y-6 pb-12 font-sans antialiased text-navy-900 max-w-4xl mx-auto">
      <div className="bg-gold-100 border-l-4 border-gold-600 p-4 rounded-r-md">
        <div className="flex">
          <div className="shrink-0">
            <AlertCircle className="h-5 w-5 text-gold-600" />
          </div>
          <div className="ml-3">
            <p className="text-sm text-gold-600 font-medium">
              Einstellungen sind in Vorbereitung. Inhalte werden mit der Datenbank-Anbindung freigeschaltet.
            </p>
          </div>
        </div>
      </div>

      <PageHeader
        title="Einstellungen"
        subtitle="Verwalte dein Profil und die Werkstatt-Konfiguration."
      />

      <div className="space-y-6">
        <Card className="opacity-60 pointer-events-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><User className="h-5 w-5"/> Mein Profil</CardTitle>
            <CardDescription>Persönliche Daten und Login-Optionen</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <input disabled type="text" className="w-full border rounded-md p-2 bg-bg-app-soft" placeholder="Max Mustermann" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">E-Mail</label>
              <input disabled type="text" className="w-full border rounded-md p-2 bg-bg-app-soft" placeholder="max@kreile.local" />
            </div>
          </CardContent>
        </Card>

        <Card className="opacity-60 pointer-events-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5"/> Benachrichtigungen</CardTitle>
            <CardDescription>Welche Benachrichtigungen möchtest du erhalten?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <input type="checkbox" disabled checked className="rounded text-navy-900" />
              <label className="text-sm font-medium">E-Mail bei kritischen Aufträgen</label>
            </div>
            <div className="flex items-center space-x-2">
              <input type="checkbox" disabled className="rounded text-navy-900" />
              <label className="text-sm font-medium">Tägliche Zusammenfassung</label>
            </div>
          </CardContent>
        </Card>

        <Card className="opacity-60 pointer-events-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Factory className="h-5 w-5"/> Werkstattdaten</CardTitle>
            <CardDescription>Allgemeine Konfiguration für die Stationen</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Stundensatz (Standard) in €</label>
              <input disabled type="text" className="w-full border rounded-md p-2 bg-bg-app-soft" placeholder="75.00" />
            </div>
            <Button disabled>Speichern</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
