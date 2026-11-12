/** Network observation only. SyncContext owns the sole scoped original queue. */
export const OfflineManager = {
  isOffline(): boolean {
    return typeof navigator !== "undefined" && !navigator.onLine;
  },
};
