import { describe, expect, it } from "vitest";

import { OfflineSyncNotConfiguredError, syncQueue } from "../idbSync";

describe("offline sync unavailable adapter", () => {
  it("rejects a mutation without persisting or exposing its payload", async () => {
    const sensitivePayload = { customerContact: "must-not-be-stored" };

    await expect(syncQueue.add("order", "order-1", "UPDATE", sensitivePayload))
      .rejects.toBeInstanceOf(OfflineSyncNotConfiguredError);
    await expect(syncQueue.add("order", "order-1", "UPDATE", sensitivePayload))
      .rejects.toThrow(/nicht verarbeitet/);
  });
});
