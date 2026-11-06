"use client";

import { useRef, useState } from "react";
import { Button, Dialog, Eingabe, Feld, FormRaster, Hinweis, Rueckfrage, Segment, Textfeld } from "@/ui/kr";
import type {
  CustomerAgreementCommandResult,
  CustomerAgreementRecord,
  CustomerAgreementType,
  RevokeCustomerAgreementInput,
  SaveCustomerAgreementInput,
} from "../server/types";

const TYPE_OPTIONS: ReadonlyArray<{ wert: CustomerAgreementType; text: string }> = [
  { wert: "ausgabe_ohne_zahlung", text: "Übergabe ohne Zahlung · Rechnung folgt" },
  { wert: "sammelrechnung", text: "Sammelrechnung monatlich" },
  { wert: "zahlungsziel", text: "Zahlungsziel in Tagen" },
];

type AgreementMode = "new" | "edit" | "revoke";
type AgreementScope = "customer" | "order";

export type CustomerAgreementTarget = {
  customerId: string;
  customerNumber: string | null;
  customerName: string;
  order?: { id: string; orderNumber: string } | null;
};

type Draft = {
  type: CustomerAgreementType | "";
  scope: AgreementScope;
  targetDays: string;
  validUntil: string;
  reason: string;
};

type SavedOutcome = {
  agreement: CustomerAgreementRecord;
  kind: "saved" | "revoked";
  message: string;
};

export type CustomerAgreementDialogProps = {
  target: CustomerAgreementTarget;
  mode?: AgreementMode;
  agreement?: CustomerAgreementRecord | null;
  initialReason?: string;
  onSave: (input: SaveCustomerAgreementInput) => Promise<CustomerAgreementCommandResult>;
  onRevoke: (input: RevokeCustomerAgreementInput) => Promise<CustomerAgreementCommandResult>;
  onClose: () => void;
  onMessage?: (message: string) => void;
  onSaved?: (agreement: CustomerAgreementRecord, kind: "saved" | "revoked") => void;
  onReload?: () => Promise<void> | void;
};

function berlinToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function labelForType(type: CustomerAgreementType | "") {
  return TYPE_OPTIONS.find((option) => option.wert === type)?.text ?? "Typ fehlt";
}

function initialDraft(target: CustomerAgreementTarget, agreement: CustomerAgreementRecord | null | undefined, initialReason?: string): Draft {
  return {
    type: agreement?.type ?? "",
    scope: agreement?.orderId ? "order" : target.order ? "order" : "customer",
    targetDays: agreement?.targetDays === null || agreement?.targetDays === undefined ? "" : String(agreement.targetDays),
    validUntil: agreement?.validUntil ?? "",
    reason: agreement?.reason ?? initialReason ?? "",
  };
}

function requiresDays(type: CustomerAgreementType | "") {
  return type === "sammelrechnung" || type === "zahlungsziel";
}

function visibleFailure(result: Exclude<CustomerAgreementCommandResult, { code: "OK" }>) {
  if (result.code === "FORBIDDEN") return "Nur mit Recht „Geld, Preise & Buchhaltung“";
  if (result.code === "CONFLICT") return "Absprache wurde inzwischen geändert · neu laden";
  return `Nicht gespeichert · Eingaben sind noch da · ${result.message}`;
}

/**
 * AP-ABS 5.4.  The caller owns navigation and the one existing customer
 * read path; this dialog owns only the user draft and calls the two approved
 * customer agreement actions.  A retry deliberately keeps its client key.
 */
