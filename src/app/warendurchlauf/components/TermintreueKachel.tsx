"use client";

import { useState } from "react";
import { Tile } from "@/app/buchhaltung/components/Tile";
import { AnalysisOverlay } from "@/components/ui/AnalysisOverlay";
import { Calendar } from "lucide-react";
import Link from "next/link";

export function TermintreueKachel({ data }: { data: any }) {
  const [overlayOpen, setOverlayOpen] = useState(false);

  const termintreue = data?.termintreue ?? 0;
  const orders = data?.orders || [];
  
  // Find critical orders
  const criticalOrders = orders.filter((o: any) => o.status !== "completed" && o.status !== "abgeschlossen");
  const sortedCritical = criticalOrders.sort((a: any, b: any) => {
    const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    return aDate - bDate;
  }).slice(0, 5); // top 5 critical

  const compositionRows = sortedCritical.length > 0 ? sortedCritical.map((o: any) => {
    const isOverdue = o.dueDate ? new Date(o.dueDate).getTime() < Date.now() : false;
    return {
      avatar: o.orderNumber?.charAt(0) || "A",
      avatarColor: isOverdue ? "bg-error-red" : "bg-amber-500",
      name: `${o.orderNumber} ${o.task ? `(${o.task})` : ""}`,
      amount: isOverdue ? "Überfällig" : "Kritisch",
      href: `/orders/${o.id}`
    };
  }) : [{ avatar: "✓", avatarColor: "bg-teal-500", name: "Keine kritischen Aufträge", amount: "", href: "#" }];

  return (
    <>
      <Tile
        icon={<Calendar className="w-6 h-6" />}
        iconColor="text-navy-900"
        title="Termintreue"
        kpi={`${termintreue} %`}
        description="Alle aktiven & beendeten Aufträge"
        footer={`Von ${orders.length} Gesamtaufträgen`}
        onClick={() => setOverlayOpen(true)}
        analyseLink={{ label: "Details ansehen", onClick: () => setOverlayOpen(true) }}
      />

      <AnalysisOverlay
        open={overlayOpen}
        onClose={() => setOverlayOpen(false)}
        title="Termintreue Detail"
        subtitle="Analysieren Sie terminkritische Aufträge und Verzögerungen."
        hero={{
          kicker: "Gesamt Termintreue",
          value: `${termintreue} %`,
          changePill: { text: "Basierend auf Livedaten", variant: "gray" }
        }}
        composition={{
          title: "Kritische Aufträge",
          rows: compositionRows
        }}
        insight={{
          body: sortedCritical.length > 0 ? `${sortedCritical.length} Aufträge benötigen baldige Aufmerksamkeit.` : "Aktuell läuft alles nach Plan."
        }}
        linkedAreas={[
          { label: "Zur Kontrolle", href: "/kontrolle" },
          { label: "Kunden informieren", href: "/customers" }
        ]}
      />
    </>
  );
}
