"use client";

import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";
import React, { useState } from 'react';
import { 
  MonitorSmartphone, Laptop, Smartphone, 
  Shield, ShieldCheck, KeyRound, 
  ArrowRight, Info, Activity, 
  Server, CheckSquare, FileSignature, Receipt, CheckCircle, Database
} from 'lucide-react';
import { DetailOverlay } from '@/components/ui/DetailOverlay';
import Link from 'next/link';

interface Device {
  id: string;
  name: string;
  type: 'Tablet' | 'Desktop' | 'Mobile';
  browser: string;
  lastAccess: string;
  role: string;
  status: 'freigegeben' | 'unbekannt' | 'gesperrt' | 'prüfen';
}

export function AdminDevicesClient() {
  const [activeOverlay, setActiveOverlay] = useState<string | null>(null);
  const [demoNotification, setDemoNotification] = useState<string | null>(null);
  
  // Interactive mock devices state
  const [devices] = useState<Device[]>([
    { id: '1', name: 'Meister-Tablet Halle 1', type: 'Tablet', browser: 'Safari (iPadOS)', lastAccess: 'Vor 12 Min.', role: 'Werkstatt', status: 'freigegeben' },
    { id: '2', name: 'Büro Desktop (Frau S.)', type: 'Desktop', browser: 'Chrome (Windows)', lastAccess: 'Vor 2 Min.', role: 'Büro', status: 'freigegeben' },
    { id: '3', name: 'Unbekanntes iPhone', type: 'Mobile', browser: 'Safari (iOS)', lastAccess: 'Vor 1 Std.', role: 'Admin', status: 'prüfen' },
    { id: '4', name: 'Alt-Terminal Beschichtung', type: 'Desktop', browser: 'Edge (Windows)', lastAccess: 'Vor 3 Tagen', role: 'Werkstatt', status: 'gesperrt' },
  ]);

  // Handover checklist state
  const [checklist, setChecklist] = useState({
    email: false,
    supabaseOwner: false,
    vercelTeam: false,
    domains: false,
    apiKeys: false,
    backupConcept: false,
    clearDemoData: false,
    adminCredentials: false,
    documentation: false,
  });

  const closeOverlay = () => setActiveOverlay(null);

  const toggleChecklistItem = (key: keyof typeof checklist) => {
    setChecklist(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handlePrepareAction = (type: 'approve' | 'lock') => {
    if (type === 'approve') {
      setDemoNotification(
        "Vorbereitet: Freigabe-Aktion registriert. Eine echte Freigabe erfordert die künftige Datenbank-Kopplung über die device_id in Supabase."
      );
    } else {
      setDemoNotification(
        "Vorbereitet: Sperrungs-Aktion registriert. Die harte Sperrlogik wird später per Device-ID und Session-Tabelle client- und serverseitig erzwungen."
      );
    }
    setTimeout(() => setDemoNotification(null), 7000);
  };

  // Demo Metrics calculation
  const totalAllowed = 15;
  const utilizedCount = devices.filter(d => d.status === 'freigegeben').length;
  const freeSlotsCount = Math.max(0, totalAllowed - utilizedCount);
  const unknownCount = devices.filter(d => d.status === 'prüfen' || d.status === 'unbekannt').length;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8 font-sans antialiased text-navy-900 min-h-screen bg-[#F0EBE0]">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-navy-900 mb-2 font-serif flex items-center gap-3">
          <MonitorSmartphone className="w-8 h-8" />
          Geräte, Lizenzen und Sicherheit
        </h1>
        <p className="text-text-muted text-sm md:text-base">
          Zentrale Plattform-Verwaltung für den Mandanten (Admin und Developer).
        </p>
      </header>

      {demoNotification && (
        <div className="mb-6 bg-navy-900 text-white p-4 rounded-xl shadow-md border-l-4 border-accent-orange flex gap-3 items-start animate-fade-in">
          <Info className="w-5 h-5 text-accent-orange shrink-0 mt-0.5" />
          <div className="text-sm font-medium">
            <p className="font-bold mb-1">Demo-Modus / Konzept-Vorschau</p>
            <p>{demoNotification}</p>
          </div>
        </div>
      )}

      {/* SECTION 1: Zugriffsüberwachung und Geräte */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-navy-900 font-serif">1. Zugriffsüberwachung und Geräte</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Aktive Zugriffe */}
          <button onClick={() => setActiveOverlay("active_access")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-success-green/10 rounded-xl flex items-center justify-center text-success-green">
                  <Activity className="w-6 h-6" />
                </div>
                <span className="text-3xl font-bold text-navy-900">4</span>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Aktive Zugriffe</h3>
              <p className="text-sm text-text-muted font-medium">Derzeit verbundene Nutzer</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Details ansehen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* Freigegebene Geräte */}
          <button onClick={() => setActiveOverlay("approved_devices")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-navy-900/10 rounded-xl flex items-center justify-center text-navy-900">
                  <CheckCircle className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Freigegebene Geräte</h3>
              <p className="text-sm text-text-muted font-medium">Liste bekannter Endgeräte</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Geräte prüfen und verwalten <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* Gerätetypen */}
          <button onClick={() => setActiveOverlay("device_types")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-[#2563EB]/10 rounded-xl flex items-center justify-center text-[#2563EB]">
                  <MonitorSmartphone className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Gerätetypen und Browser</h3>
              <p className="text-sm text-text-muted font-medium">Desktop / Tablet / Mobile</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Verteilung prüfen <ArrowRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      </section>

      {/* SECTION 2: Lizenzen und Betrieb */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-navy-900 font-serif">2. Lizenzen und Betrieb</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Gerätelizenz */}
          <button onClick={() => setActiveOverlay("device_license")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-accent-orange/10 rounded-xl flex items-center justify-center text-accent-orange">
                  <KeyRound className="w-6 h-6" />
                </div>
                <span className="text-xl font-bold text-navy-900">{utilizedCount} / {totalAllowed}</span>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Gerätelizenz</h3>
              <p className="text-sm text-text-muted font-medium">Slots genutzt</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Lizenz einsehen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* Lizenzmodell */}
          <button onClick={() => setActiveOverlay("license_model")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-purple-600/10 rounded-xl flex items-center justify-center text-purple-600">
                  <Receipt className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Lizenzmodell</h3>
              <p className="text-sm text-text-muted font-medium">Konditionen und Pakete</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Optionen prüfen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* Wartungsvertrag */}
          <button onClick={() => setActiveOverlay("maintenance")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
                  <FileSignature className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Wartungsvertrag</h3>
              <p className="text-sm text-text-muted font-medium">SLA und Updates</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Inhalte ansehen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* Betriebskosten */}
          <button onClick={() => setActiveOverlay("server_costs")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-teal-500/10 rounded-xl flex items-center justify-center text-teal-500">
                  <Server className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Betriebskosten</h3>
              <p className="text-sm text-text-muted font-medium">Server und Hosting</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Details prüfen <ArrowRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      </section>

      {/* SECTION 3: Mandanten und Sicherheit */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-navy-900 font-serif">3. Mandanten und Sicherheit</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Mandanten-Sicherheit */}
          <button onClick={() => setActiveOverlay("tenant_security")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-navy-900/10 rounded-xl flex items-center justify-center text-navy-900">
                  <Database className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Mandanten-Sicherheit</h3>
              <p className="text-sm text-text-muted font-medium">Datentrennung und Prinzipien</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Konzept ansehen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* Zugriffsregeln */}
          <button onClick={() => setActiveOverlay("access_rules")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-neutral-gray-100 rounded-xl flex items-center justify-center text-navy-900">
                  <ShieldCheck className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Zugriffsregeln</h3>
              <p className="text-sm text-text-muted font-medium">Geplantes Rollen-Regelwerk</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Regeln ansehen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* Übergabe-Check */}
          <button onClick={() => setActiveOverlay("handover")} className="text-left bg-navy-900 rounded-2xl p-5 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-white">
                  <CheckSquare className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-white text-lg mb-1">Übergabe-Check</h3>
              <p className="text-sm text-white/70 font-medium">Checkliste für Verkauf/Launch</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-white/80 group-hover:text-white transition-colors">
              Checkliste öffnen <ArrowRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      </section>

      {/* ========================================================
          OVERLAYS
          ======================================================== */}

      {/* Aktive Zugriffe */}
      <DetailOverlay open={activeOverlay === "active_access"} onClose={closeOverlay} title="Aktive Zugriffe" subtitle="Nutzer, die in den letzten 15 Minuten in der App aktiv waren.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-warning-yellow/10 border border-warning-yellow/30 rounded-xl p-4 flex gap-3">
            <Info className="w-5 h-5 text-warning-yellow shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-navy-900">Demo / Fallback-Daten</h4>
              <p className="text-sm text-text-muted">Da das Backend fehlt, sind dies simulierte Werte basierend auf der künftigen Echtzeit-Telemetrie.</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="bg-bg-app-soft p-4 rounded-xl border border-neutral-gray-200 flex justify-between items-center">
              <div>
                <p className="font-bold text-navy-900">M. Müller <span className="text-xs bg-navy-900 text-white px-2 py-0.5 rounded ml-2">Admin</span></p>
                <p className="text-xs text-text-muted mt-1">Route: /admin/devices</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold flex items-center gap-1 justify-end"><Laptop className="w-4 h-4 text-text-muted" /> Desktop</p>
                <p className="text-xs text-success-green font-bold mt-1">Jetzt aktiv</p>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-xl border border-neutral-gray-200 flex justify-between items-center">
              <div>
                <p className="font-bold text-navy-900">T. Handwerker <span className="text-xs bg-neutral-gray-200 text-navy-900 px-2 py-0.5 rounded ml-2">Werkstatt</span></p>
                <p className="text-xs text-text-muted mt-1">Route: /station/beschichtung</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold flex items-center gap-1 justify-end"><Smartphone className="w-4 h-4 text-text-muted" /> Tablet</p>
                <p className="text-xs text-text-muted mt-1">Vor 2 Min.</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-neutral-gray-200 flex justify-between items-center">
              <div>
                <p className="font-bold text-navy-900">S. Schmidt <span className="text-xs bg-neutral-gray-200 text-navy-900 px-2 py-0.5 rounded ml-2">Büro</span></p>
                <p className="text-xs text-text-muted mt-1">Route: /quotes</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold flex items-center gap-1 justify-end"><Laptop className="w-4 h-4 text-text-muted" /> Desktop</p>
                <p className="text-xs text-text-muted mt-1">Vor 12 Min.</p>
              </div>
            </div>
          </div>
        </div>
      </DetailOverlay>

      {/* Freigegebene Geräte */}
      <DetailOverlay open={activeOverlay === "approved_devices"} onClose={closeOverlay} title="Freigegebene Geräte" subtitle="Liste der verknüpften Endgeräte.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-white rounded-xl border border-neutral-gray-200 overflow-hidden">
            <div className="p-3 bg-bg-app-soft font-bold text-xs border-b border-neutral-gray-200 flex gap-4 uppercase tracking-wider text-text-muted">
              <div className="flex-2">Gerät und Typ</div>
              <div className="flex-1">Rolle</div>
              <div className="flex-1">Letzter Zugriff</div>
              <div className="w-28 text-right">Status</div>
            </div>
            <div className="divide-y divide-neutral-gray-100">
              {devices.map((device) => (
                <div key={device.id} className="p-3 flex items-center gap-4 text-sm">
                  <div className="flex-2">
                    <p className="font-bold text-navy-900">{device.name}</p>
                    <p className="text-xs text-text-muted">{device.type} • {device.browser}</p>
                  </div>
                  <div className="flex-1">
                    <span className="text-xs bg-neutral-gray-100 text-navy-900 px-2 py-0.5 rounded font-medium">
                      {device.role}
                    </span>
                  </div>
                  <div className="flex-1 text-xs text-text-muted">
                    {device.lastAccess}
                  </div>
                  <div className="w-28 text-right">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                      device.status === 'freigegeben' ? 'bg-success-green/10 text-success-green' :
                      device.status === 'gesperrt' ? 'bg-error-red/10 text-error-red' :
                      device.status === 'prüfen' ? 'bg-warning-yellow/20 text-warning-yellow' :
                      'bg-neutral-gray-100 text-text-muted'
                    }`}>
                      {device.status.charAt(0).toUpperCase() + device.status.slice(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-bg-app-soft p-4 rounded-xl border border-neutral-gray-200 text-xs text-text-muted">
            <p className="font-bold text-navy-900 mb-1">Architektur-Hinweis:</p>
            <p>Backend-Sperrlogik später per Device-ID und Session-Tabelle. Alle Sperren und Zugriffsrechte werden über RLS Policies in Supabase und ein Middleware-Token-Check abgesichert.</p>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={() => handlePrepareAction('approve')}
              className="flex-1 border-2 border-navy-900 text-navy-900 font-bold p-3 rounded-xl hover:bg-bg-app-soft transition-colors text-sm text-center"
            >
              Freigabe vorbereiten
            </button>
            <button 
              onClick={() => handlePrepareAction('lock')}
              className="flex-1 bg-error-red text-white font-bold p-3 rounded-xl hover:bg-red-700 transition-colors text-sm text-center"
            >
              Sperre vorbereiten
            </button>
          </div>
        </div>
      </DetailOverlay>

      {/* Gerätetypen und Browser */}
      <DetailOverlay open={activeOverlay === "device_types"} onClose={closeOverlay} title="Gerätetypen und Browser" subtitle="Hardware und Software Verteilung.">
        <div className="space-y-6 text-navy-900">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-white p-4 rounded-xl border border-neutral-gray-200">
              <Laptop className="w-8 h-8 mx-auto text-[#2563EB] mb-2" />
              <span className="block text-2xl font-black text-navy-900">45%</span>
              <span className="text-xs text-text-muted uppercase tracking-wider font-bold">Desktop</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-neutral-gray-200">
              <MonitorSmartphone className="w-8 h-8 mx-auto text-success-green mb-2" />
              <span className="block text-2xl font-black text-navy-900">35%</span>
              <span className="text-xs text-text-muted uppercase tracking-wider font-bold">Tablet</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-neutral-gray-200">
              <Smartphone className="w-8 h-8 mx-auto text-accent-orange mb-2" />
              <span className="block text-2xl font-black text-navy-900">20%</span>
              <span className="text-xs text-text-muted uppercase tracking-wider font-bold">Mobile</span>
            </div>
          </div>
          <div className="bg-bg-app-soft p-4 rounded-xl border border-neutral-gray-200">
            <h4 className="font-bold mb-2">Hinweis für UI-Optimierung</h4>
            <p className="text-sm text-text-muted">Da Tablets in der Werkstatt über 35% der Nutzung ausmachen, sollten Touch-Targets (Buttons) weiterhin auf mindestens 48x48px gehalten werden. Listenansichten wie in &quot;/warendurchlauf&quot; müssen zwingend auf Landscape-Tablets getestet werden.</p>
          </div>
        </div>
      </DetailOverlay>

      {/* Gerätelizenz */}
      <DetailOverlay open={activeOverlay === "device_license"} onClose={closeOverlay} title="Gerätelizenzierung" subtitle="Übersicht der lizenzierten Endgeräte.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-bg-app-soft p-4 rounded-xl border border-neutral-gray-200 text-sm space-y-2">
            <p className="font-bold">Modell-Definition:</p>
            <p className="text-text-muted">
              Um unkontrollierten Wildwuchs zu vermeiden, wird ein striktes Limit-Verfahren angewendet.
            </p>
            <ul className="list-disc pl-5 text-text-muted space-y-1">
              <li><strong>Lizenz pro Gerät:</strong> Jedes Endgerät registriert sich mit einer eindeutigen UUID.</li>
              <li><strong>Lizenz pro Betrieb:</strong> Der Mandant kauft ein Paket mit einer maximalen Geräteanzahl.</li>
              <li><strong>Admin-Freigabe:</strong> Nur der Administrator kann neue Geräte aktivieren. Der Kunde kann nicht selbst beliebig Geräte hinzufügen.</li>
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-neutral-gray-200 rounded-xl p-4 text-center">
              <div className="text-3xl font-black text-navy-900">{utilizedCount}</div>
              <div className="text-xs font-bold text-text-muted uppercase mt-1">Genutzte Geräte</div>
            </div>
            <div className="bg-white border border-neutral-gray-200 rounded-xl p-4 text-center">
              <div className="text-3xl font-black text-navy-900">{totalAllowed}</div>
              <div className="text-xs font-bold text-text-muted uppercase mt-1">Erlaubte Geräte</div>
            </div>
            <div className="bg-white border border-neutral-gray-200 rounded-xl p-4 text-center">
              <div className="text-3xl font-black text-success-green">{freeSlotsCount}</div>
              <div className="text-xs font-bold text-text-muted uppercase mt-1">Freie Slots</div>
            </div>
            <div className="bg-white border border-neutral-gray-200 rounded-xl p-4 text-center">
              <div className="text-3xl font-black text-warning-yellow">{unknownCount}</div>
              <div className="text-xs font-bold text-text-muted uppercase mt-1">Unbekannt / Prüfen</div>
            </div>
          </div>
        </div>
      </DetailOverlay>

      {/* Lizenzmodell */}
      <DetailOverlay open={activeOverlay === "license_model"} onClose={closeOverlay} title="Lizenzmodell" subtitle="Konditionen und geplante Abrechnungspakete.">
        <div className="space-y-4 text-navy-900">
          <div className="bg-bg-app-soft p-4 rounded-xl border border-neutral-gray-200 text-sm mb-2">
            <p className="font-bold mb-1">Flexibles Verwertungssystem (Preise nicht fest verdrahtet)</p>
            <p className="text-text-muted">
              Die Vergütung kann modular angepasst werden. Nachfolgend ist die vorbereitete Paketstruktur aufgeführt:
            </p>
          </div>

          <div className="bg-white border border-neutral-gray-200 rounded-xl p-4">
            <h4 className="font-bold mb-1 text-navy-900">1. Einmaliger Verkauf</h4>
            <p className="text-sm text-text-muted">Kauf der Softwarelizenz zur Eigennutzung (On-Premise oder dedizierte Instanz). Optionale Wartung separat.</p>
          </div>
          <div className="bg-white border border-neutral-gray-200 rounded-xl p-4">
            <h4 className="font-bold mb-1 text-navy-900">2. Einrichtungspaket</h4>
            <p className="text-sm text-text-muted">Einmalige Dienstleistung für Datenimport (Kundenstamm, Artikelkatalog), Anpassung des Layouts und Schulung vor Ort.</p>
          </div>
          <div className="bg-white border border-neutral-gray-200 rounded-xl p-4">
            <h4 className="font-bold mb-1 text-navy-900">3. Wartungsvertrag (monatlich / jährlich)</h4>
            <p className="text-sm text-text-muted">Regelmäßige Pflegevereinbarung für garantierte Fehlerbehebung, Telefon-Support und gesetzliche Aktualisierungen.</p>
          </div>
          <div className="bg-white border border-neutral-gray-200 rounded-xl p-4">
            <h4 className="font-bold mb-1 text-navy-900">4. Gerätepauschale</h4>
            <p className="text-sm text-text-muted">SaaS-Modell mit monatlichen Gebühren, gestaffelt nach der Anzahl der aktivierten Endgeräte in der Werkstatt.</p>
          </div>
          <div className="bg-white border border-neutral-gray-200 rounded-xl p-4">
            <h4 className="font-bold mb-1 text-navy-900">5. Zusatzmodule</h4>
            <p className="text-sm text-text-muted">Zusatzfunktionen (z.B. Datev-Export, OCR-Erkennung, erweiterte Sensorik) können einzeln freigeschaltet werden.</p>
          </div>
        </div>
      </DetailOverlay>

      {/* Wartungsvertrag */}
      <DetailOverlay open={activeOverlay === "maintenance"} onClose={closeOverlay} title="Wartungsvertrag" subtitle="Umfang der technischen und betrieblichen Betreuung.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
            <p className="text-sm font-bold text-blue-900">Status: Konzept vorbereitet</p>
            <p className="text-xs text-blue-700 mt-1">Pflichtenheft und Service-Level-Agreements für den Endkunden.</p>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold text-sm text-navy-900 uppercase tracking-wider">Inklusiv-Leistungen:</h4>
            <ul className="space-y-2">
              <li className="flex gap-3 bg-white p-3 rounded-lg border border-neutral-gray-200">
                <CheckCircle className="w-5 h-5 text-success-green shrink-0 mt-0.5"/> 
                <div>
                  <p className="text-sm font-bold">Updates und Sicherheitsupdates</p>
                  <p className="text-xs text-text-muted">Einspielen von Patches, Performance-Verbesserungen und Schutz vor neuen Sicherheitsrisiken.</p>
                </div>
              </li>
              <li className="flex gap-3 bg-white p-3 rounded-lg border border-neutral-gray-200">
                <CheckCircle className="w-5 h-5 text-success-green shrink-0 mt-0.5"/> 
                <div>
                  <p className="text-sm font-bold">Support</p>
                  <p className="text-xs text-text-muted">Zuverlässiger Ansprechpartner bei Bedienfragen oder Störungen per E-Mail und Telefon.</p>
                </div>
              </li>
              <li className="flex gap-3 bg-white p-3 rounded-lg border border-neutral-gray-200">
                <CheckCircle className="w-5 h-5 text-success-green shrink-0 mt-0.5"/> 
                <div>
                  <p className="text-sm font-bold">Backup-Prüfung</p>
                  <p className="text-xs text-text-muted">Automatisierte tägliche Backups der Datenbank inklusive Wiederherstellungs-Tests.</p>
                </div>
              </li>
              <li className="flex gap-3 bg-white p-3 rounded-lg border border-neutral-gray-200">
                <CheckCircle className="w-5 h-5 text-success-green shrink-0 mt-0.5"/> 
                <div>
                  <p className="text-sm font-bold">Kleine Anpassungen</p>
                  <p className="text-xs text-text-muted">Optimierungen an Layouts, kleine Textänderungen oder Anpassungen von PDF-Exportvorlagen.</p>
                </div>
              </li>
              <li className="flex gap-3 bg-white p-3 rounded-lg border border-neutral-gray-200">
                <CheckCircle className="w-5 h-5 text-success-green shrink-0 mt-0.5"/> 
                <div>
                  <p className="text-sm font-bold">Monitoring</p>
                  <p className="text-xs text-text-muted">24/7 Überwachung der Server-Verfügbarkeit und API-Schnittstellen.</p>
                </div>
              </li>
              <li className="flex gap-3 bg-white p-3 rounded-lg border border-neutral-gray-200">
                <CheckCircle className="w-5 h-5 text-success-green shrink-0 mt-0.5"/> 
                <div>
                  <p className="text-sm font-bold">Schnittstellenpflege</p>
                  <p className="text-xs text-text-muted">Überwachung und Anpassung von Schnittstellen bei Versions-Upgrades externer Dienste.</p>
                </div>
              </li>
              <li className="flex gap-3 bg-white p-3 rounded-lg border border-neutral-gray-200">
                <CheckCircle className="w-5 h-5 text-success-green shrink-0 mt-0.5"/> 
                <div>
                  <p className="text-sm font-bold">Jahreswechsel / Steuer- / Exportprüfung</p>
                  <p className="text-xs text-text-muted">Kontrolle der Berechnungslogiken und Exporte zum Jahresende zur Einhaltung rechtlicher Standards.</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </DetailOverlay>

      {/* Betriebskosten */}
      <DetailOverlay open={activeOverlay === "server_costs"} onClose={closeOverlay} title="Serverkosten und Betriebskosten" subtitle="Zentrale Aufwände und Abrechnungsschlüssel.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-bg-app-soft p-4 rounded-xl border border-neutral-gray-200 text-sm space-y-2">
            <p className="font-bold">Betriebskosten-Logik:</p>
            <p className="text-text-muted">
              Die laufenden Kosten der genutzten Dienste können auf verschiedene Weisen abgerechnet werden:
            </p>
            <ul className="list-disc pl-5 text-text-muted space-y-1">
              <li><strong>Pauschal weiterberechnen:</strong> Der Kunde zahlt eine feste monatliche Infrastrukturgebühr.</li>
              <li><strong>Pro Mandant kalkulieren:</strong> Jeder Mandant erhält eine genaue Abrechnung basierend auf dem realen Speicher- und API-Verbrauch.</li>
              <li><strong>Zentrale Plattform:</strong> Eine geteilte Hauptinstanz minimiert die Grundgebühren massiv, erfordert jedoch eine strikte Datentrennung (RLS).</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-text-muted mb-2">Erfasste Dienste:</h4>
            
            <div className="flex justify-between items-center bg-white border border-neutral-gray-200 p-3 rounded-lg text-sm">
              <span className="font-bold">Vercel</span>
              <span className="text-xs text-text-muted">Hosting und Edge Routing</span>
            </div>
            <div className="flex justify-between items-center bg-white border border-neutral-gray-200 p-3 rounded-lg text-sm">
              <span className="font-bold">Supabase</span>
              <span className="text-xs text-text-muted">Postgres-Datenbank und Authentifizierung</span>
            </div>
            <div className="flex justify-between items-center bg-white border border-neutral-gray-200 p-3 rounded-lg text-sm">
              <span className="font-bold">E-Mail / Resend / Brevo</span>
              <span className="text-xs text-text-muted">Transaktionsmails und Status-Updates</span>
            </div>
            <div className="flex justify-between items-center bg-white border border-neutral-gray-200 p-3 rounded-lg text-sm">
              <span className="font-bold">Storage / Backup-Speicher</span>
              <span className="text-xs text-text-muted">S3 Bucket für Lieferscheine und Schadensbilder</span>
            </div>
            <div className="flex justify-between items-center bg-white border border-neutral-gray-200 p-3 rounded-lg text-sm">
              <span className="font-bold">Payment Provider</span>
              <span className="text-xs text-text-muted">Transaktionsgebühren für Online-Zahlung</span>
            </div>
            <div className="flex justify-between items-center bg-white border border-neutral-gray-200 p-3 rounded-lg text-sm">
              <span className="font-bold">Domains und SSL</span>
              <span className="text-xs text-text-muted">Registrierungsgebühren und Zertifikate</span>
            </div>
            <div className="flex justify-between items-center bg-white border border-neutral-gray-200 p-3 rounded-lg text-sm">
              <span className="font-bold">Monitoring</span>
              <span className="text-xs text-text-muted">Fehlerüberwachung und Uptime-Alerting</span>
            </div>
            <div className="flex justify-between items-center bg-white border border-neutral-gray-200 p-3 rounded-lg text-sm">
              <span className="font-bold">Supportzeit</span>
              <span className="text-xs text-text-muted">Bereitschaftszeit des Entwicklers</span>
            </div>
          </div>

          <div className="pt-2">
            <Link href="/finanzen" className="w-full bg-navy-900 text-white font-bold p-3 rounded-xl flex items-center justify-center gap-2 hover:bg-navy-800 transition-colors text-sm">
              Kalkulations-Grundlagen in Finanzen einsehen <ArrowRight className="w-4 h-4"/>
            </Link>
          </div>
        </div>
      </DetailOverlay>

      {/* Mandanten-Sicherheit */}
      <DetailOverlay open={activeOverlay === "tenant_security"} onClose={closeOverlay} title="Mandanten-Sicherheit" subtitle="Isolierung, Rechte und Auditierung auf Plattform-Ebene.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-bg-app-soft p-4 rounded-xl border border-neutral-gray-200 text-sm space-y-3">
            <h4 className="font-bold text-navy-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-accent-orange shrink-0" />
              Sicherheits- und Trennungs-Prinzipien
            </h4>
            <ul className="list-disc pl-5 text-text-muted space-y-2">
              <li>
                <strong>Keine Datenvermischung:</strong> Durchgängige Absicherung aller Datenbankabfragen. Jede Tabelle erfordert zwingend das Feld <code className="bg-neutral-gray-200 px-1 py-0.5 rounded text-navy-900 text-xs font-mono">tenant_id</code>.
              </li>
              <li>
                <strong>Row Level Security (RLS):</strong> Supabase erfordert explizite Policies, die den Zugriff auf Datensätze ohne gültigen Mandanten-Key blockieren.
              </li>
              <li>
                <strong>Rollen je Mandant:</strong> Nutzer erhalten Berechtigungen, die ausschließlich innerhalb ihres Mandanten gültig sind.
              </li>
              <li>
                <strong>Admin und Developer getrennt:</strong> Plattform-Administratoren nutzen gesonderte Zugänge mit weitreichenden Rechten, die strikt vom operativen Mandanten-Betrieb isoliert sind.
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold text-sm text-navy-900 uppercase tracking-wider">Geplante Architektur-Bausteine im UI:</h4>
            
            <div className="bg-white p-4 rounded-xl border border-neutral-gray-200 space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm text-navy-900">1. Audit-Log</span>
                <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-bold">Vorbereitet</span>
              </div>
              <p className="text-xs text-text-muted">Protokollierung aller sicherheitsrelevanten Aktionen (z.B. Stammdaten-Löschung, Rechte-Änderungen) mit Zeitstempel und User-ID.</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-neutral-gray-200 space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm text-navy-900">2. Demo-Daten trennbar und löschbar</span>
                <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-bold">Vorbereitet</span>
              </div>
              <p className="text-xs text-text-muted">Eine automatisierte Routine, um sämtliche initialen Demodatensätze spurlos zu entfernen, bevor der Mandant produktiv geht.</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-neutral-gray-200 space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm text-navy-900">3. Backup-Konzept</span>
                <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-bold">Vorbereitet</span>
              </div>
              <p className="text-xs text-text-muted">Tägliche, verschlüsselte Sicherung in eine getrennte Cloud-Region mit einer Aufbewahrungsfrist von 30 Tagen (Point-in-Time Recovery).</p>
            </div>
          </div>
        </div>
      </DetailOverlay>

      {/* Zugriffsregeln */}
      <DetailOverlay open={activeOverlay === "access_rules"} onClose={closeOverlay} title="Zugriffsregeln" subtitle="Rollen und Berechtigungen im Betrieb.">
        <div className="space-y-4 text-navy-900">
          <div className="bg-white border border-neutral-gray-200 rounded-xl p-4">
            <h4 className="font-bold border-b border-neutral-gray-100 pb-2 mb-2 text-navy-900">Rolle: Admin / Developer</h4>
            <p className="text-sm text-text-muted">Vollzugriff auf alle Bereiche der App. Berechtigt zur Lizenzverwaltung, Änderung der Systemparameter und Einsicht in alle Mandantendaten.</p>
          </div>
          <div className="bg-white border border-neutral-gray-200 rounded-xl p-4">
            <h4 className="font-bold border-b border-neutral-gray-100 pb-2 mb-2 text-navy-900">Rolle: Büro</h4>
            <p className="text-sm text-text-muted">Schreib- und Leserechte für Angebote, Auftragsdetails, Kundenkartei und Rechnungsstellung. Eingeschränkter Systemzugriff.</p>
          </div>
          <div className="bg-white border border-neutral-gray-200 rounded-xl p-4">
            <h4 className="font-bold border-b border-neutral-gray-100 pb-2 mb-2 text-navy-900">Rolle: Werkstatt</h4>
            <p className="text-sm text-text-muted">Optimiert für Tablets. Nur Zugriff auf Warendurchlauf, Barcode-Scanner, Bädersteuerung und Checklisten. Sensible Finanzdaten sind ausgeblendet.</p>
          </div>
        </div>
      </DetailOverlay>

      {/* Übergabe-Check */}
      <DetailOverlay open={activeOverlay === "handover"} onClose={closeOverlay} title="Übergabe-Check" subtitle="Checkliste für den Verkauf und Launch der App.">
        <div className="space-y-4 text-navy-900">
          <p className="text-sm text-text-muted mb-4">
            Diese Kontrollpunkte müssen vor der finalen Abnahme und dem Übergang in den Produktivbetrieb durchlaufen werden.
          </p>
          
          <div className="space-y-3">
            <label className="flex items-start gap-3 p-3 bg-white border border-neutral-gray-200 rounded-xl cursor-pointer hover:bg-bg-app-soft transition-colors">
              <input 
                type="checkbox" 
                checked={checklist.email} 
                onChange={() => toggleChecklistItem('email')}
                className="w-5 h-5 accent-navy-900 shrink-0 mt-0.5 rounded" 
              />
              <div>
                <span className="text-sm font-bold block text-navy-900">Neutrale Projekt-E-Mail einrichten</span>
                <span className="text-xs text-text-muted block mt-0.5">Nutzung einer betriebseigenen Adresse (z.B. support@betrieb.de) für Benachrichtigungen.</span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 bg-white border border-neutral-gray-200 rounded-xl cursor-pointer hover:bg-bg-app-soft transition-colors">
              <input 
                type="checkbox" 
                checked={checklist.supabaseOwner} 
                onChange={() => toggleChecklistItem('supabaseOwner')}
                className="w-5 h-5 accent-navy-900 shrink-0 mt-0.5 rounded" 
              />
              <div>
                <span className="text-sm font-bold block text-navy-900">Supabase Owner prüfen und übertragen</span>
                <span className="text-xs text-text-muted block mt-0.5">Übergabe der primären Eigentümerrechte an den Haupt-Account des Kunden.</span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 bg-white border border-neutral-gray-200 rounded-xl cursor-pointer hover:bg-bg-app-soft transition-colors">
              <input 
                type="checkbox" 
                checked={checklist.vercelTeam} 
                onChange={() => toggleChecklistItem('vercelTeam')}
                className="w-5 h-5 accent-navy-900 shrink-0 mt-0.5 rounded" 
              />
              <div>
                <span className="text-sm font-bold block text-navy-900">Vercel-Team und Projekt-Rechte übertragen</span>
                <span className="text-xs text-text-muted block mt-0.5">Einrichtung des produktiven Vercel-Projektes im Kunden-Account.</span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 bg-white border border-neutral-gray-200 rounded-xl cursor-pointer hover:bg-bg-app-soft transition-colors">
              <input 
                type="checkbox" 
                checked={checklist.domains} 
                onChange={() => toggleChecklistItem('domains')}
                className="w-5 h-5 accent-navy-900 shrink-0 mt-0.5 rounded" 
              />
              <div>
                <span className="text-sm font-bold block text-navy-900">Domains und DNS-Einträge finalisieren</span>
                <span className="text-xs text-text-muted block mt-0.5">Aufschalten der finalen Domain inklusive SSL-Absicherung.</span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 bg-white border border-neutral-gray-200 rounded-xl cursor-pointer hover:bg-bg-app-soft transition-colors">
              <input 
                type="checkbox" 
                checked={checklist.apiKeys} 
                onChange={() => toggleChecklistItem('apiKeys')}
                className="w-5 h-5 accent-navy-900 shrink-0 mt-0.5 rounded" 
              />
              <div>
                <span className="text-sm font-bold block text-navy-900">API-Keys und Secrets rotieren</span>
                <span className="text-xs text-text-muted block mt-0.5">Sicheres Austauschen aller Entwicklungsschlüssel gegen produktive Anmeldedaten.</span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 bg-white border border-neutral-gray-200 rounded-xl cursor-pointer hover:bg-bg-app-soft transition-colors">
              <input 
                type="checkbox" 
                checked={checklist.backupConcept} 
                onChange={() => toggleChecklistItem('backupConcept')}
                className="w-5 h-5 accent-navy-900 shrink-0 mt-0.5 rounded" 
              />
              <div>
                <span className="text-sm font-bold block text-navy-900">Backupkonzept aktivieren</span>
                <span className="text-xs text-text-muted block mt-0.5">Aktivieren und Testen der automatischen Datenbank- und Datei-Backups.</span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 bg-white border border-neutral-gray-200 rounded-xl cursor-pointer hover:bg-bg-app-soft transition-colors">
              <input 
                type="checkbox" 
                checked={checklist.clearDemoData} 
                onChange={() => toggleChecklistItem('clearDemoData')}
                className="w-5 h-5 accent-navy-900 shrink-0 mt-0.5 rounded" 
              />
              <div>
                <span className="text-sm font-bold block text-navy-900">Demo-Daten vollständig löschen</span>
                <span className="text-xs text-text-muted block mt-0.5">Sicheres Bereinigen der Beispieldatensätze aus der Live-Datenbank.</span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 bg-white border border-neutral-gray-200 rounded-xl cursor-pointer hover:bg-bg-app-soft transition-colors">
              <input 
                type="checkbox" 
                checked={checklist.adminCredentials} 
                onChange={() => toggleChecklistItem('adminCredentials')}
                className="w-5 h-5 accent-navy-900 shrink-0 mt-0.5 rounded" 
              />
              <div>
                <span className="text-sm font-bold block text-navy-900">Admin-Zugänge finalisieren</span>
                <span className="text-xs text-text-muted block mt-0.5">Einrichten personalisierter, sicherer Administrations-Accounts für den Kunden.</span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 bg-white border border-neutral-gray-200 rounded-xl cursor-pointer hover:bg-bg-app-soft transition-colors">
              <input 
                type="checkbox" 
                checked={checklist.documentation} 
                onChange={() => toggleChecklistItem('documentation')}
                className="w-5 h-5 accent-navy-900 shrink-0 mt-0.5 rounded" 
              />
              <div>
                <span className="text-sm font-bold block text-navy-900">Kundendokumentation übergeben</span>
                <span className="text-xs text-text-muted block mt-0.5">Aushändigen des Handbuchs und Einweisung der Mitarbeiter.</span>
              </div>
            </label>
          </div>
        </div>
      </DetailOverlay>

      <FeedbackFooter pageTitle="Geräte und Lizenzen" route="/admin/devices" variant="full" />
    </div>
  );
}
