"use client";

import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";
import React, { useState, useEffect } from 'react';
import { 
  Banknote, Receipt, FileSpreadsheet, Building, 
  BarChart4, Briefcase, FileText, ArrowRight, Info, AlertTriangle, CheckCircle2,
  CreditCard, QrCode, SmartphoneNfc, Wallet, PieChart
} from 'lucide-react';
import { DetailOverlay } from '@/components/ui/DetailOverlay';

// ----- Cost handling -----
interface CostItem {
  name: string;
  amount: number;
  interval: string; // monatlich, jährlich, einmalig, …
  category: 'fix' | 'variabel';
  status: string; // e.g. "Demo" / "vorbereitet"
}

const FIXED_STORAGE_KEY = 'kreile_finance_fixed_costs';
const VARIABLE_STORAGE_KEY = 'kreile_finance_variable_costs';

function loadCosts(key: string): CostItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCosts(key: string, data: CostItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // ignore storage errors in demo mode
  }
}

// ----- AddCostForm component -----
function AddCostForm({ category, onAdd }: { category: 'fix' | 'variabel'; onAdd: (item: CostItem) => void }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [interval, setInterval] = useState('monatlich');
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!name || isNaN(amt)) return;
    onAdd({ name, amount: amt, interval, category, status: 'Demo' });
    setName('');
    setAmount('');
  };
  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-2">
      <input
        type="text"
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full p-2 border border-neutral-gray-200 rounded"
        required
      />
      <input
        type="number"
        placeholder="Betrag (€)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-full p-2 border border-neutral-gray-200 rounded"
        required
      />
      <select
        value={interval}
        onChange={(e) => setInterval(e.target.value)}
        className="w-full p-2 border border-neutral-gray-200 rounded"
      >
        <option value="monatlich">monatlich</option>
        <option value="jährlich">jährlich</option>
        <option value="einmalig">einmalig</option>
      </select>
      <button type="submit" className="bg-navy-900 text-white px-3 py-1.5 rounded">
        + Position ergänzen
      </button>
    </form>
  );
}


