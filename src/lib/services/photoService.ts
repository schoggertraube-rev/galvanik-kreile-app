import { eventsRepository } from "@/lib/repositories/eventsRepository";

export type StoredItemPhoto = {
  jobId: string;
  storagePath: string;
  previewUrl: string;
};

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const photoService = {
  async savePhotoForItem(itemId: string, orderId: string, photoDataUrl: string): Promise<StoredItemPhoto> {
    const source = await fetch(photoDataUrl);
    const blob = await source.blob();
    if (blob.size < 12 || blob.size > 12 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(blob.type)) {
      throw new Error("Ungültiges oder zu großes Teilefoto.");
    }
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()));
    const extension = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
    const formData = new FormData();
    formData.set("itemId", itemId);
    formData.set("file", new File([blob], `item-photo.${extension}`, { type: blob.type }));

    const response = await fetch("/api/erfassung/item-photo-upload", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "X-Idempotency-Key": `item-photo:${itemId}:${bytesToHex(digest).slice(0, 32)}` },
      body: formData,
    });
    const text = await response.text();
    if (text.length > 262_144) throw new Error("Ungültige Fotoantwort.");
    let body: unknown;
    try { body = JSON.parse(text); }
    catch { throw new Error("Ungültige Fotoantwort."); }
    const result = body as Record<string, unknown>;
    if (!response.ok || typeof result.jobId !== "string" || typeof result.storagePath !== "string" || typeof result.previewUrl !== "string") {
      throw new Error("Teilefoto konnte nicht dauerhaft bestätigt werden.");
    }
    await eventsRepository.addEvent({ orderId, itemId, eventType: "PHOTO_CAPTURED" });
    return { jobId: result.jobId, storagePath: result.storagePath, previewUrl: result.previewUrl };
  },
};
