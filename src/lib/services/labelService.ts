import { eventsRepository } from "../repositories/eventsRepository";

export const labelService = {
  async generateLabel(orderId: string) {
    // Fake logic for label printer
    console.log(`🖨️ Etikett generiert für Order ${orderId}`);
    await eventsRepository.addEvent({ eventType: "LABEL_PREPARED", orderId });
    return "label-mock-url";
  }
};
