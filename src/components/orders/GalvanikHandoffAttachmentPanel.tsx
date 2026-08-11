"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, Loader2, Paperclip, ShieldCheck, Upload } from "lucide-react";
import {
  finalizeGalvanikHandoffAttachmentAction,
  getGalvanikHandoffAttachmentOriginalAction,
  getGalvanikHandoffAttachmentsAction,
  reserveGalvanikHandoffAttachmentAction,
} from "@/app/warendurchlauf/actions";
import { supabase } from "@/lib/supabase/client";
import type {
  OrderStationAttachmentConflictReason,
  OrderStationAttachmentMime,
  OrderStationAttachmentReceipt,
} from "@/lib/server/orderStationAttachment";

const BUCKET_ID = "item-photos";
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const ORIGINAL_DOWNLOAD_SECONDS = 60;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const PATH_PATTERN = /^order-station-evidence\/v1\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/;
const ACCEPTED_MIME = new Set<OrderStationAttachmentMime>(["image/jpeg", "image/png", "image/webp"]);
const MIME_EXTENSION: Record<OrderStationAttachmentMime, "jpg" | "png" | "webp"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const RESTART_REASONS = new Set<OrderStationAttachmentConflictReason>([
  "UPLOAD_GRANT_EXPIRED",
  "UPLOAD_MISMATCH",
  "UPLOAD_OUTSIDE_WINDOW",
]);

type AttachmentItem = { id: string; name: string };
type PanelState = "loading" | "ready" | "unavailable";
type Operation = "idle" | "hashing" | "reserving" | "uploading" | "finalizing" | "readback" | "downloading";
type FileIntent = {
  mimeType: OrderStationAttachmentMime;
  fileBytes: number;
  contentSha256: string;
};
type DownloadGrant = { url: string; expiresAt: number };
type RestartSelection = {
  reservationId: string;
  intentKey: string;
  reason: "UPLOAD_GRANT_EXPIRED" | "UPLOAD_MISMATCH" | "UPLOAD_OUTSIDE_WINDOW";
};
type WorkflowScope = {
  key: string;
  generation: number;
  operationId: number;
};
type FinalizeOutcome = "SUCCESS" | "NOT_READY" | "STOP" | "STALE";

export type GalvanikHandoffAttachmentPanelProps = {
  orderId: string;
  expectedVersion: number;
  items: AttachmentItem[];
};

async function readAndHash(file: File): Promise<{ bytes: Uint8Array; contentSha256: string }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return {
    bytes,
    contentSha256: Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(""),
  };
}

function makeScopeKey(orderId: string, expectedVersion: number, itemId: string, itemIdentity: string): string {
  return JSON.stringify([orderId, expectedVersion, itemId, itemIdentity]);
}

function attachmentItemsIdentity(items: AttachmentItem[]): string {
  return JSON.stringify(items.map((item) => [item.id, item.name]));
}

function nowMs(): number {
  return Date.now();
}

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Zeit nicht verfügbar" : parsed.toLocaleString("de-DE");
}

function expectedObjectPath(reservationId: string, mimeType: OrderStationAttachmentMime): string {
  return `order-station-evidence/v1/${reservationId}.${MIME_EXTENSION[mimeType]}`;
}

function sameImmutableBinding(
  left: OrderStationAttachmentReceipt,
  right: OrderStationAttachmentReceipt,
): boolean {
  return left.reservationId === right.reservationId
    && left.clientRequestId === right.clientRequestId
    && left.customerId === right.customerId
    && left.orderId === right.orderId
    && left.itemId === right.itemId
    && left.transitionEventId === right.transitionEventId
    && left.orderVersion === right.orderVersion
    && left.actorId === right.actorId
    && left.actorDisplayName === right.actorDisplayName
    && left.mimeType === right.mimeType
    && left.fileBytes === right.fileBytes
    && left.contentSha256 === right.contentSha256
    && left.uploadExpiresAt === right.uploadExpiresAt
    && left.reservedAt === right.reservedAt;
}

function sameReceipt(left: OrderStationAttachmentReceipt, right: OrderStationAttachmentReceipt): boolean {
  return sameImmutableBinding(left, right)
    && left.receiptId === right.receiptId
    && left.state === right.state
    && left.verifiedAt === right.verifiedAt;
}

