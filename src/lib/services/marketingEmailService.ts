import { Order } from "@/lib/repositories/ordersRepository";

export interface ScheduledEmail {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  scheduledFor: string;
  status: "pending" | "sent" | "cancelled";
  type: "review_request";
}

const RETIRED_MESSAGE =
  "Dieser alte Marketing-Maildienst ist stillgelegt. Folge-E-Mails müssen über den serverseitigen E-Mail- und Feedback-Ledger geplant werden.";

function retiredService(): never {
  throw new Error(RETIRED_MESSAGE);
}

/**
 * Kept as an explicit fail-closed compatibility seam for currently unused imports.
 * It must not claim persistence until it is connected to the durable delivery ledger.
 */
export const marketingEmailService = {
  /**
   * Schedules a follow-up email asking for reviews and photos.
   * Default delay is 14 days.
   */
  async scheduleFollowUpEmail(order: Order, customerName: string, delayDays: number = 14): Promise<ScheduledEmail> {
    void order;
    void customerName;
    void delayDays;
    return retiredService();
  },

  /**
   * Gets all scheduled emails (demo).
   */
  async getScheduledEmails(): Promise<ScheduledEmail[]> {
    return retiredService();
  },

  /**
   * Cancels a scheduled email.
   */
  async cancelScheduledEmail(id: string): Promise<void> {
    void id;
    retiredService();
  }
};