export function FinanzenDashboardClient() {
  const [activeOverlay, setActiveOverlay] = useState<string | null>(null);
  // cost state
  const [fixedCosts, setFixedCosts] = useState<CostItem[]>(loadCosts(FIXED_STORAGE_KEY));
  const [variableCosts, setVariableCosts] = useState<CostItem[]>(loadCosts(VARIABLE_STORAGE_KEY));
  // helper to persist when arrays change
  useEffect(() => {
    saveCosts(FIXED_STORAGE_KEY, fixedCosts);
  }, [fixedCosts]);
  useEffect(() => {
    saveCosts(VARIABLE_STORAGE_KEY, variableCosts);
  }, [variableCosts]);

  const closeOverlay = () => setActiveOverlay(null);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8 font-sans antialiased text-navy-900 min-h-screen bg-[#F0EBE0]">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-navy-900 mb-2 font-serif">Buchhaltung und Finanzen</h1>
        <p className="text-text-muted text-sm md:text-base">Finanzielle Übersicht, Steuern und Exporte für die Buchhaltung.</p>
      </header>

      {/* Zahlungsmanagement und Checkout */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-navy-900 font-serif">Zahlungsmanagement und Checkout</h2>
          <span className="bg-accent-orange/10 text-accent-orange text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">In Vorbereitung</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          
          <button onClick={() => setActiveOverlay("payment_providers")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-kreile-yellow/20 rounded-xl flex items-center justify-center text-navy-900">
                  <CreditCard className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Zahlungsdienstleister</h3>
              <p className="text-sm text-text-muted font-medium">Anbieter für Checkout & Kartenzahlung.</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Optionen prüfen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          <button onClick={() => setActiveOverlay("payment_links")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-[#2563EB]/10 rounded-xl flex items-center justify-center text-[#2563EB]">
                  <QrCode className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Zahlungslink und QR-Code</h3>
              <p className="text-sm text-text-muted font-medium">Rechnung direkt per Link zahlen.</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Ablauf anzeigen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          <button onClick={() => setActiveOverlay("tap_to_pay")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-success-green/10 rounded-xl flex items-center justify-center text-success-green">
                  <SmartphoneNfc className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Vor-Ort-Zahlung</h3>
              <p className="text-sm text-text-muted font-medium">Terminal oder Tap-to-Pay bei Abholung.</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Szenario prüfen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          <button onClick={() => setActiveOverlay("payment_status")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-warning-yellow/10 rounded-xl flex items-center justify-center text-warning-yellow">
                  <Wallet className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Zahlungsstatus</h3>
              <p className="text-sm text-text-muted font-medium">Teilzahlungen und offene Beträge klären.</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Detailstatus ansehen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          <button onClick={() => setActiveOverlay("payment_analytics")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-navy-900/10 rounded-xl flex items-center justify-center text-navy-900">
                  <PieChart className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Zahlungsmoral und Zahlungsarten</h3>
              <p className="text-sm text-text-muted font-medium">Zahlungsmoral und meistgenutzte Arten.</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Auswertung öffnen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

        </div>
      </div>

      {/* Finanzen Kontrollbereich */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-navy-900 font-serif">Finanz-Zentrale</h2>
          <span className="bg-accent-orange/10 text-accent-orange text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">Demo / In Vorbereitung</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          
          {/* 1. Offene Posten */}
          <button onClick={() => setActiveOverlay("open_items")} className="text-left bg-white rounded-2xl p-5 border border-error-red/20 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-error-red/10 rounded-xl flex items-center justify-center text-error-red">
                  <Banknote className="w-6 h-6" />
                </div>
                <span className="text-2xl font-bold text-navy-900">12.450 €</span>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Offene Posten</h3>
              <p className="text-sm text-error-red font-medium">3 Zahlungen überfällig</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Details ansehen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* 2. Rechnungsübersicht und Statistik */}
          <button onClick={() => setActiveOverlay("invoices_status")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-success-green/10 rounded-xl flex items-center justify-center text-success-green">
                  <Receipt className="w-6 h-6" />
                </div>
                <span className="text-2xl font-bold text-navy-900">42</span>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Rechnungsübersicht und Statistik</h3>
              <p className="text-sm text-text-muted font-medium">Laufender Monat</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Details ansehen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* 3. DATEV Export */}
          <button onClick={() => setActiveOverlay("datev_export")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-[#008200]/10 rounded-xl flex items-center justify-center text-[#008200]">
                  <FileText className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">DATEV Export</h3>
              <p className="text-sm text-text-muted font-medium">Schnittstelle vorbereitet</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Vorschau öffnen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* 4. Lexware / Excel Export */}
          <button onClick={() => setActiveOverlay("excel_export")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-[#107C41]/10 rounded-xl flex items-center justify-center text-[#107C41]">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Lexware / Excel</h3>
              <p className="text-sm text-text-muted font-medium">Einfacher CSV-Export</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Vorschau öffnen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* 5. Deutschland-Steuerprofil */}
          <button onClick={() => setActiveOverlay("tax_profile")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-[#2563EB]/10 rounded-xl flex items-center justify-center text-[#2563EB]">
                  <Building className="w-6 h-6" />
                </div>
                <span className="text-xl font-bold text-navy-900">DE</span>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Steuerprofil</h3>
              <p className="text-sm text-text-muted font-medium">19% / 7% / 0%</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Details ansehen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* Fixkosten */}
          <button onClick={() => setActiveOverlay("fixed_costs")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-navy-900/10 rounded-xl flex items-center justify-center text-navy-900">
                  <BarChart4 className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Fixkosten</h3>
              <p className="text-sm text-text-muted font-medium">Feste monatliche Ausgaben.</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Details ansehen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* Variable Kosten */}
          <button onClick={() => setActiveOverlay("variable_costs")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-accent-orange/10 rounded-xl flex items-center justify-center text-accent-orange">
                  <PieChart className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Variable Kosten</h3>
              <p className="text-sm text-text-muted font-medium">Dynamische Kosten.</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Details ansehen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* 6. BWA / Monatsübersicht */}
          <button onClick={() => setActiveOverlay("bwa_overview")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-navy-900/10 rounded-xl flex items-center justify-center text-navy-900">
                  <BarChart4 className="w-6 h-6" />
                </div>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">BWA / Monatsübersicht</h3>
              <p className="text-sm text-text-muted font-medium">Betriebswirtschaftliche Auswertung</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Details ansehen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* 7. Steuerberater-Paket */}
          <button onClick={() => setActiveOverlay("tax_advisor_pkg")} className="text-left bg-white rounded-2xl p-5 border border-neutral-gray-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all cursor-pointer md:col-span-2 lg:col-span-3">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-kreile-yellow/20 rounded-xl flex items-center justify-center text-navy-900">
                  <Briefcase className="w-6 h-6" />
                </div>
                <span className="text-sm font-bold bg-kreile-yellow/20 text-navy-900 px-3 py-1 rounded-full">Premium-Modul</span>
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">Steuerberater-Paket</h3>
              <p className="text-sm text-text-muted font-medium">Digitaler Aktenordner für die Monatsübergabe.</p>
            </div>
            <div className="mt-6 flex items-center justify-between w-full text-sm font-bold text-text-muted group-hover:text-navy-900 transition-colors">
              Paket-Inhalte prüfen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

        </div>
      </div>

      {/* Detail Overlays */}
      
      {/* 1: Offene Posten */}
      <DetailOverlay open={activeOverlay === "open_items"} onClose={closeOverlay} title="Offene Posten (OPOS)" subtitle="Forderungsmanagement und Mahnwesen">
        <div className="space-y-6 text-navy-900">
          <div className="bg-warning-yellow/10 border border-warning-yellow/30 rounded-xl p-4 flex gap-3">
            <Info className="w-5 h-5 text-warning-yellow shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-navy-900">Demo / Noch nicht angebunden</h4>
              <p className="text-sm text-text-muted">Das Buchhaltungs-Backend verarbeitet noch keine echten Zahlungseingänge.</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-bg-app-soft p-4 rounded-xl border border-neutral-gray-100 text-center">
              <span className="block text-2xl font-black text-navy-900">12.450 €</span>
              <span className="text-xs text-text-muted font-bold uppercase tracking-wider">Offene Summe</span>
            </div>
            <div className="bg-error-red/5 p-4 rounded-xl border border-error-red/20 text-center">
              <span className="block text-2xl font-black text-error-red">3.120 €</span>
              <span className="text-xs text-error-red font-bold uppercase tracking-wider">Überfällig</span>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold mb-3 border-b border-neutral-gray-200 pb-2">Größte offene Kunden (Demo)</h4>
            <ul className="space-y-3">
              <li className="bg-bg-app-soft p-3 rounded-lg flex justify-between items-center border border-neutral-gray-100">
                <div><p className="font-bold">Metallbau Müller</p><p className="text-xs text-text-muted">Rechnung R-2026-041</p></div>
                <span className="text-sm text-error-red font-bold">2.450 € (Mahnstufe 1)</span>
              </li>
              <li className="bg-bg-app-soft p-3 rounded-lg flex justify-between items-center border border-neutral-gray-100">
                <div><p className="font-bold">AutoTech GmbH</p><p className="text-xs text-text-muted">Rechnung R-2026-045</p></div>
                <span className="text-sm text-navy-900 font-bold">1.800 €</span>
              </li>
            </ul>
          </div>
          
          <div className="pt-4 border-t border-neutral-gray-200 flex justify-end">
            <button onClick={closeOverlay} className="bg-navy-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-navy-800 transition-colors">
              Schließen
            </button>
          </div>
        </div>
      </DetailOverlay>

      {/* 2: Rechnungen und Zahlungsstatus */}
      <DetailOverlay open={activeOverlay === "invoices_status"} onClose={closeOverlay} title="Rechnungsübersicht und Statistik" subtitle="Übersicht aller Ausgangsrechnungen im System.">
        <div className="space-y-6 text-navy-900">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-success-green/10 p-3 rounded-xl border border-success-green/20 text-center">
              <span className="block text-xl font-black text-success-green">38</span>
              <span className="text-[10px] text-success-green font-bold uppercase tracking-wider">Bezahlt</span>
            </div>
            <div className="bg-neutral-gray-100 p-3 rounded-xl border border-neutral-gray-200 text-center">
              <span className="block text-xl font-black text-navy-900">4</span>
              <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Offen</span>
            </div>
            <div className="bg-error-red/10 p-3 rounded-xl border border-error-red/20 text-center">
              <span className="block text-xl font-black text-error-red">3</span>
              <span className="text-[10px] text-error-red font-bold uppercase tracking-wider">Überfällig</span>
            </div>
            <div className="bg-bg-app-soft p-3 rounded-xl border border-neutral-gray-200 text-center">
              <span className="block text-xl font-black text-navy-900">45</span>
              <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Gesamt</span>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold mb-3 border-b border-neutral-gray-200 pb-2">Zahlungsarten</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center"><span className="text-text-muted">Banküberweisung</span><span className="font-bold">85%</span></div>
              <div className="flex justify-between items-center"><span className="text-text-muted">Barzahlung (Abholer)</span><span className="font-bold">10%</span></div>
              <div className="flex justify-between items-center"><span className="text-text-muted">Kreditkarte</span><span className="font-bold">5%</span></div>
            </div>
          </div>
        </div>
      </DetailOverlay>
        {/* Konsolidierte Overlays befinden sich weiter unten */}

      {/* 3: DATEV Export */}
      <DetailOverlay open={activeOverlay === "datev_export"} onClose={closeOverlay} title="DATEV Export (Vorbereitung)" subtitle="Buchungsdatenservice / ASCII-Export">
        <div className="space-y-6 text-navy-900">
          <div className="bg-[#008200]/10 border border-[#008200]/20 rounded-xl p-4 flex gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#008200] shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-[#008200]">Exportstruktur vorbereitet</h4>
              <p className="text-sm text-[#008200]/80">Die DATEV-Validierung und finale Formatierung erfolgt in einem späteren Release. Es werden noch keine echten Buchungssätze an DATEV übermittelt.</p>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold mb-3 border-b border-neutral-gray-200 pb-2">Zukünftiger Export-Umfang</h4>
            <ul className="list-disc pl-5 space-y-1 text-sm text-text-muted">
              <li>Ausgangsrechnungen (Debitorenbuchungen)</li>
              <li>Zahlungseingänge (Bankbuchungen)</li>
              <li>Stammdaten-Änderungen (Kunden)</li>
              <li className="text-navy-900 font-bold mt-2">Export-Details aus Zahlungsfluss:</li>
              <li>Zahlungsdatum & Zahlungsart (Überweisung, PayPal, etc.)</li>
              <li>Transaktions-ID & Provider-Gebühren</li>
              <li>Skonto-Abzüge & offener Restbetrag</li>
              <li>Mahnstatus</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold mb-3 border-b border-neutral-gray-200 pb-2">Pflichtfelder für Buchungssatz</h4>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="bg-bg-app-soft px-2 py-1 rounded border border-neutral-gray-200 font-mono">Belegdatum</span>
              <span className="bg-bg-app-soft px-2 py-1 rounded border border-neutral-gray-200 font-mono">Buchungstext</span>
              <span className="bg-bg-app-soft px-2 py-1 rounded border border-neutral-gray-200 font-mono">Konto</span>
              <span className="bg-bg-app-soft px-2 py-1 rounded border border-neutral-gray-200 font-mono">Gegenkonto</span>
              <span className="bg-bg-app-soft px-2 py-1 rounded border border-neutral-gray-200 font-mono">Betrag</span>
              <span className="bg-bg-app-soft px-2 py-1 rounded border border-neutral-gray-200 font-mono">BU (Steuer)</span>
            </div>
          </div>
        </div>
      </DetailOverlay>

      {/* 4: Lexware / Excel Export */}
      <DetailOverlay open={activeOverlay === "excel_export"} onClose={closeOverlay} title="Lexware / Excel CSV-Export" subtitle="Einfacher Datenexport als Tabelle.">
        <div className="space-y-6 text-navy-900">
          <div>
            <h4 className="font-bold mb-3 border-b border-neutral-gray-200 pb-2">Vorschau: Rechnungsjournal (Demo)</h4>
            <div className="overflow-x-auto border border-neutral-gray-200 rounded-lg">
              <table className="w-full text-xs text-left whitespace-nowrap">
                <thead className="bg-bg-app-soft text-text-muted uppercase">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Beleg-Nr.</th>
                    <th className="px-3 py-2 font-semibold">Datum</th>
                    <th className="px-3 py-2 font-semibold">Kunde</th>
                    <th className="px-3 py-2 font-semibold text-right">Netto</th>
                    <th className="px-3 py-2 font-semibold text-right">Steuer</th>
                    <th className="px-3 py-2 font-semibold text-right">Brutto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-gray-100 bg-white">
                  <tr>
                    <td className="px-3 py-2 font-mono text-navy-900">R-26-041</td>
                    <td className="px-3 py-2">01.06.2026</td>
                    <td className="px-3 py-2">Metallbau Müller</td>
                    <td className="px-3 py-2 text-right">2.058,82</td>
                    <td className="px-3 py-2 text-right">391,18</td>
                    <td className="px-3 py-2 text-right font-bold">2.450,00</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-mono text-navy-900">R-26-042</td>
                    <td className="px-3 py-2">01.06.2026</td>
                    <td className="px-3 py-2">AutoTech GmbH</td>
                    <td className="px-3 py-2 text-right">1.512,61</td>
                    <td className="px-3 py-2 text-right">287,39</td>
                    <td className="px-3 py-2 text-right font-bold">1.800,00</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-text-muted mt-2 italic">Hinweis: Die echte Export-Generierung wird mit der Fertigstellung der Auftragsdatenbank verknüpft.</p>
          </div>
          
          <div className="pt-4 border-t border-neutral-gray-200 flex justify-end">
            <button className="bg-neutral-gray-200 text-text-muted px-5 py-2.5 rounded-xl font-bold cursor-not-allowed">
              CSV Herunterladen
            </button>
          </div>
        </div>
      </DetailOverlay>

      {/* 5: Deutschland-Steuerprofil */}
      <DetailOverlay open={activeOverlay === "tax_profile"} onClose={closeOverlay} title="Steuerprofil (Deutschland)" subtitle="Fest hinterlegte Steuersätze für Rechnungen.">
        <div className="space-y-6 text-navy-900">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-bg-app-soft p-4 rounded-xl border border-neutral-gray-200">
              <span className="block text-2xl font-black text-navy-900">19 %</span>
              <span className="text-sm text-text-muted font-bold">Standard USt.</span>
            </div>
            <div className="bg-bg-app-soft p-4 rounded-xl border border-neutral-gray-200">
              <span className="block text-2xl font-black text-navy-900">7 %</span>
              <span className="text-sm text-text-muted font-bold">Reduziert</span>
            </div>
            <div className="bg-bg-app-soft p-4 rounded-xl border border-neutral-gray-200">
              <span className="block text-2xl font-black text-navy-900">0 %</span>
              <span className="text-sm text-text-muted font-bold">Steuerfrei</span>
            </div>
          </div>
          
          <div className="bg-navy-900/5 p-4 rounded-xl text-sm text-navy-900">
            <p className="font-bold mb-1">System-Regeln:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Die Währung ist global auf <strong>EUR (€)</strong> festgesetzt.</li>
              <li>Eine komplexe Steuerlogik für Drittländer oder Schweiz-MwSt. ist nicht integriert.</li>
              <li>Die Steuer wird präzise je Rechnungsposition (und nicht nur pauschal am Ende) berechnet.</li>
              <li>Reduzierte Sätze müssen beim Artikel bewusst und manuell ausgewählt werden.</li>
            </ul>
          </div>
        </div>
      </DetailOverlay>

      {/* 6: BWA / Monatsübersicht */}
      <DetailOverlay open={activeOverlay === "bwa_overview"} onClose={closeOverlay} title="BWA / Monatsübersicht" subtitle="Betriebswirtschaftliche Auswertung.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-warning-yellow/10 border border-warning-yellow/30 rounded-xl p-4 flex gap-3 mb-6">
            <AlertTriangle className="w-5 h-5 text-warning-yellow shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-navy-900">Demo / Fallback</h4>
              <p className="text-sm text-text-muted">Das System hat aktuell noch keinen Zugriff auf echte Fixkosten und Fremdleistungen. Alle Zahlen sind Platzhalter.</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-white border border-neutral-gray-200 rounded-lg">
              <span className="font-medium text-navy-900">1. Umsatzerlöse</span>
              <span className="font-bold text-navy-900">85.400 €</span>
            </div>
            
            <div onClick={() => setActiveOverlay("variable_costs")} className="flex justify-between items-center p-3 bg-error-red/5 border border-error-red/10 rounded-lg text-error-red cursor-pointer hover:bg-error-red/10 transition-colors">
              <span className="font-medium">- Materialaufwand</span>
              <span className="font-bold">12.200 €</span>
            </div>
            
            <div onClick={() => setActiveOverlay("variable_costs")} className="flex justify-between items-center p-3 bg-error-red/5 border border-error-red/10 rounded-lg text-error-red cursor-pointer hover:bg-error-red/10 transition-colors">
              <span className="font-medium">- Fremdleistungen</span>
              <span className="font-bold">4.500 €</span>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-success-green/10 border border-success-green/20 rounded-lg">
              <span className="font-bold text-success-green">Deckungsbeitrag</span>
              <span className="font-black text-success-green">68.700 €</span>
            </div>

            <div onClick={() => setActiveOverlay("fixed_costs")} className="flex justify-between items-center p-3 bg-error-red/5 border border-error-red/10 rounded-lg text-error-red cursor-pointer hover:bg-error-red/10 transition-colors">
              <span className="font-medium">- Betriebliche Fixkosten (geschätzt)</span>
              <span className="font-bold">45.000 €</span>
            </div>

            <div className="flex justify-between items-center p-4 bg-navy-900 rounded-lg text-white mt-4">
              <span className="font-bold text-lg">Vorläufiges Betriebsergebnis</span>
              <span className="font-black text-xl">23.700 €</span>
            </div>
          </div>
        </div>
      </DetailOverlay>

      {/* 7: Steuerberater-Paket */}
      <DetailOverlay open={activeOverlay === "tax_advisor_pkg"} onClose={closeOverlay} title="Steuerberater-Paket" subtitle="Digitaler Aktenordner für die Monatsübergabe.">
        <div className="space-y-6 text-navy-900">
          <div className="bg-bg-app-soft p-5 rounded-xl border border-neutral-gray-200">
            <h4 className="font-bold mb-3 border-b border-neutral-gray-200 pb-2">Inhalte für den Steuerberater</h4>
            <ul className="space-y-2 text-sm text-navy-900">
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success-green" /> Rechnungsjournal (CSV)</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success-green" /> Ausgangsrechnungen (PDF-Archiv)</li>
              <li className="flex items-center gap-2"><div className="w-4 h-4 shrink-0 rounded-full border-2 border-text-muted" /> Kassensystem-Export (inkl. Transaktions-ID/Gebühren)</li>
              <li className="flex items-center gap-2"><div className="w-4 h-4 shrink-0 rounded-full border-2 border-text-muted" /> Bankumsätze (Fehlt noch)</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold mb-2">Nächste Schritte</h4>
            <p className="text-sm text-text-muted">Das Datenmodell für Kassen- und Bankbuchungen muss in der nächsten Migration finalisiert werden, bevor das Paket exportiert werden kann.</p>
          </div>
          
          <div className="pt-4 border-t border-neutral-gray-200 flex justify-end">
            <button onClick={closeOverlay} className="bg-navy-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-navy-800 transition-colors">
              Verstanden
            </button>
          </div>
        </div>
      </DetailOverlay>

      {/* NEU: Zahlungsdienstleister */}
      <DetailOverlay open={activeOverlay === "payment_providers"} onClose={closeOverlay} title="Zahlungsdienstleister" subtitle="Vorbereitet / Anbieter später auswählen">
        <div className="space-y-6 text-navy-900">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-bg-app-soft border border-neutral-gray-200 p-4 rounded-xl flex items-center justify-between">
              <span className="font-bold">Stripe</span>
              <span className="text-xs font-bold text-accent-orange uppercase bg-white px-2 py-1 rounded">Evaluieren</span>
            </div>
            <div className="bg-bg-app-soft border border-neutral-gray-200 p-4 rounded-xl flex items-center justify-between">
              <span className="font-bold">Mollie</span>
              <span className="text-xs font-bold text-accent-orange uppercase bg-white px-2 py-1 rounded">Evaluieren</span>
            </div>
            <div className="bg-bg-app-soft border border-neutral-gray-200 p-4 rounded-xl flex items-center justify-between">
              <span className="font-bold">SumUp</span>
              <span className="text-xs font-bold text-accent-orange uppercase bg-white px-2 py-1 rounded">Evaluieren</span>
            </div>
            <div className="bg-bg-app-soft border border-neutral-gray-200 p-4 rounded-xl flex items-center justify-between">
              <span className="font-bold">PayPal</span>
              <span className="text-xs font-bold text-accent-orange uppercase bg-white px-2 py-1 rounded">Evaluieren</span>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold mb-3 border-b border-neutral-gray-200 pb-2">Entscheidungskriterien</h4>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Transaktionsgebühren pro Zahlung</li>
              <li>QR-Link und Online-Checkout Unterstützung</li>
              <li>Kartenzahlung vor Ort (Terminal / Tap-to-Pay)</li>
              <li>Rechnung per E-Mail Versandfähigkeit</li>
              <li>DATEV- bzw. Exportfähigkeit (Saubere Abrechnung der Gebühren)</li>
              <li>EU/Deutschland-Tauglichkeit</li>
            </ul>
          </div>
        </div>
      </DetailOverlay>

      {/* NEU: Zahlungslink und QR-Code */}
      <DetailOverlay open={activeOverlay === "payment_links"} onClose={closeOverlay} title="Zahlungslink und QR-Code" subtitle="Nahtlose Bezahlung für Kunden.">
        <div className="space-y-6 text-navy-900">
          <div>
            <h4 className="font-bold mb-3 border-b border-neutral-gray-200 pb-2">Geplanter Ablauf</h4>
            <ol className="list-decimal pl-5 space-y-2 text-sm font-medium">
              <li>Rechnung wird im System erzeugt</li>
              <li>Zahlungslink (z.B. Stripe Checkout) wird via API generiert</li>
              <li>Individueller QR-Code wird auf PDF-Rechnung gedruckt</li>
              <li>Link wird zusätzlich per E-Mail oder Messenger an Kunden gesendet</li>
              <li>Nach erfolgreicher Zahlung meldet Webhook den Status &bdquo;bezahlt&ldquo; zurück</li>
            </ol>
          </div>
          <div className="bg-white border-2 border-dashed border-neutral-gray-300 p-6 rounded-xl flex flex-col items-center justify-center text-center">
            <QrCode className="w-16 h-16 text-neutral-gray-400 mb-2" />
            <span className="font-bold text-navy-900">Demo-QR-Code</span>
            <span className="text-xs text-text-muted mt-1">Ein echter Checkout ist noch nicht angebunden.</span>
          </div>
          
          <div className="pt-4 border-t border-neutral-gray-200 flex justify-end">
            <button disabled className="w-full bg-navy-900 text-white font-bold py-3 rounded-xl opacity-50 cursor-not-allowed" title="Zahlung vorbereiten (in Entwicklung)">
              Zahlung vorbereiten (Demo)
            </button>
          </div>
        </div>
      </DetailOverlay>

      {/* NEU: Vor-Ort-Zahlung */}
      <DetailOverlay open={activeOverlay === "tap_to_pay"} onClose={closeOverlay} title="Vor-Ort-Zahlung" subtitle="Zahlungen bei Abholung entgegennehmen.">
        <div className="space-y-6 text-navy-900">
          <div>
            <h4 className="font-bold mb-3 border-b border-neutral-gray-200 pb-2">Szenario</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex gap-3 items-start"><div className="bg-navy-900 text-white w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">1</div> Kunde holt Ware ab.</li>
              <li className="flex gap-3 items-start"><div className="bg-navy-900 text-white w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">2</div> Mitarbeiter öffnet Auftrag oder Rechnung auf Tablet/Smartphone.</li>
              <li className="flex gap-3 items-start"><div className="bg-navy-900 text-white w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">3</div> Kunde zahlt per EC-Karte oder Handy (Apple/Google Pay).</li>
              <li className="flex gap-3 items-start"><div className="bg-navy-900 text-white w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">4</div> Zahlung wird automatisch der Rechnung und dem Kunden zugeordnet.</li>
            </ul>
          </div>
          <div className="bg-warning-yellow/10 border border-warning-yellow/30 p-4 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning-yellow shrink-0 mt-0.5" />
            <div className="text-sm text-navy-900">
              <span className="font-bold">Tap to Pay / Terminal-Anbindung in Vorbereitung</span>
              <p className="mt-1 text-text-muted">Noch kein echter Payment-Button integriert. Hardware-Kompatibilität wird evaluiert.</p>
            </div>
          </div>
        </div>
      </DetailOverlay>

      {/* NEU: Zahlungsstatus */}
      <DetailOverlay open={activeOverlay === "payment_status"} onClose={closeOverlay} title="Detaillierter Zahlungsstatus" subtitle="Vollständiger Überblick über Zahlungseingänge.">
        <div className="space-y-6 text-navy-900">
          <div>
            <h4 className="font-bold mb-3 border-b border-neutral-gray-200 pb-2">Zukünftige Statusgruppen</h4>
            <div className="flex flex-wrap gap-2 text-xs font-bold">
              <span className="bg-success-green/10 text-success-green px-3 py-1.5 rounded-lg border border-success-green/20">Bezahlt</span>
              <span className="bg-neutral-gray-100 text-navy-900 px-3 py-1.5 rounded-lg border border-neutral-gray-200">Offen</span>
              <span className="bg-error-red/10 text-error-red px-3 py-1.5 rounded-lg border border-error-red/20">Überfällig</span>
              <span className="bg-warning-yellow/10 text-warning-yellow px-3 py-1.5 rounded-lg border border-warning-yellow/30">Teilweise bezahlt</span>
              <span className="bg-error-red/10 text-error-red px-3 py-1.5 rounded-lg border border-error-red/20">Zahlung fehlgeschlagen</span>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold mb-3 border-b border-neutral-gray-200 pb-2">Beispielvorgänge & Nächste Aktion</h4>
            <ul className="space-y-3">
              <li className="bg-bg-app-soft p-3 rounded-xl border border-neutral-gray-200">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-sm">R-2026-081 (Teilzahlung)</span>
                  <span className="text-xs bg-white border border-neutral-gray-200 px-2 py-1 rounded">Noch 150 € offen</span>
                </div>
                <div className="flex gap-2">
                  <button disabled className="text-xs font-bold bg-navy-900 text-white px-3 py-1.5 rounded-lg opacity-50 cursor-not-allowed" title="In Vorbereitung">Zahlung klären (Demo)</button>
                </div>
              </li>
              <li className="bg-bg-app-soft p-3 rounded-xl border border-neutral-gray-200">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-sm">R-2026-066 (Überfällig)</span>
                  <span className="text-xs bg-white border border-neutral-gray-200 px-2 py-1 rounded text-error-red font-bold">Zahlung fehlgeschlagen</span>
                </div>
                <div className="flex gap-2">
                  <button disabled className="text-xs font-bold bg-navy-900 text-white px-3 py-1.5 rounded-lg opacity-50 cursor-not-allowed">Erinnern / Erneut senden</button>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </DetailOverlay>

      {/* NEU: Zahlungsmoral */}
      <DetailOverlay open={activeOverlay === "payment_analytics"} onClose={closeOverlay} title="Zahlungsmoral und Zahlungsarten" subtitle="Analysen für das Performance-Cockpit.">
        <div className="space-y-6 text-navy-900">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-xl border border-neutral-gray-200 text-center">
              <span className="block text-2xl font-black text-navy-900">12 Tage</span>
              <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Ø Zahlungsziel erreicht in</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-neutral-gray-200 text-center">
              <span className="block text-2xl font-black text-error-red">4</span>
              <span className="text-[10px] text-error-red font-bold uppercase tracking-wider">Aktive Mahnfälle</span>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold mb-3 border-b border-neutral-gray-200 pb-2">Meistgenutzte Zahlungsarten (Beispiel)</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center bg-bg-app-soft px-3 py-2 rounded-lg"><span className="text-navy-900 font-medium">Banküberweisung</span><span className="font-bold">60%</span></div>
              <div className="flex justify-between items-center bg-bg-app-soft px-3 py-2 rounded-lg"><span className="text-navy-900 font-medium">Zahlungslink (Stripe/Mollie)</span><span className="font-bold">25%</span></div>
              <div className="flex justify-between items-center bg-bg-app-soft px-3 py-2 rounded-lg"><span className="text-navy-900 font-medium">Vor-Ort-Karte</span><span className="font-bold">10%</span></div>
              <div className="flex justify-between items-center bg-bg-app-soft px-3 py-2 rounded-lg"><span className="text-navy-900 font-medium">PayPal / Bar</span><span className="font-bold">5%</span></div>
            </div>
          </div>

          <div className="bg-navy-900/5 p-4 rounded-xl text-sm text-navy-900 border border-neutral-gray-200">
            <Info className="w-5 h-5 text-navy-900 mb-2" />
            <p>Diese echten Zahlungsstatistiken (&bdquo;pünktlich vs. verspätet&ldquo;) werden später direkt in die Kacheln <strong>&bdquo;Kunden und Markt&ldquo;</strong> und <strong>&bdquo;Umsatz und Marge&ldquo;</strong> im <span className="font-bold font-mono">/performance</span> Cockpit einfließen.</p>
          </div>
        </div>
      </DetailOverlay>

      {/* NEU: Fixkosten Overlay */}
      <DetailOverlay open={activeOverlay === "fixed_costs"} onClose={closeOverlay} title="Fixkosten" subtitle="Detaillierte Auflistung der festen Kostenpositionen.">
        <div className="space-y-6 text-navy-900">
          <ul className="space-y-2">
            {fixedCosts.map((c, i) => (
              <li key={i} className="flex justify-between items-center bg-bg-app-soft p-3 rounded-lg border border-neutral-gray-200">
                <span className="font-medium">{c.name}</span>
                <span className="font-bold">{c.amount} € <span className="text-xs font-normal text-text-muted">({c.interval})</span></span>
                <span className="text-xs font-bold text-accent-orange uppercase bg-white px-2 py-1 rounded border border-neutral-gray-200">{c.status}</span>
              </li>
            ))}
          </ul>
          
          <AddCostForm
            category="fix"
            onAdd={(item) => setFixedCosts((prev) => [...prev, item])}
          />
          <p className="text-xs text-warning-yellow flex items-center gap-1 mt-1 font-bold">
            <AlertTriangle className="w-3 h-3" /> Lokale Vormerkung, noch nicht in Supabase gespeichert
          </p>

          <div className="bg-navy-900/5 p-4 rounded-xl text-sm text-navy-900 mt-6 border border-neutral-gray-200">
            <Info className="w-5 h-5 text-navy-900 mb-2" />
            <p>Fixkosten fließen später in BWA, Monatsgewinn, Mindestumsatz und Deckungsbeitrag ein. Diese Werte speisen später die Performance-Kategorien <span className="font-bold">Umsatz und Marge</span>.</p>
          </div>
        </div>
      </DetailOverlay>

      {/* NEU: Variable Kosten Overlay */}
      <DetailOverlay open={activeOverlay === "variable_costs"} onClose={closeOverlay} title="Variable / dynamische Kosten" subtitle="Kosten abhängig von Menge / Prozess.">
        <div className="space-y-6 text-navy-900">
          <ul className="space-y-2">
            {variableCosts.map((c, i) => (
              <li key={i} className="flex justify-between items-center bg-bg-app-soft p-3 rounded-lg border border-neutral-gray-200">
                <span className="font-medium">{c.name}</span>
                <span className="font-bold">{c.amount} € <span className="text-xs font-normal text-text-muted">({c.interval})</span></span>
                <span className="text-xs font-bold text-accent-orange uppercase bg-white px-2 py-1 rounded border border-neutral-gray-200">{c.status}</span>
              </li>
            ))}
          </ul>
          
          <AddCostForm
            category="variabel"
            onAdd={(item) => setVariableCosts((prev) => [...prev, item])}
          />
          <p className="text-xs text-warning-yellow flex items-center gap-1 mt-1 font-bold">
            <AlertTriangle className="w-3 h-3" /> Lokale Vormerkung, noch nicht in Supabase gespeichert
          </p>

          <div className="bg-navy-900/5 p-4 rounded-xl text-sm text-navy-900 mt-6 border border-neutral-gray-200">
            <Info className="w-5 h-5 text-navy-900 mb-2" />
            <p>Variable Kosten fließen später in Kalkulation, Marge, Metallmarge und Auftragsprofitabilität ein. Diese Werte speisen später die Performance-Kategorien <span className="font-bold">Bäder und Material</span>.</p>
          </div>
        </div>
      </DetailOverlay>

      <FeedbackFooter pageTitle="Finanzen" route="/finanzen" variant="full" />
    </div>
  );
}
