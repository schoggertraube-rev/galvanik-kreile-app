// Compatibility port: existing originals and IDs stay in the same scoped store.
export {retainPendingOriginal,readPendingOriginals,acknowledgePendingOriginal} from "@/lib/offline/pendingStore";
export type {PendingOriginal} from "@/lib/offline/pendingStore";
