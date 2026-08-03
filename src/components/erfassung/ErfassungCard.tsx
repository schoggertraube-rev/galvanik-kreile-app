"use client";

import { useEffect, useState } from "react";
import { VorschlagBanner, VorlageResult } from "./VorschlagBanner";
import { getVorlageFuerAuftrag } from "@/app/actions/vorlage.actions";
import { uebernehmeVorlage } from "@/app/actions/erfassung.actions";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { ErfassungSheet } from "./ErfassungSheet";
import { Clock, Box } from "lucide-react";

type TimeBooking = {
  station_kuerzel: string;
  dauer_minuten: number | null;
};

type ConsumptionBooking = {
  station_kuerzel: string;
};

interface ErfassungCardProps {
  orderId: string;
  tenantId?: string;
}

export function ErfassungCard({ orderId, tenantId = 'galvanik-kreile' }: ErfassungCardProps) {
  void tenantId;
  const [vorlage, setVorlage] = useState<VorlageResult | null>(null);
  const [zeitBuchungen, setZeitBuchungen] = useState<TimeBooking[]>([]);
  const [verbrauchBuchungen, setVerbrauchBuchungen] = useState<ConsumptionBooking[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState<string>('');
  
  // To re-fetch data
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) setEmployeeId(userData.user.id);

      // Fetch Vorlage
      const vResult = await getVorlageFuerAuftrag(orderId);
      setVorlage(vResult);

      // Fetch Zeit
      const { data: zData } = await supabase
        .from('arbeitszeit_buchung')
        .select('id, station_kuerzel, dauer_minuten, end_zeit')
        .eq('auftrag_id', orderId);
      setZeitBuchungen(zData || []);

      // Fetch Verbrauch
      const { data: vData } = await supabase
        .from('stock_movements')
        .select('id, station_kuerzel, quantity')
        .eq('order_id', orderId)
        .eq('movement_type', 'verbrauch');
      setVerbrauchBuchungen(vData || []);
    }
    load();
  }, [orderId, refreshTick]);

  const handleUebernehmen = async () => {
    if (!vorlage?.schluessel) return;
    const res = await uebernehmeVorlage({
      auftrag_id: orderId,
      employee_id: employeeId,
      schluessel: vorlage.schluessel
    });
    if (res.error) {
      alert("Fehler bei Übernahme: " + res.error);
    } else if (res.partial) {
      alert("Teilweise übernommen. Fehler: " + res.fehler?.join(", "));
      setRefreshTick(t => t + 1);
    } else {
      setRefreshTick(t => t + 1);
    }
  };

  const handleSuccess = () => {
    setSheetOpen(false);
    setRefreshTick(t => t + 1);
  };

  // Compile stations from bookings and vorlage
  const stationsSet = new Set<string>();
  zeitBuchungen.forEach(z => stationsSet.add(z.station_kuerzel));
  verbrauchBuchungen.forEach(v => stationsSet.add(v.station_kuerzel));
  if (vorlage?.zeit) vorlage.zeit.forEach(z => stationsSet.add(z.station));
  if (vorlage?.verbrauch) vorlage.verbrauch.forEach(v => stationsSet.add(v.station));

  // If completely empty, assume some default or just show empty state
  if (stationsSet.size === 0) {
    stationsSet.add('SCH');
    stationsSet.add('GAL');
  }

  const stations = Array.from(stationsSet).sort();

  return (
    <div className="bg-white border-2 border-neutral-gray-300 rounded-3xl p-6 md:p-8 shadow-sm">
      <h3 className="text-xl font-black font-serif text-navy-900 mb-6">Verbrauch & Zeit</h3>

      {vorlage ? (
        vorlage.hat_vorlage ? (
          <VorschlagBanner 
            vorlage={vorlage} 
            onUebernehmen={handleUebernehmen} 
            onAnpassen={() => setSheetOpen(true)}
          />
        ) : (
          <div className="bg-neutral-gray-50 border-2 border-dashed border-neutral-gray-200 rounded-2xl p-4 mb-6 text-center text-sm font-bold text-text-muted">
            ✦ Noch kein Erfahrungswert für diese Art Auftrag.<br/>Diese Erfassung wird die erste Vorlage.
          </div>
        )
      ) : (
        <div className="animate-pulse bg-neutral-gray-100 h-24 rounded-2xl mb-6" />
      )}

      <div className="space-y-2 mb-6">
        {stations.map(st => {
          const zForStation = zeitBuchungen.filter(z => z.station_kuerzel === st);
          const vForStation = verbrauchBuchungen.filter(v => v.station_kuerzel === st);
          const hasBookings = zForStation.length > 0 || vForStation.length > 0;
          const isOffen = !hasBookings;

          let summaryText = 'Offen';
          if (!isOffen) {
            const sumMin = zForStation.reduce((sum, z) => sum + (z.dauer_minuten || 0), 0);
            summaryText = `Bestätigt · ${sumMin} Min`;
          }

          return (
            <div key={st} className="flex items-center justify-between p-4 bg-bg-app-soft rounded-2xl border-2 border-neutral-gray-100 hover:border-navy-200 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${isOffen ? 'bg-neutral-gray-300' : 'bg-success-green'}`} />
                <span className="font-bold text-navy-900 w-12">{st}</span>
                <span className={`text-sm font-bold ${isOffen ? 'text-text-muted' : 'text-navy-700'}`}>{summaryText}</span>
              </div>
              <Button 
                variant="ghost" 
                className={`font-bold hover:bg-neutral-gray-200 ${isOffen ? 'text-[#C2185B]' : 'text-text-muted'}`}
                onClick={() => setSheetOpen(true)}
              >
                {isOffen ? 'Start' : 'Edit'}
              </Button>
            </div>
          );
        })}
      </div>

      <Button 
        onClick={() => setSheetOpen(true)}
        className="w-full bg-white border-2 border-neutral-gray-200 text-navy-900 font-bold hover:bg-neutral-gray-50 hover:border-navy-300 h-14 rounded-2xl transition-colors shadow-sm"
      >
        <Clock className="w-5 h-5 mr-2" /> <Box className="w-5 h-5 mr-2" /> + Verbrauch oder Zeit nachtragen
      </Button>

      {sheetOpen && (
        <ErfassungSheet 
          orderId={orderId}
          mode="beides"
          vorlage={vorlage || undefined}
          onSuccess={handleSuccess}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  );
}