export function CustomerAgreementDialog({
  target,
  mode = "new",
  agreement = null,
  initialReason,
  onSave,
  onRevoke,
  onClose,
  onMessage,
  onSaved,
  onReload,
}: CustomerAgreementDialogProps) {
  const [baseline] = useState(() => initialDraft(target, agreement, initialReason));
  const [draft, setDraft] = useState(() => initialDraft(target, agreement, initialReason));
  const [errors, setErrors] = useState<Partial<Record<"type" | "targetDays" | "validUntil" | "reason", string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [savedOutcome, setSavedOutcome] = useState<SavedOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [closePrompt, setClosePrompt] = useState(false);
  const requestKey = useRef<string | null>(null);
  const working = useRef(false);

  const isRevoke = mode === "revoke";
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const typeLabel = labelForType(draft.type);
  const scopeLabel = draft.scope === "order"
    ? `nur Auftrag ${target.order?.orderNumber ?? "dieser Auftrag"}`
    : `ganzer Kunde ${target.customerName}`;

  const set = (patch: Partial<Draft>) => {
    if (working.current) return;
    setDraft((value) => ({ ...value, ...patch }));
    setErrors({});
    setFailure(null);
    setSavedOutcome(null);
  };

  const focus = (id: string) => {
    requestAnimationFrame(() => {
      const field = document.querySelector<HTMLElement>(`[data-spec-id="absprache.${id}"]`);
      field?.scrollIntoView({ block: "nearest" });
      field?.focus();
    });
  };

  const validate = () => {
    const next: Partial<Record<"type" | "targetDays" | "validUntil" | "reason", string>> = {};
    if (!isRevoke && !draft.type) next.type = "Typ wählen";
    if (!isRevoke && requiresDays(draft.type)) {
      const days = Number(draft.targetDays);
      if (!Number.isInteger(days) || days < 1 || days > 120) next.targetDays = "Tage eintragen · 1 bis 120";
    }
    if (!isRevoke && draft.validUntil && draft.validUntil < berlinToday()) next.validUntil = "Datum heute oder später wählen";
    if (draft.reason.trim().length < 3 || draft.reason.trim().length > 200) next.reason = "Bitte Grund angeben";
    setErrors(next);
    const first = ["type", "targetDays", "validUntil", "reason"].find((key) => next[key as keyof typeof next]);
    if (first) focus(first);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (working.current || busy || !validate()) return;
    if (isRevoke && !agreement) {
      setFailure("Absprache ist nicht verfügbar · neu laden.");
      return;
    }
    if (!isRevoke && !draft.type) return;

    const clientKey = requestKey.current ?? crypto.randomUUID();
    requestKey.current = clientKey;
    working.current = true;
    setBusy(true);
    setFailure(null);
    try {
      const result = isRevoke
        ? await onRevoke({
          clientKey,
          agreementId: agreement!.id,
          reason: draft.reason.trim(),
          version: agreement!.version,
        })
        : await onSave({
          clientKey,
          customerId: target.customerId,
          orderId: draft.scope === "order" ? agreement?.orderId ?? target.order?.id ?? null : null,
          type: draft.type as CustomerAgreementType,
          targetDays: requiresDays(draft.type) ? Number(draft.targetDays) : null,
          validUntil: draft.validUntil || null,
          reason: draft.reason.trim(),
          version: agreement?.version ?? null,
        });
      if (result.code !== "OK") {
        setFailure(visibleFailure(result));
        return;
      }
      const outcome: SavedOutcome = {
        agreement: result.agreement,
        kind: isRevoke ? "revoked" : "saved",
        message: isRevoke
        ? `Absprache ${typeLabel} widerrufen · offene Übergaben brauchen wieder eine Zahlung`
        : `Absprache ${typeLabel} gilt ab sofort für ${scopeLabel}`,
      };
      try {
        await onReload?.();
      } catch (error) {
        console.error("[CUSTOMER_AGREEMENT_DIALOG_RELOAD_FAILED]", { errorName: error instanceof Error ? error.name : "UnknownError" });
        setSavedOutcome(outcome);
        setFailure("Absprache wurde gespeichert · Kundenkarte konnte nicht neu geladen werden. Code: CUSTOMER_AGREEMENT_DIALOG_RELOAD_FAILED.");
        return;
      }
      onSaved?.(outcome.agreement, outcome.kind);
      onMessage?.(outcome.message);
      onClose();
    } catch (error) {
      console.error("[CUSTOMER_AGREEMENT_DIALOG_REQUEST_FAILED]", { errorName: error instanceof Error ? error.name : "UnknownError" });
      setFailure("Nicht gespeichert · Eingaben sind noch da. Code: CUSTOMER_AGREEMENT_DIALOG_REQUEST_FAILED.");
    } finally {
      working.current = false;
      setBusy(false);
    }
  };

  const requestClose = () => {
    if (busy) return;
    if (savedOutcome) {
      onClose();
      return;
    }
    if (dirty) {
      setClosePrompt(true);
      return;
    }
    onClose();
  };

  const reload = async () => {
    if (!onReload || busy) return;
    setBusy(true);
    try {
      await onReload();
      requestKey.current = null;
      setFailure(null);
      if (savedOutcome) {
        onSaved?.(savedOutcome.agreement, savedOutcome.kind);
        onMessage?.(savedOutcome.message);
        onClose();
      }
    } catch (error) {
      console.error("[CUSTOMER_AGREEMENT_DIALOG_RELOAD_FAILED]", { errorName: error instanceof Error ? error.name : "UnknownError" });
      setFailure("Absprache konnte nicht neu geladen werden. Code: CUSTOMER_AGREEMENT_DIALOG_RELOAD_FAILED.");
    } finally {
      setBusy(false);
    }
  };

  const required = (text: string) => <>{text} <small aria-hidden="true" className="ev-pflicht">Pflicht</small></>;
  const closeGuard = () => {
    if (busy) return false;
    if (savedOutcome) return true;
    if (dirty) {
      setClosePrompt(true);
      return false;
    }
    return true;
  };
  const actionText = isRevoke
    ? busy ? "Wird widerrufen …" : "Absprache widerrufen · gilt sofort"
    : !draft.type ? "Typ wählen" : busy ? "Wird gespeichert …" : "Absprache speichern · gilt sofort";

  return <>
    <Dialog
      titel="Absprache festlegen"
      unterzeile={mode === "edit" ? "Absprache ändern" : mode === "revoke" ? "Absprache widerrufen" : undefined}
      icon="check"
      groesse="schmal"
      schliessenSpecId="absprache.schliessen"
      onSchliessen={onClose}
      vorSchliessen={closeGuard}
      fuss={<>
        <Button data-spec-id="absprache.abbrechen" text="Abbrechen" disabled={busy} onClick={requestClose} />
        <Button
          data-spec-id={isRevoke ? "absprache.widerrufen" : "absprache.speichern"}
          art={isRevoke ? "gefaehrlich" : "erledigen"}
          icon={isRevoke ? "x" : "check"}
          text={actionText}
          disabled={busy || (!isRevoke && !draft.type) || (isRevoke && !agreement)}
          onClick={() => void submit()}
        />
      </>}
    >
      <form data-spec-id="absprache" className="kr-stapel" onSubmit={(event) => { event.preventDefault(); void submit(); }} noValidate>
        <div className="ev-id ev-id--kunde" aria-label={`Kunde ${target.customerName}`}>
          <span className="kr-id">{target.customerNumber ?? "Kundennummer fehlt"}</span>
          <strong>{target.customerName}</strong>
        </div>
        {isRevoke ? <>
          <Hinweis ton="warn">{typeLabel} wird für {agreement?.orderId ? `Auftrag ${target.order?.orderNumber ?? ""}`.trim() : `Kunde ${target.customerName}`} widerrufen.</Hinweis>
          <Feld label={required("Grund")} fehler={errors.reason} voll>
            <Textfeld data-spec-id="absprache.grund" rows={3} maxLength={200} value={draft.reason} disabled={busy} onChange={(event) => set({ reason: event.target.value })} />
          </Feld>
        </> : <>
          {!draft.type ? <p data-spec-id="absprache.zustand.leer">Typ wählen · dann Geltung und Grund</p> : null}
          <FormRaster>
            <Feld label={required("Was gilt?")} fehler={errors.type}>
              <select data-spec-id="absprache.typ" className="kr-auswahl" value={draft.type} disabled={busy} onChange={(event) => set({ type: event.target.value as CustomerAgreementType | "", targetDays: "" })}>
                <option value="">Bitte wählen</option>
                {TYPE_OPTIONS.map((option) => <option key={option.wert} value={option.wert}>{option.text}</option>)}
              </select>
            </Feld>
            <span aria-hidden="true" />
            <Feld label={required("Gilt für")} voll>
              <div data-spec-id="absprache.geltung">
                <Segment
                  label="Gilt für"
                  wert={draft.scope}
                  optionen={[
                    { wert: "customer", text: `ganzer Kunde ${target.customerName}` },
                    { wert: "order", text: target.order ? `nur Auftrag ${target.order.orderNumber}` : "nur ein Auftrag · aus 4.1 oder 10.1 wählbar", gesperrt: !target.order },
                  ]}
                  onWert={(scope) => set({ scope })}
                />
              </div>
            </Feld>
            {requiresDays(draft.type) ? <Feld label={required("Zahlungsziel")} fehler={errors.targetDays}>
              <Eingabe data-spec-id="absprache.tage" type="number" inputMode="numeric" min={1} max={120} step={1} value={draft.targetDays} disabled={busy} onChange={(event) => set({ targetDays: event.target.value })} />
            </Feld> : null}
            <Feld label="Gilt bis" fehler={errors.validUntil} className={requiresDays(draft.type) ? undefined : "kr-voll"}>
              <Eingabe data-spec-id="absprache.gueltig_bis" type="date" value={draft.validUntil} disabled={busy} onChange={(event) => set({ validUntil: event.target.value })} />
            </Feld>
            <Feld label={required("Grund")} fehler={errors.reason} voll>
              <Textfeld data-spec-id="absprache.grund" rows={3} maxLength={200} value={draft.reason} disabled={busy} onChange={(event) => set({ reason: event.target.value })} />
            </Feld>
          </FormRaster>
        </>}
        {failure ? <div data-spec-id="absprache.zustand.fehler" role="alert" className="kr-stapel">
          <Hinweis ton="warn">{failure}</Hinweis>
          <div>
            {(savedOutcome || failure.includes("neu laden")) && onReload ? <Button data-spec-id="absprache.neu-laden" text="Neu laden" disabled={busy} onClick={() => void reload()} /> : null}
            {!savedOutcome ? <Button data-spec-id="absprache.erneut" text={isRevoke ? "Erneut widerrufen" : "Erneut speichern"} disabled={busy} onClick={() => void submit()} /> : null}
          </div>
        </div> : null}
      </form>
    </Dialog>
    {closePrompt ? <Rueckfrage
      felder={["Absprache"]}
      hauptaktion={isRevoke ? undefined : { text: "Absprache speichern · gilt sofort", lauftext: "Wird gespeichert …", ausfuehren: () => void submit() }}
      beschaeftigt={busy}
      fehler={failure}
      onWeiter={() => setClosePrompt(false)}
      onVerwerfen={onClose}
    /> : null}
  </>;
}
