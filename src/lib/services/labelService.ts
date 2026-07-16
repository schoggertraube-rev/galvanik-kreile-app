import { eventsRepository } from "@/lib/repositories/eventsRepository";

export const labelService = {
  async recordPreparedLabel(orderId: string) {
    return eventsRepository.addEvent({ eventType: "LABEL_PREPARED", orderId });
  },
};
