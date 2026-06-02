"use client";

import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";
import React, { useState } from 'react';
import { 
  MonitorSmartphone, Laptop, Smartphone, Globe, 
  AlertTriangle, Shield, ShieldCheck, KeyRound, 
  ArrowRight, Info, Activity, Clock, 
  Server, CheckSquare, FileSignature, Receipt, Ban, CheckCircle, Database
} from 'lucide-react';
import { DetailOverlay } from '@/components/ui/DetailOverlay';
import Link from 'next/link';

export function AdminDevicesClient() {
  const [activeOverlay, setActiveOverlay] = useState<string | null>(null);

  const closeOverlay = () => setActiveOverlay(null);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8 font-sans antialiased text-navy-900 min-h-screen bg-[#F0EBE0]">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-navy-900 mb-2 font-serif flex items-center gap-3">
          <MonitorSmartphone className="w-8 h-8" />
          Geräte, Lizenzen & Sicherheit
        </h1>
        <p className="text-text-muted text-sm md:text-base">Zentrale Plattform-Verwaltung für den Mandanten (Admin/Developer).</p>
      </header>

      {/* SECTION 1: Zugriffsüberwachung & Geräte */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-navy-900 font-serif">1. Zugriffsüberwachung & Geräte</h2>
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
              Geräte prüfen <ArrowRight className="w-4 h-4" />
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
              <h3 className="font-bold text-navy-900 text-lg mb-1">Gerätetypen & Browser</h3>
              <p className="text-sm text-text-muted font-medium">Desktop / Tablet / Mobile</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Verteilung prüfen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* Auffällige Nutzung */}
          <button onClick={() => setActiveOverlay("suspicious_activity")} className="text-left bg-white rounded-2xl p-5 border border-warning-yellow/30 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-warning-yellow/10 rounded-xl flex items-center justify-center text-warning-yellow">
                  <AlertTriangle className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Auffällige Nutzung</h3>
              <p className="text-sm text-warning-yellow/80 font-bold">Hinweise auf geteilte Accounts</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Warnungen prüfen <ArrowRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      </section>

      {/* SECTION 2: Lizenzen & Betrieb */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-navy-900 font-serif">2. Lizenzen & Betrieb</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Gerätelizenz */}
          <button onClick={() => setActiveOverlay("device_license")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-accent-orange/10 rounded-xl flex items-center justify-center text-accent-orange">
                  <KeyRound className="w-6 h-6" />
                </div>
                <span className="text-xl font-bold text-navy-900">12 / 15</span>
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
              <p className="text-sm text-text-muted font-medium">Konditionen & Pakete</p>
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
              <p className="text-sm text-text-muted font-medium">SLA & Updates</p>
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
              <p className="text-sm text-text-muted font-medium">Server & Hosting</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Details prüfen <ArrowRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      </section>

      {/* SECTION 3: Mandanten & Sicherheit */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-navy-900 font-serif">3. Mandanten & Sicherheit</h2>
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
              <p className="text-sm text-text-muted font-medium">Datentrennung & Prinzipien</p>
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

      {/* OVERLAYS */}

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
            <div className="p-3 bg-bg-app-soft font-bold text-sm border-b border-neutral-gray-200 flex gap-4">
              <div className="flex-1">Gerät</div>
              <div className="w-24">Status</div>
              <div className="w-10"></div>
            </div>
            <div className="divide-y divide-neutral-gray-100">
              <div className="p-3 flex items-center gap-4">
                <div className="flex-1">
                  <p className="font-bold">Meister-Tablet Halle 1</p>
                  <p className="text-xs text-text-muted">iPad / Safari • Rolle: Werkstatt • Gestern</p>
                </div>
                <div className="w-24"><span className="text-xs bg-success-green/10 text-success-green font-bold px-2 py-1 rounded">Freigegeben</span></div>
                <div className="w-10"><button className="text-text-muted hover:text-error-red transition-colors" title="Sperren (Vorbereitet)"><Ban className="w-4 h-4"/></button></div>
              </div>
              <div className="p-3 flex items-center gap-4">
                <div className="flex-1">
                  <p className="font-bold">Büro Desktop (Frau S.)</p>
                  <p className="text-xs text-text-muted">Windows / Chrome • Rolle: Büro • Vor 12 Min.</p>
                </div>
                <div className="w-24"><span className="text-xs bg-success-green/10 text-success-green font-bold px-2 py-1 rounded">Freigegeben</span></div>
                <div className="w-10"><button className="text-text-muted hover:text-error-red transition-colors" title="Sperren (Vorbereitet)"><Ban className="w-4 h-4"/></button></div>
              </div>
              <div className="p-3 flex items-center gap-4 bg-warning-yellow/5">
                <div className="flex-1">
                  <p className="font-bold">Unbekanntes iPhone</p>
                  <p className="text-xs text-text-muted">iOS / Safari • Rolle: Admin • Vor 1 Std.</p>
                </div>
                <div className="w-24"><span className="text-xs bg-warning-yellow/20 text-warning-yellow font-bold px-2 py-1 rounded">Prüfen</span></div>
                <div className="w-10"><button className="text-text-muted hover:text-error-red transition-colors" title="Sperren (Vorbereitet)"><Ban className="w-4 h-4"/></button></div>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button className="flex-1 border-2 border-navy-900 text-navy-900 font-bold p-3 rounded-xl hover:bg-bg-app-soft transition-colors opacity-70 cursor-not-allowed">
              Gerät freigeben (Backend später)
            </button>
            <button className="flex-1 bg-error-red text-white font-bold p-3 rounded-xl hover:bg-red-700 transition-colors opacity-70 cursor-not-allowed">
              Gerät sperren (Backend später)
            </button>
          </div>
          <p className="text-xs text-center text-text-muted">Sperrlogik wird später per Device-ID und Session-Tabelle in Supabase abgebildet.</p>
        </div>
      </DetailOverlay>

      {/* Gerätetypen & Browser */}
      <DetailOverlay open={activeOverlay === "device_types"} onClose={closeOverlay} title="Gerätetypen & Browser" subtitle="Hardware & Software Verteilung.">
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
            <p className="text-sm text-text-muted">Da Tablets in der Werkstatt über 35% der Nutzung ausmachen, sollten Touch-Targets (Buttons) weiterhin auf mindestens 48x48px (Tailwind w-12 h-12) gehalten werden. Listenansichten wie in "/warendurchlauf" müssen zwingend auf Landscape-Tablets getestet werden.</p>
          </div>
        </div>
      </DetailOverlay>

      {/* Browser & Systeme */}
      <DetailOverlay open={activeOverlay === "browsers"} onClose={closeOverlay} title="Browser & Systeme" subtitle="Auswertung der genutzten Software-Umgebungen.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-neutral-gray-100 border border-neutral-gray-200 rounded-xl p-4 flex gap-3">
            <Info className="w-5 h-5 text-text-muted shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-navy-900">Noch nicht vollständig angebunden</h4>
              <p className="text-sm text-text-muted">Der "User-Agent" wird in den `ui_events` noch nicht konsistent erfasst. Nachfolgend simulierte Daten.</p>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold mb-3 border-b border-neutral-gray-200 pb-2">Top Browser</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between p-2 hover:bg-white rounded"><span>Google Chrome</span> <span className="font-bold">68%</span></li>
              <li className="flex justify-between p-2 hover:bg-white rounded"><span>Safari (iOS/iPadOS)</span> <span className="font-bold">22%</span></li>
              <li className="flex justify-between p-2 hover:bg-white rounded"><span>Microsoft Edge</span> <span className="font-bold">10%</span></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-3 border-b border-neutral-gray-200 pb-2">Top Betriebssysteme</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between p-2 hover:bg-white rounded"><span>Windows 11 / 10</span> <span className="font-bold">55%</span></li>
              <li className="flex justify-between p-2 hover:bg-white rounded"><span>iPadOS / iOS</span> <span className="font-bold">35%</span></li>
              <li className="flex justify-between p-2 hover:bg-white rounded"><span>Android</span> <span className="font-bold">10%</span></li>
            </ul>
          </div>
        </div>
      </DetailOverlay>

      {/* Auffällige Nutzung */}
      <DetailOverlay open={activeOverlay === "suspicious_activity"} onClose={closeOverlay} title="Auffällige Nutzung" subtitle="Automatische Erkennung potenzieller Sicherheitsrisiken.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-warning-yellow/10 border border-warning-yellow/30 rounded-xl p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-warning-yellow shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-navy-900">Hinweis</h4>
              <p className="text-sm text-text-muted">Dies sind nur algorithmische Hinweise, keine harten Bewertungen. Ein "geteilter Account" kann auch legitim sein, wenn z.B. ein Meister-Tablet in der Schicht wandert.</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl border border-error-red/30">
              <h4 className="font-bold text-error-red flex items-center gap-2"><Globe className="w-4 h-4" /> Geteilter Account Verdacht</h4>
              <p className="text-sm text-text-muted mt-1">Die Rolle <span className="font-bold">"Werkstatt"</span> ist aktuell gleichzeitig auf <span className="font-bold">4 verschiedenen Geräten</span> aktiv. Empfehlung: Künftig personalisierte PINs statt generischer Rolle nutzen.</p>
            </div>

            <div className="bg-bg-app-soft p-4 rounded-xl border border-neutral-gray-200">
              <h4 className="font-bold text-navy-900 flex items-center gap-2"><Clock className="w-4 h-4" /> Außerhalb Normalzeit</h4>
              <p className="text-sm text-text-muted mt-1">Ein Login-Versuch ("Büro") um 03:14 Uhr wurde erfolgreich durchgeführt (Tablet). Prüfen, ob Nachtschicht aktiv war.</p>
            </div>
          </div>
        </div>
      </DetailOverlay>

      {/* Session-Prüfung */}
      <DetailOverlay open={activeOverlay === "session_check"} onClose={closeOverlay} title="Session-Prüfung" subtitle="Verwaltung der aktiven Login-Sitzungen (Cookies/Tokens).">
        <div className="space-y-6 text-navy-900">
          <div className="bg-bg-app-soft p-4 rounded-xl border border-neutral-gray-200">
            <p className="text-sm text-text-muted">Aktuell ist die App im Bypass-Auth bzw. LocalStorage-Mock-Modus. Echte Supabase Auth-Sessions existieren in dieser Demo nicht.</p>
          </div>
          
          <div className="bg-white border border-neutral-gray-200 rounded-xl overflow-hidden">
            <div className="p-3 bg-navy-900 text-white font-bold text-sm">Lokale Session (Du)</div>
            <div className="p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-text-muted">Rolle:</span> <span className="font-bold text-accent-orange">Admin / Developer</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Session Start:</span> <span>Heute</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Auth-Typ:</span> <span>Bypass-Cookie / LocalStorage</span></div>
            </div>
          </div>

          <button className="w-full bg-error-red/10 text-error-red border border-error-red/20 font-bold p-3 rounded-xl opacity-50 cursor-not-allowed">
            Gerät sperren (Backend fehlt)
          </button>
        </div>
      </DetailOverlay>

      {/* Gerätelizenz */}
      <DetailOverlay open={activeOverlay === "device_license"} onClose={closeOverlay} title="Gerätelizenz" subtitle="Übersicht der lizenzierten Endgeräte.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-bg-app-soft p-4 rounded-xl border border-neutral-gray-200 text-sm">
            <p className="font-bold">Lizenzmodell: <span className="text-accent-orange">Gerätebasiert</span></p>
            <p className="text-text-muted mt-1">Kunden können nicht selbst beliebig Geräte hinzufügen. Ein Admin muss Geräte freigeben, wenn das Limit überschritten wird.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-neutral-gray-200 rounded-xl p-4 text-center">
              <div className="text-3xl font-black text-navy-900">12</div>
              <div className="text-xs font-bold text-text-muted uppercase mt-1">Genutzte Geräte</div>
            </div>
            <div className="bg-white border border-neutral-gray-200 rounded-xl p-4 text-center">
              <div className="text-3xl font-black text-navy-900">15</div>
              <div className="text-xs font-bold text-text-muted uppercase mt-1">Erlaubte Geräte</div>
            </div>
            <div className="bg-white border border-neutral-gray-200 rounded-xl p-4 text-center">
              <div className="text-3xl font-black text-success-green">3</div>
              <div className="text-xs font-bold text-text-muted uppercase mt-1">Freie Slots</div>
            </div>
            <div className="bg-white border border-neutral-gray-200 rounded-xl p-4 text-center">
              <div className="text-3xl font-black text-warning-yellow">1</div>
              <div className="text-xs font-bold text-text-muted uppercase mt-1">Unbekannt / Neu</div>
            </div>
          </div>
        </div>
      </DetailOverlay>

      {/* Lizenzmodell */}
      <DetailOverlay open={activeOverlay === "license_model"} onClose={closeOverlay} title="Lizenzmodelle" subtitle="Konditionen und geplante Verkaufspakete.">
        <div className="space-y-4 text-navy-900">
          <div className="bg-white border border-neutral-gray-200 rounded-xl p-4">
            <h4 className="font-bold mb-1 flex justify-between">Einmaliger Verkauf <span className="text-text-muted">Demo</span></h4>
            <p className="text-sm text-text-muted">Software geht in den Besitz des Kunden über (On-Premise oder dedizierter Cloud-Host). Wartung separat.</p>
          </div>
          <div className="bg-white border border-neutral-gray-200 rounded-xl p-4">
            <h4 className="font-bold mb-1 flex justify-between">Einrichtungspaket <span className="text-text-muted">Demo</span></h4>
            <p className="text-sm text-text-muted">Einmalige Kosten für Datenimport (Kundenstamm, Artikel), Anpassung des Brandings und Schulung vor Ort.</p>
          </div>
          <div className="bg-white border border-neutral-gray-200 rounded-xl p-4">
            <h4 className="font-bold mb-1 flex justify-between">SaaS / Gerätepauschale <span className="text-text-muted">Demo</span></h4>
            <p className="text-sm text-text-muted">Monatliche Lizenzgebühr pro aktivem Gerät inkl. Cloud-Hosting und Support.</p>
          </div>
          <div className="bg-white border border-neutral-gray-200 rounded-xl p-4">
            <h4 className="font-bold mb-1 flex justify-between">Zusatzmodule <span className="text-text-muted">Demo</span></h4>
            <p className="text-sm text-text-muted">Optionale Module (z.B. Datev-Export, erweiterte Maschinen-Telemetrie) können separat lizenziert werden.</p>
          </div>
        </div>
      </DetailOverlay>

      {/* Wartungsvertrag */}
      <DetailOverlay open={activeOverlay === "maintenance"} onClose={closeOverlay} title="Wartungsvertrag (SLA)" subtitle="Übersicht der laufenden Betreuungsleistungen.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-sm font-bold text-blue-900 text-center">Status: Konzept vorbereitet</p>
          </div>
          <ul className="space-y-2">
            <li className="flex gap-3 bg-white p-3 rounded-lg border border-neutral-gray-200"><CheckCircle className="w-5 h-5 text-success-green shrink-0"/> <span className="text-sm font-medium">Updates & Sicherheits-Patches</span></li>
            <li className="flex gap-3 bg-white p-3 rounded-lg border border-neutral-gray-200"><CheckCircle className="w-5 h-5 text-success-green shrink-0"/> <span className="text-sm font-medium">Support (Ticketing & Telefon)</span></li>
            <li className="flex gap-3 bg-white p-3 rounded-lg border border-neutral-gray-200"><CheckCircle className="w-5 h-5 text-success-green shrink-0"/> <span className="text-sm font-medium">Tägliche Backup-Prüfung</span></li>
            <li className="flex gap-3 bg-white p-3 rounded-lg border border-neutral-gray-200"><CheckCircle className="w-5 h-5 text-success-green shrink-0"/> <span className="text-sm font-medium">24/7 Monitoring (Uptime)</span></li>
            <li className="flex gap-3 bg-white p-3 rounded-lg border border-neutral-gray-200"><CheckCircle className="w-5 h-5 text-success-green shrink-0"/> <span className="text-sm font-medium">Kleine UI/UX Anpassungen (bis 2h/Monat)</span></li>
            <li className="flex gap-3 bg-white p-3 rounded-lg border border-neutral-gray-200"><CheckCircle className="w-5 h-5 text-success-green shrink-0"/> <span className="text-sm font-medium">Jahreswechsel / Steuer- / Export-Prüfung</span></li>
          </ul>
        </div>
      </DetailOverlay>

      {/* Betriebskosten */}
      <DetailOverlay open={activeOverlay === "server_costs"} onClose={closeOverlay} title="Betriebs- & Serverkosten" subtitle="Zentrale Infrastruktur-Aufwände.">
        <div className="space-y-6 text-navy-900">
          <p className="text-sm text-text-muted">Kosten für die Bereitstellung, die entweder pauschal an den Mandanten weiterberechnet oder pro Mandant isoliert kalkuliert werden.</p>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center bg-white border border-neutral-gray-200 p-3 rounded-lg">
              <span className="font-bold text-sm">Vercel (Hosting & Edge)</span>
            </div>
            <div className="flex justify-between items-center bg-white border border-neutral-gray-200 p-3 rounded-lg">
              <span className="font-bold text-sm">Supabase (DB, Auth, Storage)</span>
            </div>
            <div className="flex justify-between items-center bg-white border border-neutral-gray-200 p-3 rounded-lg">
              <span className="font-bold text-sm">Resend / Brevo (E-Mail)</span>
            </div>
            <div className="flex justify-between items-center bg-white border border-neutral-gray-200 p-3 rounded-lg">
              <span className="font-bold text-sm">Mollie / Stripe (Payment)</span>
            </div>
            <div className="flex justify-between items-center bg-white border border-neutral-gray-200 p-3 rounded-lg">
              <span className="font-bold text-sm">Domains & SSL</span>
            </div>
          </div>
          
          <Link href="/finanzen" className="w-full bg-navy-900 text-white font-bold p-3 rounded-xl flex items-center justify-center gap-2 hover:bg-navy-800 transition-colors">
            Zu den Finanzen wechseln <ArrowRight className="w-4 h-4"/>
          </Link>
        </div>
      </DetailOverlay>

      {/* Mandanten-Sicherheit */}
      <DetailOverlay open={activeOverlay === "tenant_security"} onClose={closeOverlay} title="Mandanten-Sicherheit" subtitle="Daten-Isolierung und Auditierung.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-bg-app-soft p-4 rounded-xl border border-neutral-gray-200 text-sm">
            <p className="font-bold mb-2">Prinzipien der Multi-Tenancy (Vorbereitung)</p>
            <ul className="list-disc pl-4 space-y-1 text-text-muted">
              <li>Keine Datenvermischung: Alle relevanten Tabellen (Kunden, Aufträge, Logs) benötigen zwingend eine `tenant_id`.</li>
              <li>RLS Policies (Row Level Security) garantieren harte Trennung auf Datenbankebene.</li>
              <li>Admin- und Developer-Rollen werden strikt vom operativen Mandanten-Login getrennt.</li>
            </ul>
          </div>

          <h4 className="font-bold border-b border-neutral-gray-200 pb-2">Erforderliche Bausteine</h4>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-neutral-gray-200 flex items-center justify-center shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">Audit-Log</p>
                <p className="text-xs text-text-muted">Protokollierung von Löschungen und Rechteänderungen pro Mandant.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-neutral-gray-200 flex items-center justify-center shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">Demo-Daten Handler</p>
                <p className="text-xs text-text-muted">Sichere Löschung oder Archivierung aller initialen Dummy-Daten.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-neutral-gray-200 flex items-center justify-center shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">Backup Management</p>
                <p className="text-xs text-text-muted">Isoliertes Backup (PITR) pro Mandant auf Supabase Ebene sicherstellen.</p>
              </div>
            </li>
          </ul>
        </div>
      </DetailOverlay>

      {/* Zugriffsregeln */}
      <DetailOverlay open={activeOverlay === "access_rules"} onClose={closeOverlay} title="Zugriffsregeln" subtitle="Rollen und Berechtigungen.">
        <div className="space-y-4 text-navy-900">
          <div className="bg-white border border-neutral-gray-200 rounded-xl p-4">
            <h4 className="font-bold border-b border-neutral-gray-100 pb-2 mb-2">Rolle: Admin / Developer</h4>
            <p className="text-sm text-text-muted">Vollzugriff. Verwalten von Lizenzen, Tenants, Finanzen und globalen Settings.</p>
          </div>
          <div className="bg-white border border-neutral-gray-200 rounded-xl p-4">
            <h4 className="font-bold border-b border-neutral-gray-100 pb-2 mb-2">Rolle: Büro</h4>
            <p className="text-sm text-text-muted">Zugriff auf Angebote, Aufträge, Kundenverwaltung, Kommunikation.</p>
          </div>
          <div className="bg-white border border-neutral-gray-200 rounded-xl p-4">
            <h4 className="font-bold border-b border-neutral-gray-100 pb-2 mb-2">Rolle: Werkstatt</h4>
            <p className="text-sm text-text-muted">Limitiert auf Warendurchlauf, Scan, Bädersteuerung und Checklisten. Kein Zugriff auf Preise.</p>
          </div>
        </div>
      </DetailOverlay>

      {/* Übergabe-Check */}
      <DetailOverlay open={activeOverlay === "handover"} onClose={closeOverlay} title="Übergabe-Check" subtitle="Checkliste vor Live-Gang oder Verkauf.">
        <div className="space-y-4 text-navy-900">
          <p className="text-sm text-text-muted mb-4">Dient als roter Faden für die spätere Projektabnahme und Übergabe der Betriebsverantwortung.</p>
          
          <label className="flex items-center gap-3 p-3 bg-white border border-neutral-gray-200 rounded-lg cursor-pointer hover:bg-bg-app-soft transition-colors">
            <input type="checkbox" className="w-5 h-5 accent-navy-900" />
            <span className="text-sm font-bold">Neutrale Projekt-E-Mail eingerichtet (z.B. IT@kunde.de)</span>
          </label>
          <label className="flex items-center gap-3 p-3 bg-white border border-neutral-gray-200 rounded-lg cursor-pointer hover:bg-bg-app-soft transition-colors">
            <input type="checkbox" className="w-5 h-5 accent-navy-900" />
            <span className="text-sm font-bold">Supabase Owner-Rechte übertragen</span>
          </label>
          <label className="flex items-center gap-3 p-3 bg-white border border-neutral-gray-200 rounded-lg cursor-pointer hover:bg-bg-app-soft transition-colors">
            <input type="checkbox" className="w-5 h-5 accent-navy-900" />
            <span className="text-sm font-bold">Vercel Team / Projekt-Rechte übertragen</span>
          </label>
          <label className="flex items-center gap-3 p-3 bg-white border border-neutral-gray-200 rounded-lg cursor-pointer hover:bg-bg-app-soft transition-colors">
            <input type="checkbox" className="w-5 h-5 accent-navy-900" />
            <span className="text-sm font-bold">API-Keys rotiert (Resend, Payment, OCR)</span>
          </label>
          <label className="flex items-center gap-3 p-3 bg-white border border-neutral-gray-200 rounded-lg cursor-pointer hover:bg-bg-app-soft transition-colors">
            <input type="checkbox" className="w-5 h-5 accent-navy-900" />
            <span className="text-sm font-bold">Demo-Daten vollständig bereinigt</span>
          </label>
          <label className="flex items-center gap-3 p-3 bg-white border border-neutral-gray-200 rounded-lg cursor-pointer hover:bg-bg-app-soft transition-colors">
            <input type="checkbox" className="w-5 h-5 accent-navy-900" />
            <span className="text-sm font-bold">Initiale Admin-Zugänge finalisiert</span>
          </label>
          <label className="flex items-center gap-3 p-3 bg-white border border-neutral-gray-200 rounded-lg cursor-pointer hover:bg-bg-app-soft transition-colors">
            <input type="checkbox" className="w-5 h-5 accent-navy-900" />
            <span className="text-sm font-bold">Kundendokumentation & Handbuch übergeben</span>
          </label>
        </div>
      </DetailOverlay>

      <FeedbackFooter pageTitle="Geräte & Lizenzen" route="/admin/devices" variant="full" />
    </div>
  );
}
