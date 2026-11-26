// Shared by the page bundle and the existing classic service worker.
(() => {
  const storeName = "originals";
  const databaseVersion = 3;
  const databasePrefix = "kreile-pending-originals-v1-";
  const scopePattern = /^[a-f0-9]{64}$/;
  const keyPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
  const originalKeys = new Set([
    "id", "itemId", "kind", "command", "input", "deviceCapturedAt", "queueSequence", "notBefore", "dispatchStartedAt",
  ]);
  const mailKeys = new Set([
    "targetType", "targetId", "clientEventId", "subject", "body", "attachment",
    "expectedInvoiceIds", "singleInvoice", "confirmedResend", "collectionReminder",
  ]);

  const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const instant = value => typeof value === "string" && Number.isFinite(Date.parse(value));
  const key = value => typeof value === "string" && keyPattern.test(value);

  function isMailOriginal(row) {
    if (!record(row) || row.kind !== "workshop" || row.command !== "mail.send"
      || !Object.keys(row).every(name => originalKeys.has(name)) || !record(row.input)
      || !instant(row.deviceCapturedAt) || !instant(row.notBefore)
      || Date.parse(row.notBefore) <= Date.parse(row.deviceCapturedAt)
      || row.dispatchStartedAt !== undefined && !instant(row.dispatchStartedAt)
      || row.queueSequence !== undefined && (!Number.isSafeInteger(row.queueSequence) || row.queueSequence < 1)) return false;

    const input = row.input;
    return (input.targetType === "CUSTOMER" || input.targetType === "ORDER")
      && typeof input.targetId === "string" && input.targetId.length > 0 && input.targetId.length <= 128
      && row.itemId === input.targetId && key(input.clientEventId) && row.id === input.clientEventId
      && typeof input.subject === "string" && typeof input.body === "string"
      && Object.keys(input).every(name => mailKeys.has(name));
  }

  function isMailAcknowledgement(scope, original, result) {
    if (!isMailOriginal(original) || !record(result) || result.code !== "OK"
      || result.mailCommand !== original.command || !record(result.mailReceipt)
      || !record(result.offlineReceipt) || !record(result.data)) return false;

    const mail = result.mailReceipt;
    const receipt = result.offlineReceipt;
    return receipt.scope === scope && receipt.clientEventId === original.id
      && receipt.deviceCapturedAt === original.deviceCapturedAt && key(receipt.eventId) && key(receipt.actorId)
      && mail.clientRequestId === original.id && mail.eventId === receipt.eventId && mail.actorId === receipt.actorId
      && key(mail.threadId) && key(mail.messageId)
      && mail.threadId === result.data.threadId && mail.messageId === result.data.messageId;
  }

  function changeOriginal(database, id, fallback, errorCode, change) {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      const request = store.get(id);
      let result = fallback;
      request.onsuccess = () => { result = change(request.result, store); };
      transaction.oncomplete = () => { database.close(); resolve(result); };
      transaction.onabort = () => { database.close(); reject(Error(errorCode)); };
    });
  }

  function claimOrWithdraw(database, id, mode, flush, isOriginal) {
    return changeOriginal(database, id, mode === "claim" ? null : false, "OFFLINE_WORKSHOP_QUEUE_ABORTED", (row, store) => {
      if (!isOriginal(row) || row.rejection) return mode === "claim" ? null : false;
      const now = new Date();
      const due = row.notBefore === undefined || Date.parse(row.notBefore) <= now.getTime();
      if (mode === "withdraw") {
        if (row.notBefore === undefined || row.dispatchStartedAt !== undefined || due) return false;
        store.delete(id);
        return true;
      }
      if (!flush && !due && row.dispatchStartedAt === undefined) return null;
      if (row.notBefore === undefined || row.dispatchStartedAt !== undefined) return row;
      const claimed = { ...row, dispatchStartedAt: now.toISOString() };
      store.put(claimed);
      return claimed;
    });
  }

  function acknowledgeMail(database, original) {
    return changeOriginal(database, original.id, false, "OFFLINE_WORKSHOP_ACK_ABORTED", (row, store) => {
      // Both inputs come from the same immutable stored original, through its reservation.
      if (!isMailOriginal(row) || row.deviceCapturedAt !== original.deviceCapturedAt
        || JSON.stringify(row.input) !== JSON.stringify(original.input)) return false;
      store.delete(original.id);
      return true;
    });
  }

  function openExisting(scope) {
    if (typeof scope !== "string" || !scopePattern.test(scope)) throw Error("INTAKE_PENDING_SCOPE_REQUIRED");
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(databasePrefix + scope, databaseVersion);
      request.onupgradeneeded = () => request.transaction.abort();
      request.onerror = () => reject(Error("INTAKE_PENDING_STORAGE_UNAVAILABLE"));
      request.onblocked = () => {
        request.onsuccess = () => request.result.close();
        reject(Error("INTAKE_PENDING_STORAGE_BLOCKED"));
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
    });
  }

  function requestReplay(scope, original, keepalive) {
    return fetch("/api/offline/replay", {
      method: "POST", credentials: "same-origin", cache: "no-store", keepalive,
      headers: { "content-type": "application/json" }, body: JSON.stringify({ scope, original }),
    });
  }

  globalThis.KreileOfflineQueue = Object.freeze({
    storeName, databaseVersion, databasePrefix, isMailOriginal, isMailAcknowledgement,
    claimOrWithdraw, acknowledgeMail, openExisting, requestReplay,
  });
})();
