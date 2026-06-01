"use client";

import React, { useState } from 'react';
import { 
  MonitorSmartphone, Laptop, Smartphone, Globe, 
  AlertTriangle, Shield, ShieldCheck, KeyRound, 
  ArrowRight, Info, Activity, Clock
} from 'lucide-react';
import { DetailOverlay } from '@/components/ui/DetailOverlay';

export function AdminDevicesClient() {
  const [activeOverlay, setActiveOverlay] = useState<string | null>(null);

  const closeOverlay = () => setActiveOverlay(null);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8 font-sans antialiased text-navy-900 min-h-screen bg-[#F0EBE0]">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-navy-900 mb-2 font-serif flex items-center gap-3">
          <MonitorSmartphone className="w-8 h-8" />
          Geräte & Sessions
        </h1>
        <p className="text-text-muted text-sm md:text-base">Zentrale Zugriffskontrolle und Geräteverwaltung (Admin/Developer).</p>
      </header>

      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-navy-900 font-serif">Zugriffsüberwachung</h2>
          <span className="bg-accent-orange/10 text-accent-orange text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">Demo / Vorbereitung</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          
          {/* 1. Aktive Zugriffe */}
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

          {/* 2. Gerätetypen */}
          <button onClick={() => setActiveOverlay("device_types")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-[#2563EB]/10 rounded-xl flex items-center justify-center text-[#2563EB]">
                  <MonitorSmartphone className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Gerätetypen</h3>
              <p className="text-sm text-text-muted font-medium">Desktop / Tablet / Mobile</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Verteilung prüfen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* 3. Browser & Systeme */}
          <button onClick={() => setActiveOverlay("browsers")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-neutral-gray-100 rounded-xl flex items-center justify-center text-navy-900">
                  <Globe className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Browser & Systeme</h3>
              <p className="text-sm text-text-muted font-medium">Umgebung der Nutzer</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Systeme prüfen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* 4. Auffällige Nutzung */}
          <button onClick={() => setActiveOverlay("suspicious_activity")} className="text-left bg-white rounded-2xl p-5 border border-warning-yellow/30 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-warning-yellow/10 rounded-xl flex items-center justify-center text-warning-yellow">
                  <AlertTriangle className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Auffällige Nutzung</h3>
              <p className="text-sm text-warning-yellow/80 font-medium font-bold">Hinweise auf geteilte Accounts</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Warnungen prüfen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* 5. Session-Prüfung */}
          <button onClick={() => setActiveOverlay("session_check")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-[#107C41]/10 rounded-xl flex items-center justify-center text-[#107C41]">
                  <KeyRound className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Session-Prüfung</h3>
              <p className="text-sm text-text-muted font-medium">Vorhandene Anmeldungen</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Sessions ansehen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* 6. Zugriffsregeln */}
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

          {/* 7. Nächste Sicherheitsmaßnahmen */}
          <button onClick={() => setActiveOverlay("next_security")} className="text-left bg-navy-900 rounded-2xl p-5 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer md:col-span-2 lg:col-span-3">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-white">
                  <Shield className="w-6 h-6" />
                </div>
                <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full uppercase">Roadmap</span>
              </div>
              <h3 className="font-bold text-white text-lg mb-1">Nächste Sicherheitsmaßnahmen</h3>
              <p className="text-sm text-white/70 font-medium">Was fehlt noch bis zur vollständigen Hardware-Bindung und Audit-Sicherheit?</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-white/80 group-hover:text-white transition-colors">
              Roadmap prüfen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

        </div>
      </div>

      {/* Detail Overlays */}
      
      {/* 1: Aktive Zugriffe */}
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

      {/* 2: Gerätetypen */}
      <DetailOverlay open={activeOverlay === "device_types"} onClose={closeOverlay} title="Gerätetypen" subtitle="Verteilung der Hardwareklassen.">
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

      {/* 3: Browser & Systeme */}
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

      {/* 4: Auffällige Nutzung */}
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

            <div className="bg-bg-app-soft p-4 rounded-xl border border-neutral-gray-200 opacity-60">
              <h4 className="font-bold text-navy-900 flex items-center gap-2"><Shield className="w-4 h-4" /> Wiederholte Rechteblockaden</h4>
              <p className="text-sm text-text-muted mt-1">Keine Vorfälle in den letzten 7 Tagen.</p>
            </div>
          </div>
        </div>
      </DetailOverlay>

      {/* 5: Session-Prüfung */}
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

      {/* 6: Zugriffsregeln */}
      <DetailOverlay open={activeOverlay === "access_rules"} onClose={closeOverlay} title="Geplante Zugriffsregeln" subtitle="Das zu implementierende Rechte-Regelwerk pro Rolle.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-white border border-neutral-gray-200 rounded-xl p-4">
            <h4 className="font-bold border-b border-neutral-gray-100 pb-2 mb-2">Rolle: Admin / Developer</h4>
            <p className="text-sm text-text-muted">Uneingeschränkter Zugriff auf alle Routen, inklusive `/admin/*`, `/settings`, Developer Analytics und Finanzdaten.</p>
          </div>

          <div className="bg-white border border-neutral-gray-200 rounded-xl p-4">
            <h4 className="font-bold border-b border-neutral-gray-100 pb-2 mb-2">Rolle: Büro</h4>
            <p className="text-sm text-text-muted">Zugriff auf `/quotes`, `/orders`, `/customers`, `/finanzen`. Kein Zugriff auf Admin-Routen oder System-Einstellungen.</p>
          </div>

          <div className="bg-white border border-neutral-gray-200 rounded-xl p-4">
            <h4 className="font-bold border-b border-neutral-gray-100 pb-2 mb-2">Rolle: Meister / Werkstatt</h4>
            <p className="text-sm text-text-muted">Zugriff auf operatives Cockpit `/station/*`, `/warendurchlauf`, `/scan`, `/baeder`. Kein Zugriff auf Finanzen, Angebote oder Admin-Einstellungen.</p>
          </div>
        </div>
      </DetailOverlay>

      {/* 7: Nächste Sicherheitsmaßnahmen */}
      <DetailOverlay open={activeOverlay === "next_security"} onClose={closeOverlay} title="Roadmap: Sicherheit" subtitle="Schritte bis zur vollständigen Enterprise-Sicherheit.">
        <div className="space-y-6 text-navy-900">
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-neutral-gray-200 flex items-center justify-center shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Echte Session-Tabelle (Supabase)</p>
                <p className="text-sm text-text-muted">Aktivierung der Supabase Auth Sessions anstelle der LocalStorage Mock-Lösung. Verknüpfung der `app_users` Tabelle.</p>
              </div>
            </li>
            
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-neutral-gray-200 flex items-center justify-center shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Device-ID Erfassung (Fingerprinting)</p>
                <p className="text-sm text-text-muted">Geräte bei der Erstanmeldung per Hash (UserAgent + Viewport + Sprache) anlegen, um "unbekannte Geräte" zu melden.</p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-neutral-gray-200 flex items-center justify-center shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Audit-Log (Security Events)</p>
                <p className="text-sm text-text-muted">Schreiben von `LOGIN_FAILED`, `ACCESS_DENIED`, `ROLE_CHANGED` in eine dedizierte Event-Tabelle.</p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-neutral-gray-200 flex items-center justify-center shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Remote-Sperre</p>
                <p className="text-sm text-text-muted">Ein Admin kann ein fremdes Gerät in Supabase invalidieren (Revoke Refresh Token).</p>
              </div>
            </li>
          </ul>
        </div>
      </DetailOverlay>

    </div>
  );
}