function intentMatchesReceipt(
  receipt: OrderStationAttachmentReceipt,
  actorId: string,
  orderId: string,
  itemId: string,
  expectedVersion: number,
  intent: FileIntent,
): boolean {
  return receipt.state === "PENDING"
    && receipt.receiptId === null
    && receipt.verifiedAt === null
    && receipt.actorId === actorId
    && receipt.orderId === orderId
    && receipt.itemId === itemId
    && receipt.orderVersion === expectedVersion
    && receipt.mimeType === intent.mimeType
    && receipt.fileBytes === intent.fileBytes
    && receipt.contentSha256 === intent.contentSha256;
}

function submittedIntentMatchesReceipt(
  receipt: OrderStationAttachmentReceipt,
  actorId: string,
  orderId: string,
  itemId: string,
  expectedVersion: number,
  clientRequestId: string,
  intent: FileIntent,
): boolean {
  return UUID_PATTERN.test(receipt.reservationId)
    && receipt.actorId === actorId
    && receipt.orderId === orderId
    && receipt.itemId === itemId
    && receipt.orderVersion === expectedVersion
    && receipt.clientRequestId === clientRequestId
    && receipt.mimeType === intent.mimeType
    && receipt.fileBytes === intent.fileBytes
    && receipt.contentSha256 === intent.contentSha256
    && (
      (receipt.state === "PENDING" && receipt.receiptId === null && receipt.verifiedAt === null)
      || (receipt.state === "FINALIZED" && UUID_PATTERN.test(receipt.receiptId ?? "") && receipt.verifiedAt !== null)
    );
}

function finalizedReceiptMatchesSource(
  finalized: OrderStationAttachmentReceipt,
  source: OrderStationAttachmentReceipt,
  actorId: string,
): boolean {
  return finalized.actorId === actorId
    && finalized.state === "FINALIZED"
    && UUID_PATTERN.test(finalized.receiptId ?? "")
    && finalized.verifiedAt !== null
    && sameImmutableBinding(finalized, source);
}

function fileIntentKey(intent: FileIntent): string {
  return `${intent.mimeType}|${intent.fileBytes}|${intent.contentSha256}`;
}

function newestPending(receipts: OrderStationAttachmentReceipt[]): OrderStationAttachmentReceipt | null {
  return [...receipts].sort((left, right) => {
    const byTime = new Date(right.reservedAt).getTime() - new Date(left.reservedAt).getTime();
    return byTime !== 0 ? byTime : right.reservationId.localeCompare(left.reservationId);
  })[0] ?? null;
}

function operationLabel(operation: Operation): string {
  const labels: Record<Exclude<Operation, "idle">, string> = {
    hashing: "Datei wird lokal geprüft…",
    reserving: "Sichere Uploadfreigabe wird reserviert…",
    uploading: "Original wird hochgeladen…",
    finalizing: "Gespeichertes Original wird geprüft…",
    readback: "Metadaten werden erneut aus der Datenbank bestätigt…",
    downloading: "Privater Download wird vorbereitet…",
  };
  return operation === "idle" ? "" : labels[operation];
}

function restartMessage(reason: RestartSelection["reason"]): string {
  if (reason === "UPLOAD_GRANT_EXPIRED") {
    return "Die serverseitige Uploadfrist ist abgelaufen. Bei erneuter Auswahl wird zuerst das alte Objekt geprüft; fehlt es weiter, wird bewusst neu reserviert und hochgeladen.";
  }
  if (reason === "UPLOAD_OUTSIDE_WINDOW") {
    return "Das gespeicherte Objekt liegt außerhalb der Uploadfrist. Wählen Sie dieselbe Datei erneut aus, um bewusst neu zu reservieren.";
  }
  return "Das gespeicherte Objekt passt nicht zur Reservierung. Wählen Sie dieselbe Datei erneut aus, um bewusst neu zu reservieren.";
}

export function GalvanikHandoffAttachmentPanel({
  orderId,
  expectedVersion,
  items,
}: GalvanikHandoffAttachmentPanelProps) {
  const panelKey = JSON.stringify([orderId, expectedVersion, attachmentItemsIdentity(items)]);
  return <GalvanikHandoffAttachmentPanelInner
    key={panelKey}
    orderId={orderId}
    expectedVersion={expectedVersion}
    items={items}
  />;
}

