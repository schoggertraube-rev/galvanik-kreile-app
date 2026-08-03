"use client";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { BackButton } from "@/components/ui/BackButton";

import React, { useState } from 'react';
import { AlertTriangle, Box, Truck, FlaskConical, ArrowRight, Info } from 'lucide-react';
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";
import { DetailOverlay } from '@/components/ui/DetailOverlay';
import type { LagerArtikel } from "./actions";

interface Props {
  lagerData?: LagerArtikel[];
}

type LagerArtikelMitWareneingang = LagerArtikel & {
  letzterWareneingang: Date;
};

export function LagerCockpitClient({ lagerData = [] }: Props) {
  const [activeOverlay, setActiveOverlay] = useState<string | null>(null);
  const closeOverlay = () => setActiveOverlay(null);

  // Kacheln Metrics
  const criticalItems = lagerData.filter(item => Number(item.bestand) <= Number(item.mindestbestand));
  const chemieItems = lagerData.filter(item => item.kategorie === 'chemie');
  const verpackungItems = lagerData.filter(item => item.kategorie === 'verpackung');
  
  // Letzte Zugänge: Letzte 5 Tage
  const recentItems = lagerData.filter((item): item is LagerArtikelMitWareneingang => {
    if (!item.letzterWareneingang) return false;
    const diff = Date.now() - new Date(item.letzterWareneingang).getTime();
    return diff <= 5 * 24 * 60 * 60 * 1000;
  });

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8 font-sans antialiased text-navy-900 min-h-screen bg-[#F0EBE0]">
      <div className="mb-6">
        <Breadcrumb items={[{label:'Home',href:'/'}, {label:'Lager',href:'/lager'}]} />
        <BackButton label="Home" href="/" />
      </div>
      
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-navy-900 mb-2 font-serif">Lager & Chemie</h1>
        <p className="text-text-muted text-sm md:text-base">Bestände, Nachbestellungen und Wareneingänge.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
        {/* 1. Kritischer Bestand */}
        <button onClick={() => setActiveOverlay("critical")} className="text-left bg-white rounded-2xl p-5 border border-error-red/20 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
          <div>
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-error-red/10 rounded-xl flex items-center justify-center text-error-red">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <span className="text-2xl font-bold text-error-red">{criticalItems.length}</span>
            </div>
            <h3 className="font-bold text-navy-900 text-lg mb-1">Kritischer Bestand</h3>
            <p className="text-sm text-error-red font-medium">Nachbestellung nötig</p>
          </div>
          <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
            Details ansehen <ArrowRight className="w-4 h-4" />
          </div>
        </button>

        {/* 2. Chemie */}
        <button onClick={() => setActiveOverlay("chemie")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
          <div>
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-navy-900/10 rounded-xl flex items-center justify-center text-navy-900">
                <FlaskConical className="w-6 h-6" />
              </div>
              <span className="text-2xl font-bold text-navy-900">{chemieItems.length}</span>
            </div>
            <h3 className="font-bold text-navy-900 text-lg mb-1">Chemie & Rohstoffe</h3>
            <p className="text-sm text-text-muted font-medium">Aktive Artikel</p>
          </div>
          <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
            Details ansehen <ArrowRight className="w-4 h-4" />
          </div>
        </button>

        {/* 3. Verpackung */}
        <button onClick={() => setActiveOverlay("verpackung")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
          <div>
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-navy-900/10 rounded-xl flex items-center justify-center text-navy-900">
                <Box className="w-6 h-6" />
              </div>
              <span className="text-2xl font-bold text-navy-900">{verpackungItems.length}</span>
            </div>
            <h3 className="font-bold text-navy-900 text-lg mb-1">Verpackung</h3>
            <p className="text-sm text-text-muted font-medium">Aktive Artikel</p>
          </div>
          <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
            Details ansehen <ArrowRight className="w-4 h-4" />
          </div>
        </button>

        {/* 4. Wareneingänge */}
        <button onClick={() => setActiveOverlay("recent")} className="text-left bg-white rounded-2xl p-5 border border-success-green/20 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
          <div>
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-success-green/10 rounded-xl flex items-center justify-center text-success-green">
                <Truck className="w-6 h-6" />
              </div>
              <span className="text-2xl font-bold text-success-green">{recentItems.length}</span>
            </div>
            <h3 className="font-bold text-navy-900 text-lg mb-1">Neueingänge</h3>
            <p className="text-sm text-success-green font-medium">Letzte 5 Tage</p>
          </div>
          <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
            Details ansehen <ArrowRight className="w-4 h-4" />
          </div>
        </button>
      </div>

      {/* Overlays */}
      <DetailOverlay open={activeOverlay === "critical"} onClose={closeOverlay} title="Kritischer Bestand" subtitle="Artikel unter dem Mindestbestand.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-error-red/10 border border-error-red/20 rounded-xl p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-error-red shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-error-red">Nachbestellung erforderlich: {criticalItems.length}</h4>
              <p className="text-sm text-error-red/80">{criticalItems.length === 0 ? "Alle Bestände sind ausreichend." : "Diese Artikel unterschreiten den konfigurierten Mindestbestand."}</p>
            </div>
          </div>
          {criticalItems.length > 0 && (
            <ul className="space-y-3">
              {criticalItems.map(item => (
                <li key={item.id} className="bg-white p-3 rounded-lg flex justify-between items-center border border-error-red/20">
                  <div>
                    <p className="font-bold">{item.name}</p>
                    <p className="text-xs text-text-muted">Art-Nr: {item.artikelnummer}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-error-red">{item.bestand} {item.einheit}</p>
                    <p className="text-xs text-text-muted">Min: {item.mindestbestand} {item.einheit}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DetailOverlay>

      <DetailOverlay open={activeOverlay === "chemie"} onClose={closeOverlay} title="Chemie & Rohstoffe" subtitle="Aktueller Bestand an Chemieartikeln.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-neutral-gray-100 border border-neutral-gray-200 rounded-xl p-4 flex gap-3">
            <Info className="w-5 h-5 text-text-muted shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-navy-900">Anzahl Artikel: {chemieItems.length}</h4>
              <p className="text-sm text-text-muted">{chemieItems.length === 0 ? "Keine Chemie-Artikel in der Datenbank." : "Alle aktiven Chemie-Artikel."}</p>
            </div>
          </div>
          {chemieItems.length > 0 && (
            <ul className="space-y-3">
              {chemieItems.map(item => (
                <li key={item.id} className="bg-white p-3 rounded-lg flex justify-between items-center border border-neutral-gray-200">
                  <div>
                    <p className="font-bold">{item.name}</p>
                    <p className="text-xs text-text-muted">Art-Nr: {item.artikelnummer}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{item.bestand} {item.einheit}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DetailOverlay>

      <DetailOverlay open={activeOverlay === "verpackung"} onClose={closeOverlay} title="Verpackungsmaterial" subtitle="Aktueller Bestand an Verpackungen.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-neutral-gray-100 border border-neutral-gray-200 rounded-xl p-4 flex gap-3">
            <Info className="w-5 h-5 text-text-muted shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-navy-900">Anzahl Artikel: {verpackungItems.length}</h4>
              <p className="text-sm text-text-muted">{verpackungItems.length === 0 ? "Keine Verpackungsartikel in der Datenbank." : "Alle aktiven Verpackungsartikel."}</p>
            </div>
          </div>
          {verpackungItems.length > 0 && (
            <ul className="space-y-3">
              {verpackungItems.map(item => (
                <li key={item.id} className="bg-white p-3 rounded-lg flex justify-between items-center border border-neutral-gray-200">
                  <div>
                    <p className="font-bold">{item.name}</p>
                    <p className="text-xs text-text-muted">Art-Nr: {item.artikelnummer}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{item.bestand} {item.einheit}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DetailOverlay>

      <DetailOverlay open={activeOverlay === "recent"} onClose={closeOverlay} title="Neueingänge" subtitle="Kürzlich erfasste Wareneingänge.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-success-green/10 border border-success-green/20 rounded-xl p-4 flex gap-3">
            <Truck className="w-5 h-5 text-success-green shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-success-green">Letzte 5 Tage: {recentItems.length} Eingänge</h4>
              <p className="text-sm text-success-green/80">{recentItems.length === 0 ? "Keine aktuellen Wareneingänge verzeichnet." : "Die neuesten Zugänge ins Lager."}</p>
            </div>
          </div>
          {recentItems.length > 0 && (
            <ul className="space-y-3">
              {recentItems.map(item => (
                <li key={item.id} className="bg-white p-3 rounded-lg flex justify-between items-center border border-success-green/20">
                  <div>
                    <p className="font-bold">{item.name}</p>
                    <p className="text-xs text-text-muted">Eingang am: {new Date(item.letzterWareneingang).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-success-green">{item.bestand} {item.einheit}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DetailOverlay>

      <FeedbackFooter pageTitle="Lager Cockpit" route="/lager" variant="full" />
    </div>
  );
}
