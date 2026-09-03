"use client";

import React, { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { X, Camera, Edit3, Upload, Phone } from "lucide-react";
import { AppActionTile } from "./AppActionTile";
import { ShortcutType } from "./AppShortcutContext";
import { useErfassung } from "@/components/erfassung/ErfassungProvider";
import { usePermissions } from "@/lib/auth/PermissionsContext";

interface AppShortcutOverlayProps {
  type: ShortcutType;
  onClose: () => void;
}

function UnavailableCard({
  code,
  headline,
  detail,
  testId,
}: {
  code: "FORBIDDEN" | "NOT_AVAILABLE";
  headline: string;
  detail: string;
  testId: string;
}) {
  return (
    <div
      className="md:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950"
      data-testid={testId}
      role="status"
    >
      <p className="text-sm font-semibold tracking-wide">{code}</p>
      <h3 className="mt-2 text-lg font-bold">{headline}</h3>
      <p className="mt-2 text-sm leading-relaxed">{detail}</p>
    </div>
  );
}

export function AppShortcutOverlay({ type, onClose }: AppShortcutOverlayProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { openErfassung } = useErfassung();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  // Fail-closed: solange die Berechtigungen unbekannt sind, wird kein Auftragseinstieg angeboten.
  const canCreateOrder = !permissionsLoading && hasPermission("perm_data_orders");

  // Prevent background scrolling
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  const handleAction = (href: string) => {
    onClose();
    // Pass the current pathname as returnTo context
    const url = new URL(href, window.location.origin);
    url.searchParams.set("returnTo", pathname);
    router.push(url.pathname + url.search);
  };

  let title = "";
  let content = null;
  let hasSelectableAction = true;

  switch (type) {
    case "new_order":
      title = "Neuer Auftrag";
      hasSelectableAction = canCreateOrder;
      content = !canCreateOrder ? (
        permissionsLoading ? (
          <UnavailableCard
            code="NOT_AVAILABLE"
            headline="Auftragserfassung ist derzeit nicht verfügbar"
            detail="Die Berechtigungen sind noch nicht bestätigt. Bis dahin wird kein Erfassungsweg angeboten."
            testId="shortcut-new-order-unavailable"
          />
        ) : (
          <UnavailableCard
            code="FORBIDDEN"
            headline="Keine Berechtigung zur Auftragserfassung"
            detail="Für das Anlegen von Aufträgen fehlt die Berechtigung perm_data_orders. Die serverseitige Prüfung bleibt massgeblich."
            testId="shortcut-new-order-forbidden"
          />
        )
      ) : (
        <>
          <AppActionTile
            icon={<Edit3 className="w-6 h-6" />}
            title="Manuell anlegen"
            description="Klassische Eingabe aller Auftragsdaten ohne Vorlage."
            onClick={() => {
              onClose();
              openErfassung({ mode: "order", intent: "create_order", source: "shortcut" });
            }}
          />
          <AppActionTile
            className="opacity-60 cursor-not-allowed hover:border-neutral-gray-200 hover:shadow-none"
            disabled
            icon={<Camera className="w-6 h-6" />}
            title="Foto / Kamera"
            description="NOT_AVAILABLE: Für die Auftragserfassung per Foto ist kein bestätigter Erfassungsweg hinterlegt."
          />
          <AppActionTile
            className="opacity-60 cursor-not-allowed hover:border-neutral-gray-200 hover:shadow-none"
            disabled
            icon={<Upload className="w-6 h-6" />}
            title="Datei hochladen"
            description="NOT_AVAILABLE: Für den Datei-Import von Lieferscheinen oder Listen ist kein Command hinterlegt."
          />
          <AppActionTile
            className="opacity-60 cursor-not-allowed hover:border-neutral-gray-200 hover:shadow-none"
            disabled
            icon={<Phone className="w-6 h-6" />}
            title="Aus Telefonnotiz"
            description="NOT_AVAILABLE: Aus einer Telefonnotiz kann derzeit kein Auftrag abgeleitet werden."
          />
        </>
      );
      break;

    case "new_customer":
      title = "Neuer Kunde";
      hasSelectableAction = false;
      content = (
        <UnavailableCard
          code="NOT_AVAILABLE"
          headline="Eigenständige Kundenanlage ist nicht verfügbar"
          detail="Für das eigenständige Anlegen eines Kunden ist kein serverseitiger Command hinterlegt. Kunden entstehen ausschliesslich über die bestätigte Auftragserfassung."
          testId="shortcut-new-customer-unavailable"
        />
      );
      break;

    case "new_document":
      title = "Neues Dokument";
      content = (
        <>
          <AppActionTile
            icon={<Camera className="w-6 h-6" />}
            title="Foto / Scan aufnehmen"
            description="Dokument direkt mit der Kamera abfotografieren."
            contextChip="Schnell"
            onClick={() => handleAction("/buchhaltung/belege/neu")}
          />
          <AppActionTile
            icon={<Upload className="w-6 h-6" />}
            title="Datei hochladen"
            description="Vorhandenes PDF oder Bild aus dem Dateisystem wählen."
            onClick={() => handleAction("/buchhaltung/belege/neu")}
          />
        </>
      );
      break;

    default:
      content = <p>Typ nicht konfiguriert.</p>;
  }

  return (
    <div className="fixed inset-0 z-9999 flex flex-col">
      {/* Blurred background */}
      <div
        className="absolute inset-0 bg-navy-900/40 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Drawer content (bottom up on mobile, centered on desktop) */}
      <div className="relative mt-auto md:m-auto w-full max-w-3xl bg-bg-app rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-200">
        <div className="p-6 md:p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl md:text-3xl font-black font-serif text-navy-900">{title}</h2>
            <button
              aria-label="Schließen"
              onClick={onClose}
              className="flex items-center justify-center bg-neutral-gray-200 hover:bg-error-red hover:text-white text-navy-900 rounded-full transition-colors shrink-0"
              style={{ width: "48px", height: "48px", minWidth: "48px", minHeight: "48px" }}
              type="button"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <p className="text-text-muted mb-8 text-sm md:text-base">
            {hasSelectableAction
              ? "Bitte wähle aus, wie du fortfahren möchtest."
              : "Für diesen Einstieg steht derzeit kein bestätigter Weg zur Verfügung."}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {content}
          </div>
        </div>
      </div>
    </div>
  );
}
