"use client";

import { updateFinanceSettingsAction } from "@/app/buchhaltung/einstellungen/actions";
import { BackButton } from "@/components/ui/BackButton";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";
import { usePageView } from "@/hooks/usePageView";
import type {
  FinanceLedger,
  FinanceSettingsInput,
  FinanceSettingsSnapshot,
} from "@/lib/buchhaltung/settingsContract";
import { CheckCircle2, Cpu, FileText, Landmark, Lock, Save, Settings, Shield } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";

type Props = {
  initialSettings: FinanceSettingsSnapshot;
};

function saveError(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  if (code.includes("INVALID_FINANCE_SETTINGS")) return "Die Eingaben sind ungültig.";
  if (code.includes("FINANCE_PROFILE_NOT_CONFIGURED")) return "Es ist kein aktives Steuerprofil eingerichtet.";
  if (code.includes("FINANCE_PROFILE_AMBIGUOUS")) return "Es existiert mehr als ein aktives Steuerprofil.";
  if (code.includes("AUTH_ERROR")) return "Für diese Änderung fehlt die Berechtigung.";
  return "Die Einstellungen konnten nicht gespeichert werden.";
}

export function EinstellungenClient({ initialSettings }: Props) {
  usePageView();
  const [settings, setSettings] = useState(initialSettings);
  const [form, setForm] = useState<FinanceSettingsInput>({
    standardKontenrahmen: initialSettings.standardKontenrahmen,
    ocrConfidenceSchwelle: initialSettings.ocrConfidenceSchwelle,
    beraterNr: initialSettings.beraterNr,
    mandantenNr: initialSettings.mandantenNr,
  });
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAuditId, setSavedAuditId] = useState<string | null>(null);

  const setLedger = (value: FinanceLedger) => {
    setForm((current) => ({ ...current, standardKontenrahmen: value }));
    setSavedAuditId(null);
  };

  const save = () => {
    setError(null);
    setSavedAuditId(null);
    startTransition(async () => {
      try {
        const receipt = await updateFinanceSettingsAction(form);
        setSettings(receipt);
        setForm({
          standardKontenrahmen: receipt.standardKontenrahmen,
          ocrConfidenceSchwelle: receipt.ocrConfidenceSchwelle,
          beraterNr: receipt.beraterNr,
          mandantenNr: receipt.mandantenNr,
        });
        setSavedAuditId(receipt.auditId);
      } catch (saveFailure) {
        setError(saveError(saveFailure));
      }
    });
  };

  const ocrMessage = settings.ocr.status === "configured"
    ? `${settings.ocr.provider} und der geschützte Belegspeicher sind serverseitig konfiguriert.`
    : settings.ocr.provider === "Gemini" && !settings.ocr.usageAccountingConfigured
      ? "Gemini ist hinterlegt, die verpflichtende Nutzungsabrechnung jedoch nicht vollständig konfiguriert."
      : settings.ocr.provider
        ? `${settings.ocr.provider} ist konfiguriert, der geschützte Belegspeicher jedoch nicht vollständig.`
      : "Es ist kein OCR-Anbieter konfiguriert. Belege werden nicht automatisch erkannt.";

  return (
    <div className="w-full px-4 pb-24 sm:px-6 xl:px-8">
      <div className="mb-6">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Buchhaltung", href: "/buchhaltung" }, { label: "Einstellungen" }]} />
        <BackButton label="Buchhaltung" href="/buchhaltung" />
      </div>

      <h1 className="mb-1 text-2xl font-extrabold text-navy-900">Buchhaltung – Einstellungen</h1>
      <p className="mb-8 text-sm text-text-muted">Gespeicherte Vorgaben des aktiven Steuerprofils und der Belegverarbeitung.</p>

      <div className="max-w-3xl space-y-6">
        {!settings.persisted && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Für die Belegverarbeitung existiert noch kein gespeicherter Einstellungsdatensatz. Angezeigt werden die Vorgaben des aktiven Steuerprofils.
          </div>
        )}

        {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>}
        {savedAuditId && (
          <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <span className="inline-flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" /> Einstellungen gespeichert und protokolliert.</span>
            <span className="mt-1 block text-xs">Audit-ID: {savedAuditId}</span>
          </div>
        )}

        <Card title="Kontenrahmen" icon={<FileText className="h-5 w-5 text-accent-orange" />}>
          <div className="flex gap-3">
            {(["SKR03", "SKR04"] as const).map((value) => (
              <button
                key={value}
                type="button"
                disabled={!settings.editable || isPending}
                onClick={() => setLedger(value)}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${form.standardKontenrahmen === value ? "bg-navy-900 text-white" : "border border-neutral-gray-200 bg-white text-text-muted"}`}
              >
                {value}
              </button>
            ))}
          </div>
        </Card>

        <Card title="Steuerberater-Zuordnung" icon={<Shield className="h-5 w-5 text-emerald-500" />}>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberIdentifier
              label="Berater-Nr."
              value={form.beraterNr ?? ""}
              disabled={!settings.editable || isPending}
              onChange={(value) => setForm((current) => ({ ...current, beraterNr: value || null }))}
            />
            <NumberIdentifier
              label="Mandanten-Nr."
              value={form.mandantenNr ?? ""}
              disabled={!settings.editable || isPending}
              onChange={(value) => setForm((current) => ({ ...current, mandantenNr: value || null }))}
            />
          </div>
        </Card>

        <Card title="OCR-Laufzeitstatus" icon={<Cpu className="h-5 w-5 text-blue-500" />}>
          <p className={`text-sm font-semibold ${settings.ocr.status === "configured" ? "text-emerald-700" : "text-amber-700"}`}>
            {settings.ocr.status === "configured" ? "Konfiguriert" : "Nicht einsatzbereit"}
          </p>
          <p className="mt-1 text-xs text-text-muted">{ocrMessage}</p>
          <p className="mt-2 text-xs text-text-muted">Anbieter und Geheimnisse werden ausschließlich über die Serverumgebung verwaltet und sind hier nicht umschaltbar.</p>
        </Card>

        <Card title="Prüfschwelle der Belegerkennung" icon={<Settings className="h-5 w-5 text-amber-500" />}>
          <div className="flex items-center gap-4">
            <input
              aria-label="OCR-Prüfschwelle"
              type="range"
              min={50}
              max={99}
              value={form.ocrConfidenceSchwelle}
              disabled={!settings.editable || isPending}
              onChange={(event) => setForm((current) => ({ ...current, ocrConfidenceSchwelle: Number(event.target.value) }))}
              className="flex-1 accent-navy-900 disabled:opacity-60"
            />
            <span className="w-16 text-center text-lg font-extrabold text-navy-900">{form.ocrConfidenceSchwelle} %</span>
          </div>
          <p className="mt-1 text-xs text-text-muted">Ergebnisse unter dieser Schwelle werden als besonders unsicher markiert. Jeder neue OCR-Beleg bleibt bis zur menschlichen Bestätigung im Status „Prüfen“.</p>
        </Card>

        <UnavailableIntegration
          title="ELSTER"
          icon={<Lock className="h-5 w-5 text-red-500" />}
          text="Nicht verbunden. Es gibt derzeit keinen Zertifikats-Upload und keinen ELSTER-Direktversand in der Anwendung."
        />
        <UnavailableIntegration
          title="Bankzugang (PSD2)"
          icon={<Landmark className="h-5 w-5 text-red-500" />}
          text="Nicht verbunden. Es gibt derzeit keinen Bank-Aggregator und keine Live-Bankumsätze in der Anwendung."
        />

        <div className="flex flex-wrap items-center gap-3">
          {settings.editable ? (
            <button
              type="button"
              disabled={isPending}
              onClick={save}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-navy-900 px-5 py-2 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60"
            >
              <Save className="h-4 w-4" /> {isPending ? "Speichert …" : "Einstellungen speichern"}
            </button>
          ) : (
            <p className="text-sm text-text-muted">Nur Administratoren können diese Einstellungen ändern.</p>
          )}
          {settings.updatedAt && <p className="text-xs text-text-muted">Zuletzt gespeichert: {new Date(settings.updatedAt).toLocaleString("de-DE")}</p>}
        </div>
      </div>

      <FeedbackFooter pageTitle="Buchhaltung Einstellungen" route="/buchhaltung/einstellungen" variant="full" />
    </div>
  );
}

function NumberIdentifier({ label, value, disabled, onChange }: { label: string; value: string; disabled: boolean; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={20}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 20))}
        className="mt-1 w-full rounded-xl border border-neutral-gray-200 px-3 py-2 text-sm focus:border-navy-900 focus:outline-none disabled:bg-neutral-50 disabled:text-text-muted"
      />
    </label>
  );
}

function UnavailableIntegration({ title, icon, text }: { title: string; icon: ReactNode; text: string }) {
  return (
    <Card title={title} icon={icon}>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-800">Nicht angebunden</p>
        <p className="mt-1 text-xs text-amber-700">{text}</p>
      </div>
    </Card>
  );
}

function Card({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-gray-50">{icon}</div>
        <h2 className="text-base font-extrabold text-navy-900">{title}</h2>
      </div>
      {children}
    </section>
  );
}
