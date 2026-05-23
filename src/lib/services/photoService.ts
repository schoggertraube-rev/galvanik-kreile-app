import { eventsRepository } from "../repositories/eventsRepository";

export const photoService = {
  async savePhotoForOrder(orderId: string, _photoDataUrl: string) {
    // Fake logic for saving photo in object storage
    console.log(`📸 Photo virtuell gespeichert für Order ${orderId} (Länge: ${_photoDataUrl.length})`);
    await eventsRepository.addEvent({ eventType: "PHOTO_CAPTURED", orderId });
    return "photo-mock-id";
  }
};
