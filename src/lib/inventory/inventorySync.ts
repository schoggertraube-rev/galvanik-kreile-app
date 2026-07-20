export const INVENTORY_SYNC_EVENT = "kreile-sync-inventory";
const INVENTORY_SYNC_CHANNEL = "kreile-inventory-sync";

type InventorySyncMessage = { type: typeof INVENTORY_SYNC_EVENT; sourceId: string | null };

export function publishInventorySync(sourceId: string | null = null): void {
  if (typeof window === "undefined") return;
  if (typeof BroadcastChannel !== "undefined") {
    try {
      const channel = new BroadcastChannel(INVENTORY_SYNC_CHANNEL);
      channel.postMessage({ type: INVENTORY_SYNC_EVENT, sourceId } satisfies InventorySyncMessage);
      channel.close();
      return;
    } catch {
      // Restricted browser profiles fall back to the same-document event.
    }
  }
  window.dispatchEvent(new CustomEvent<InventorySyncMessage>(INVENTORY_SYNC_EVENT, {
    detail: { type: INVENTORY_SYNC_EVENT, sourceId },
  }));
}

export function subscribeInventorySync(listener: () => void, ownSourceId: string | null = null): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onLocal = (event: Event) => {
    const message = (event as CustomEvent<InventorySyncMessage>).detail;
    if (!ownSourceId || message?.sourceId !== ownSourceId) listener();
  };
  window.addEventListener(INVENTORY_SYNC_EVENT, onLocal);
  let channel: BroadcastChannel | null = null;
  try {
    channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(INVENTORY_SYNC_CHANNEL) : null;
  } catch {
    channel = null;
  }
  const onMessage = (event: MessageEvent<unknown>) => {
    const message = event.data as Partial<InventorySyncMessage> | null;
    if (message?.type === INVENTORY_SYNC_EVENT && (!ownSourceId || message.sourceId !== ownSourceId)) {
      listener();
    }
  };
  channel?.addEventListener("message", onMessage);

  return () => {
    window.removeEventListener(INVENTORY_SYNC_EVENT, onLocal);
    channel?.removeEventListener("message", onMessage);
    channel?.close();
  };
}