function GalvanikHandoffAttachmentPanelInner({
  orderId,
  expectedVersion,
  items,
}: GalvanikHandoffAttachmentPanelProps) {
  const itemIdentity = attachmentItemsIdentity(items);
  const initialItemId = items.length === 1 ? items[0].id : "";
  const [selectedItemId, setSelectedItemId] = useState(initialItemId);
  const [receipts, setReceipts] = useState<OrderStationAttachmentReceipt[]>([]);
  const [panelState, setPanelState] = useState<PanelState>("loading");
  const [serverCanOperate, setServerCanOperate] = useState(false);
  const [currentActorId, setCurrentActorId] = useState<string | null>(null);
  const [operation, setOperation] = useState<Operation>("idle");
  const [message, setMessage] = useState("");
  const [restartSelection, setRestartSelection] = useState<RestartSelection | null>(null);
  const [download, setDownload] = useState<DownloadGrant | null>(null);
  const [loadedScopeKey, setLoadedScopeKey] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const metadataSequence = useRef(0);
  const metadataInFlight = useRef(false);
  const scopeGeneration = useRef(0);
  const nextOperationId = useRef(0);
  const activeOperationId = useRef<number | null>(null);
  const renderedScopeKey = makeScopeKey(orderId, expectedVersion, selectedItemId, itemIdentity);
  const scopeKeyRef = useRef(makeScopeKey(orderId, expectedVersion, initialItemId, itemIdentity));
  const scopeReady = loadedScopeKey === renderedScopeKey;
  const busy = operation !== "idle";
  const canUpload = scopeReady
    && panelState === "ready"
    && serverCanOperate
    && currentActorId !== null
    && selectedItemId.length > 0
    && !busy;

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId],
  );

  const baseScopeIsCurrent = useCallback((scope: Pick<WorkflowScope, "key" | "generation">): boolean =>
    scope.key === scopeKeyRef.current
      && scope.generation === scopeGeneration.current, []);

  const workflowIsCurrent = useCallback((scope: WorkflowScope): boolean =>
    baseScopeIsCurrent(scope) && activeOperationId.current === scope.operationId, [baseScopeIsCurrent]);

  const invalidateScope = (nextItemId: string) => {
    scopeGeneration.current += 1;
    metadataSequence.current += 1;
    metadataInFlight.current = false;
    activeOperationId.current = null;
    scopeKeyRef.current = makeScopeKey(orderId, expectedVersion, nextItemId, itemIdentity);
    setReceipts([]);
    setServerCanOperate(false);
    setCurrentActorId(null);
    setPanelState(nextItemId ? "loading" : "ready");
    setOperation("idle");
    setMessage("");
    setRestartSelection(null);
    setDownload(null);
    setLoadedScopeKey(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const beginWorkflow = (nextOperation: Operation): WorkflowScope | null => {
    if (activeOperationId.current !== null) return null;
    const operationId = ++nextOperationId.current;
    activeOperationId.current = operationId;
    const scope = {
      key: scopeKeyRef.current,
      generation: scopeGeneration.current,
      operationId,
    };
    setOperation(nextOperation);
    return scope;
  };

  const finishWorkflow = (scope: WorkflowScope) => {
    if (activeOperationId.current !== scope.operationId) return;
    activeOperationId.current = null;
    if (baseScopeIsCurrent(scope)) setOperation("idle");
  };

  useLayoutEffect(() => {
    return () => {
      scopeGeneration.current += 1;
      metadataSequence.current += 1;
      metadataInFlight.current = false;
      activeOperationId.current = null;
    };
  }, []);

  const loadReceipts = useCallback(async (
    preserveMessage?: string,
    workflow?: WorkflowScope,
  ): Promise<OrderStationAttachmentReceipt[] | null> => {
    if (!selectedItemId) return [];
    if (metadataInFlight.current) return null;
    metadataInFlight.current = true;
    const requestScope = {
      key: scopeKeyRef.current,
      generation: scopeGeneration.current,
    };
    const sequence = ++metadataSequence.current;
    setPanelState("loading");
    setServerCanOperate(false);
    try {
      const result = await getGalvanikHandoffAttachmentsAction({ orderId, itemId: selectedItemId });
      if (
        sequence !== metadataSequence.current
        || !baseScopeIsCurrent(requestScope)
        || (workflow && !workflowIsCurrent(workflow))
      ) return null;
      if (result.code !== "OK") {
        setReceipts([]);
        setDownload(null);
        setCurrentActorId(null);
        setMessage(preserveMessage ?? result.message);
        setPanelState("unavailable");
        setLoadedScopeKey(requestScope.key);
        return null;
      }
      if (result.data.receipts.some((receipt) =>
        receipt.orderId !== orderId || receipt.itemId !== selectedItemId)) {
        setReceipts([]);
        setServerCanOperate(false);
        setDownload(null);
        setCurrentActorId(null);
        setMessage(preserveMessage ?? "Metadaten waren nicht exakt an Auftrag und Teil gebunden.");
        setPanelState("unavailable");
        setLoadedScopeKey(requestScope.key);
        return null;
      }
      setReceipts(result.data.receipts);
      setServerCanOperate(result.data.canOperate);
      if (!result.data.canOperate) setDownload(null);
      setCurrentActorId(result.data.currentActorId);
      setMessage(preserveMessage ?? "");
      setPanelState("ready");
      setLoadedScopeKey(requestScope.key);
      return result.data.receipts;
    } catch {
      if (
        sequence !== metadataSequence.current
        || !baseScopeIsCurrent(requestScope)
        || (workflow && !workflowIsCurrent(workflow))
      ) return null;
      setReceipts([]);
      setServerCanOperate(false);
      setDownload(null);
      setCurrentActorId(null);
      setMessage(preserveMessage ?? "Übergabebelege sind derzeit nicht verfügbar.");
      setPanelState("unavailable");
      setLoadedScopeKey(requestScope.key);
      return null;
    } finally {
      if (sequence === metadataSequence.current) metadataInFlight.current = false;
    }
  }, [
    baseScopeIsCurrent,
    orderId,
    selectedItemId,
    setCurrentActorId,
    setDownload,
    setLoadedScopeKey,
    setMessage,
    setPanelState,
    setReceipts,
    setServerCanOperate,
    workflowIsCurrent,
  ]);

  useEffect(() => {
    if (!selectedItemId || renderedScopeKey !== scopeKeyRef.current) return;
    void loadReceipts();
    return () => { metadataSequence.current += 1; };
  }, [loadReceipts, renderedScopeKey, selectedItemId]);

  useEffect(() => {
    if (!download) return;
    const url = download.url;
    const remaining = Math.max(0, download.expiresAt - Date.now());
    const timeout = window.setTimeout(() => {
      setDownload((current) => current?.url === url ? null : current);
      setMessage((current) => current === "Privater Download ist kurzzeitig verfügbar."
        ? "Private Downloadfreigabe ist abgelaufen."
        : current);
    }, remaining);
    return () => window.clearTimeout(timeout);
  }, [download]);

  const refreshAfterFailure = async (scope: WorkflowScope, failureMessage: string): Promise<void> => {
    if (!workflowIsCurrent(scope)) return;
    await loadReceipts(failureMessage, scope);
  };

  const confirmFreshReceipt = async (
    expected: OrderStationAttachmentReceipt,
    scope: WorkflowScope,
  ): Promise<boolean> => {
    if (
      !workflowIsCurrent(scope)
      || expected.orderId !== orderId
      || expected.itemId !== selectedItemId
      || expected.orderVersion !== expectedVersion
    ) return false;
    setOperation("readback");
    const sequence = ++metadataSequence.current;
    const result = await getGalvanikHandoffAttachmentsAction({ orderId, itemId: selectedItemId });
    if (!workflowIsCurrent(scope) || sequence !== metadataSequence.current) return false;
    if (
      result.code !== "OK"
      || result.data.currentActorId !== expected.actorId
      || result.data.receipts.some((receipt) =>
        receipt.orderId !== orderId || receipt.itemId !== selectedItemId)
    ) return false;
    const fresh = result.data.receipts.find((receipt) => receipt.reservationId === expected.reservationId);
    if (
      !fresh
      || fresh.state !== "FINALIZED"
      || !UUID_PATTERN.test(fresh.receiptId ?? "")
      || fresh.verifiedAt === null
      || !sameReceipt(fresh, expected)
    ) return false;
    setReceipts(result.data.receipts);
    setServerCanOperate(result.data.canOperate);
    if (!result.data.canOperate) setDownload(null);
    setCurrentActorId(result.data.currentActorId);
    setPanelState("ready");
    setLoadedScopeKey(scope.key);
    return true;
  };

  const attemptFinalize = async (
    source: OrderStationAttachmentReceipt,
    actorId: string,
    intent: FileIntent,
    scope: WorkflowScope,
  ): Promise<FinalizeOutcome> => {
    if (
      !workflowIsCurrent(scope)
      || !intentMatchesReceipt(source, actorId, orderId, selectedItemId, expectedVersion, intent)
    ) return "STALE";
    setOperation("finalizing");
    const finalized = await finalizeGalvanikHandoffAttachmentAction({ reservationId: source.reservationId });
    if (!workflowIsCurrent(scope)) return "STALE";
    if (finalized.code !== "OK") {
      if (finalized.code === "CONFLICT" && RESTART_REASONS.has(finalized.reason)) {
        const reason = finalized.reason as RestartSelection["reason"];
        setRestartSelection({
          reservationId: source.reservationId,
          intentKey: fileIntentKey(intent),
          reason,
        });
        await refreshAfterFailure(scope, restartMessage(reason));
        return "STOP";
      }
      await refreshAfterFailure(scope, finalized.message);
      return finalized.code === "CONFLICT" && finalized.reason === "UPLOAD_NOT_READY"
        ? "NOT_READY"
        : "STOP";
    }
    if (!finalizedReceiptMatchesSource(finalized.data.receipt, source, actorId)) {
      await refreshAfterFailure(scope, "Bestätigung war nicht exakt an die Reservierung gebunden. Kein Erfolg wurde angezeigt.");
      return "STOP";
    }
    if (!(await confirmFreshReceipt(finalized.data.receipt, scope))) {
      await refreshAfterFailure(scope, "Metadaten-Bestätigung ist fehlgeschlagen. Kein Erfolg wurde angezeigt.");
      return workflowIsCurrent(scope) ? "STOP" : "STALE";
    }
    if (!workflowIsCurrent(scope)) return "STALE";
    setRestartSelection((current) => current?.reservationId === source.reservationId ? null : current);
    setMessage("Original sicher gespeichert und separat aus der Datenbank bestätigt.");
    return "SUCCESS";
  };

  const reserveUploadFinalize = async (
    bytes: Uint8Array,
    intent: FileIntent,
    clientRequestId: string,
    actorId: string,
    scope: WorkflowScope,
    replayReservationId?: string,
  ): Promise<void> => {
    if (!workflowIsCurrent(scope)) return;
    setOperation("reserving");
    const reserved = await reserveGalvanikHandoffAttachmentAction({
      orderId,
      itemId: selectedItemId,
      expectedVersion,
      clientRequestId,
      ...intent,
    });
    if (!workflowIsCurrent(scope)) return;
    if (reserved.code !== "OK") {
      if (
        reserved.code === "CONFLICT"
        && reserved.reason === "UPLOAD_GRANT_EXPIRED"
        && replayReservationId
      ) {
        const restart: RestartSelection = {
          reservationId: replayReservationId,
          intentKey: fileIntentKey(intent),
          reason: "UPLOAD_GRANT_EXPIRED",
        };
        setRestartSelection(restart);
        await refreshAfterFailure(scope, restartMessage(restart.reason));
        return;
      }
      await refreshAfterFailure(scope, reserved.message);
      return;
    }

    const reservationReceipt = reserved.data.receipt;
    if (!submittedIntentMatchesReceipt(
      reservationReceipt,
      actorId,
      orderId,
      selectedItemId,
      expectedVersion,
      clientRequestId,
      intent,
    ) || (replayReservationId !== undefined && reservationReceipt.reservationId !== replayReservationId)) {
      await refreshAfterFailure(scope, "Reservierungsantwort war nicht exakt gebunden. Kein Upload wurde gestartet.");
      return;
    }

    if (reservationReceipt.state === "FINALIZED") {
      if (reserved.data.upload !== null || !(await confirmFreshReceipt(reservationReceipt, scope))) {
        await refreshAfterFailure(scope, "Finalisierter Beleg konnte nicht exakt bestätigt werden.");
        return;
      }
      if (!workflowIsCurrent(scope)) return;
      setMessage("Original war bereits sicher gespeichert und wurde erneut bestätigt.");
      return;
    }

    const grant = reserved.data.upload;
    const exactPath = expectedObjectPath(reservationReceipt.reservationId, intent.mimeType);
    if (
      !grant
      || grant.path !== exactPath
      || !PATH_PATTERN.test(grant.path)
      || grant.token !== grant.token.trim()
      || grant.token.length === 0
    ) {
      await refreshAfterFailure(scope, "Uploadfreigabe war nicht exakt gebunden. Kein Upload wurde gestartet.");
      return;
    }

    setOperation("uploading");
    const uploaded = await supabase.storage.from(BUCKET_ID).uploadToSignedUrl(
      grant.path,
      grant.token,
      bytes,
      { contentType: intent.mimeType, upsert: false },
    );
    if (!workflowIsCurrent(scope)) return;
    if (uploaded.error || uploaded.data?.path !== grant.path) {
      await refreshAfterFailure(scope, "Upload konnte nicht sicher abgeschlossen werden.");
      return;
    }

    setOperation("finalizing");
    const finalized = await finalizeGalvanikHandoffAttachmentAction({
      reservationId: reservationReceipt.reservationId,
    });
    if (!workflowIsCurrent(scope)) return;
    if (finalized.code !== "OK") {
      if (finalized.code === "CONFLICT" && RESTART_REASONS.has(finalized.reason)) {
        const reason = finalized.reason as RestartSelection["reason"];
        setRestartSelection({
          reservationId: reservationReceipt.reservationId,
          intentKey: fileIntentKey(intent),
          reason,
        });
        await refreshAfterFailure(scope, restartMessage(reason));
        return;
      }
      await refreshAfterFailure(scope, finalized.message);
      return;
    }
    if (!finalizedReceiptMatchesSource(finalized.data.receipt, reservationReceipt, actorId)) {
      await refreshAfterFailure(scope, "Bestätigungsantwort war nicht exakt gebunden. Kein Erfolg wurde angezeigt.");
      return;
    }
    if (!(await confirmFreshReceipt(finalized.data.receipt, scope))) {
      await refreshAfterFailure(scope, "Metadaten-Bestätigung ist fehlgeschlagen. Kein Erfolg wurde angezeigt.");
      return;
    }
    if (!workflowIsCurrent(scope)) return;
    setMessage("Original sicher gespeichert und separat aus der Datenbank bestätigt.");
  };

  const handleFile = async (file: File) => {
    if (!canUpload || !currentActorId) return;
    const actorId = currentActorId;
    const scope = beginWorkflow("hashing");
    if (!scope) return;
    setMessage("");
    setDownload(null);
    try {
      if (!ACCEPTED_MIME.has(file.type as OrderStationAttachmentMime) || file.size < 1 || file.size > MAX_FILE_BYTES) {
        setMessage("Nur JPG, PNG oder WebP bis 12 MiB sind erlaubt.");
        return;
      }
      const analyzed = await readAndHash(file);
      if (analyzed.bytes.byteLength !== file.size) {
        setMessage("Datei konnte nicht bytegenau gelesen werden.");
        return;
      }
      const intent: FileIntent = {
        mimeType: file.type as OrderStationAttachmentMime,
        fileBytes: file.size,
        contentSha256: analyzed.contentSha256,
      };
      if (!workflowIsCurrent(scope)) return;
      const candidates = receipts.filter((receipt) =>
        intentMatchesReceipt(receipt, actorId, orderId, selectedItemId, expectedVersion, intent));
      const pending = newestPending(candidates);
      const restartMatches = pending !== null
        && restartSelection?.reservationId === pending.reservationId
        && restartSelection.intentKey === fileIntentKey(intent);

      if (
        pending
        && (!restartMatches || restartSelection?.reason === "UPLOAD_GRANT_EXPIRED")
      ) {
        const outcome = await attemptFinalize(pending, actorId, intent, scope);
        if (!workflowIsCurrent(scope) || outcome !== "NOT_READY") return;
        if (restartMatches) {
          setRestartSelection(null);
          await reserveUploadFinalize(
            analyzed.bytes,
            intent,
            crypto.randomUUID().toLowerCase(),
            actorId,
            scope,
          );
          return;
        }
        await reserveUploadFinalize(
          analyzed.bytes,
          intent,
          pending.clientRequestId,
          actorId,
          scope,
          pending.reservationId,
        );
        return;
      }

      if (restartMatches) setRestartSelection(null);
      await reserveUploadFinalize(
        analyzed.bytes,
        intent,
        crypto.randomUUID().toLowerCase(),
        actorId,
        scope,
      );
    } catch {
      await refreshAfterFailure(scope, "Uploadablauf ist derzeit nicht verfügbar. Kein Erfolg wurde angezeigt.");
    } finally {
      finishWorkflow(scope);
    }
  };

  const finalizeAndConfirm = async (receipt: OrderStationAttachmentReceipt) => {
    if (
      busy
      || panelState !== "ready"
      || !serverCanOperate
      || !currentActorId
      || receipt.actorId !== currentActorId
      || receipt.state !== "PENDING"
      || receipt.orderId !== orderId
      || receipt.itemId !== selectedItemId
      || receipt.orderVersion !== expectedVersion
    ) return;
    const scope = beginWorkflow("finalizing");
    if (!scope) return;
    setMessage("");
    try {
      const intent = {
        mimeType: receipt.mimeType,
        fileBytes: receipt.fileBytes,
        contentSha256: receipt.contentSha256,
      };
      await attemptFinalize(receipt, currentActorId, intent, scope);
    } catch {
      await refreshAfterFailure(scope, "Bestätigung ist derzeit nicht verfügbar. Kein Erfolg wurde angezeigt.");
    } finally {
      finishWorkflow(scope);
    }
  };

  const downloadOriginal = async (receipt: OrderStationAttachmentReceipt) => {
    if (
      busy
      || panelState !== "ready"
      || !serverCanOperate
      || receipt.state !== "FINALIZED"
      || !UUID_PATTERN.test(receipt.receiptId ?? "")
      || receipt.orderId !== orderId
      || receipt.itemId !== selectedItemId
    ) return;
    const scope = beginWorkflow("downloading");
    if (!scope) return;
    setMessage("");
    setDownload(null);
    try {
      const requestStartedAt = nowMs();
      const result = await getGalvanikHandoffAttachmentOriginalAction({ receiptId: receipt.receiptId! });
      if (!workflowIsCurrent(scope)) return;
      if (result.code !== "OK") {
        setMessage(result.message);
        return;
      }
      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!baseUrl) throw new Error("SUPABASE_URL_MISSING");
      const signed = new URL(result.data.downloadUrl);
      const expectedOrigin = new URL(baseUrl).origin;
      const expectedPath = `/storage/v1/object/sign/${BUCKET_ID}/${expectedObjectPath(receipt.reservationId, receipt.mimeType)}`;
      const token = signed.searchParams.get("token");
      const expectedDownload = `galvanik-uebergabe-original.${MIME_EXTENSION[receipt.mimeType]}`;
      if (
        result.data.mimeType !== receipt.mimeType
        || result.data.expiresInSeconds !== ORIGINAL_DOWNLOAD_SECONDS
        || signed.origin !== expectedOrigin
        || signed.username !== ""
        || signed.password !== ""
        || signed.hash !== ""
        || signed.pathname !== expectedPath
        || !token
        || token !== token.trim()
        || signed.searchParams.getAll("token").length !== 1
        || signed.searchParams.get("download") !== expectedDownload
        || signed.searchParams.getAll("download").length !== 1
        || [...signed.searchParams.keys()].some((key) => key !== "token" && key !== "download")
      ) {
        setMessage("Downloadfreigabe war nicht exakt gebunden.");
        return;
      }
      const expiresAt = requestStartedAt + ORIGINAL_DOWNLOAD_SECONDS * 1000;
      if (nowMs() >= expiresAt) {
        setMessage("Private Downloadfreigabe ist abgelaufen.");
        return;
      }
      setDownload({ url: signed.toString(), expiresAt });
      setMessage("Privater Download ist kurzzeitig verfügbar.");
    } catch {
      if (workflowIsCurrent(scope)) setMessage("Originaldownload ist derzeit nicht verfügbar.");
    } finally {
      finishWorkflow(scope);
    }
  };

  const selectItem = (itemId: string) => {
    invalidateScope(itemId);
    setSelectedItemId(itemId);
  };

  return (
    <section
      className="mt-3 rounded-xl border border-border bg-card p-3"
      aria-label="Galvanik-Übergabeoriginal"
      aria-busy={busy || (selectedItemId !== "" && (!scopeReady || panelState === "loading"))}
    >
      <div className="mb-3 flex items-center gap-2">
        <Paperclip className="h-4 w-4" />
        <h4 className="text-sm font-semibold">Übergabeoriginal</h4>
      </div>

      {items.length === 0 ? (
        <div className="flex items-center gap-2 text-xs text-destructive" role="alert">
          <AlertTriangle className="h-4 w-4" />Kein eindeutig zugeordnetes Teil verfügbar. Upload bleibt gesperrt.
        </div>
      ) : items.length > 1 ? (
        <label className="mb-3 block text-xs">
          Teil ausdrücklich auswählen
          <select
            className="mt-1 w-full rounded-md border border-border bg-background p-2"
            value={selectedItemId}
            onChange={(event) => selectItem(event.target.value)}
            disabled={busy}
          >
            <option value="">Bitte Teil auswählen</option>
            {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      ) : null}

      {selectedItemId && (!scopeReady || panelState === "loading") ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" />Metadaten werden geladen…
        </div>
      ) : panelState === "unavailable" ? (
        <div className="text-xs text-destructive" role="alert">
          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{message}</span>
          {selectedItemId && (
            <button
              className="mt-2 rounded-md border border-border px-2 py-1"
              type="button"
              disabled={busy}
              onClick={() => void loadReceipts()}
            >
              Metadaten erneut laden
            </button>
          )}
        </div>
      ) : selectedItemId && receipts.length === 0 ? (
        <p className="text-xs text-muted-foreground">Noch kein Übergabeoriginal erfasst.</p>
      ) : (
        <ul className="space-y-2">
          {receipts.map((receipt) => {
            const restartRequired = restartSelection?.reservationId === receipt.reservationId;
            const ownedByCurrentActor = receipt.actorId === currentActorId;
            const currentPending = receipt.state === "PENDING"
              && ownedByCurrentActor
              && receipt.orderId === orderId
              && receipt.itemId === selectedItemId
              && receipt.orderVersion === expectedVersion;
            return (
              <li key={receipt.reservationId} className="rounded-lg border border-border p-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1 font-medium">
                    {receipt.state === "FINALIZED"
                      ? <ShieldCheck className="h-4 w-4" />
                      : <Upload className="h-4 w-4" />}
                    {receipt.state === "FINALIZED"
                      ? "Bestätigt"
                      : restartRequired
                        ? restartSelection?.reason === "UPLOAD_GRANT_EXPIRED"
                          ? "Erneute Prüfung erforderlich"
                          : "Neue Reservierung erforderlich"
                        : "Upload ausstehend"}
                  </span>
                  <span>{receipt.mimeType} · {receipt.fileBytes.toLocaleString("de-DE")} Byte</span>
                </div>
                <p className="mt-1 text-muted-foreground">
                  Reserviert: {formatTimestamp(receipt.reservedAt)} · Uploadfrist: {formatTimestamp(receipt.uploadExpiresAt)}
                </p>
                {restartRequired && restartSelection?.reason === "UPLOAD_GRANT_EXPIRED" && (
                  <p className="mt-1 text-destructive">
                    Bei erneuter Auswahl wird zuerst das alte Objekt geprüft; fehlt es weiter, folgt bewusst eine neue Reservierung und Uploadfreigabe.
                  </p>
                )}
                {restartRequired && restartSelection?.reason !== "UPLOAD_GRANT_EXPIRED" && (
                  <p className="mt-1 text-destructive">
                    Immutable Reservierung nicht wiederverwendbar; keine Adoption oder Überschreibung.
                  </p>
                )}
                {receipt.state === "PENDING" && !ownedByCurrentActor && (
                  <p className="mt-1 text-muted-foreground">Metadaten eines anderen Bearbeiters; keine Bedienrechte.</p>
                )}
                {receipt.state === "PENDING" && ownedByCurrentActor && !currentPending && (
                  <p className="mt-1 text-muted-foreground">Eigene historische Reservierung; aktueller Auftragsstand weicht ab.</p>
                )}
                {scopeReady && panelState === "ready" && serverCanOperate && currentPending && (
                  <button
                    className="mt-2 rounded-md border border-border px-2 py-1"
                    type="button"
                    disabled={busy}
                    onClick={() => void finalizeAndConfirm(receipt)}
                  >
                    Bestätigung prüfen
                  </button>
                )}
                {scopeReady
                  && panelState === "ready"
                  && serverCanOperate
                  && receipt.state === "FINALIZED"
                  && receipt.orderId === orderId
                  && receipt.itemId === selectedItemId
                  && receipt.receiptId && (
                  <button
                    className="mt-2 flex items-center gap-1 rounded-md border border-border px-2 py-1"
                    type="button"
                    disabled={busy}
                    onClick={() => void downloadOriginal(receipt)}
                  >
                    <Download className="h-3 w-3" /> Original freigeben
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {selectedItem && scopeReady && panelState === "ready" && serverCanOperate && (
        <label className={`mt-3 flex items-center justify-center gap-2 rounded-md border border-dashed border-border p-2 text-xs ${canUpload ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {restartSelection?.reason === "UPLOAD_GRANT_EXPIRED"
            ? "Datei erneut wählen: altes Objekt prüfen, bei Bedarf neu hochladen"
            : restartSelection
              ? "Datei erneut wählen und bewusst neu reservieren"
            : `Neues Original für ${selectedItem.name}`}
          <input
            ref={fileInput}
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={!canUpload}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void handleFile(file);
            }}
          />
        </label>
      )}

      {scopeReady && panelState === "ready" && serverCanOperate && download && (
        <a
          className="mt-3 inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs"
          href={download.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Download className="h-3 w-3" /> Privates Original jetzt öffnen
        </a>
      )}
      <div className="mt-2 min-h-4 text-xs" role="status" aria-live="polite">
        {scopeReady ? operationLabel(operation) || (panelState !== "unavailable" ? message : "") : ""}
      </div>
    </section>
  );
}
