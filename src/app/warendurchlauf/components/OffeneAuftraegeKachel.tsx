"use client";

import { useState } from "react";
import { Tile } from "@/app/buchhaltung/components/Tile";
import { AnalysisOverlay } from "@/components/ui/AnalysisOverlay";
import { ListTodo } from "lucide-react";
import Link from "next/link";

export function OffeneAuftraegeKachel({ data }: { data: any }) {
  const [overlayOpen, setOverlayOpen] = useState(false);

  const offeneCount = data?.offeneAuftraege ?? 0;
  const orders = data?.orders || [];

  // Get most recent open orders
  const activeOrders = orders.filter((o: any) => o.status !== "completed" && o.status !== "abgeschlossen");
  const sortedRecent = activeOrders.sort((a: any, b: any) => {
    const aDate = a.intakeDate ? new Date(a.intakeDate).getTime() : 0;
    const bDate = b.intakeDate ? new Date(b.intakeDate).getTime() : 0;
    return bDate - aDate; // Newest first
  }).slice(0, 5);

  const compositionRows = sortedRecent.length > 0 ? sortedRecent.map((o: any) => {
    return {
      avatar: o.orderNumber?.charAt(0) || "A",
      avatarColor: "bg-navy-900",
      name: `${o.orderNumber} ${o.task ? `(${o.task})` : ""}`,
      amount: "In Bearbeitung",
      href: `/orders/${o.id}`
    };
  }) : [{ avatar: "✓", avatarColor: "bg-teal-500", name: "Keine offenen Aufträge", amount: "", href: "#" }];

  return (
    <>
      <Tile
        icon={<ListTodo className="w-6 h-6" />}
        iconColor="text-navy-900"
        title="Offene Aufträge"
        kpi={String(offeneCount)}
        description="Aktiv im Durchlauf"
        footer="Live-Stand"
        onClick={() => setOverlayOpen(true)}
        analyseLink={{ label: "Details ansehen", onClick: () => setOverlayOpen(true) }}
      />

      <AnalysisOverlay
        open={overlayOpen}
        onClose={() => setOverlayOpen(false)}
        title="Offene Aufträge"
        subtitle="Alle Aufträge, die sich aktuell im Haus befinden."
        hero={{
          kicker: "Gesamt Offen",
          value: String(offeneCount),
          changePill: { text: "Basierend auf Livedaten", variant: "neutral" }
        }}
        composition={{
          title: "Neu eingegangen",
          rows: compositionRows
        }}
        insight={{
          body: offeneCount > 0 ? `${offeneCount} Aufträge sind aktuell in der Produktion.` : "Aktuell sind keine Aufträge in Bearbeitung."
        }}
        linkedAreas={[
          { label: "Kunden", href: "/customers" },
          { label: "Abrechenbare Aufträge", href: "/buchhaltung/rechnungen" }
        ]}
      />
    </>
  );
}
