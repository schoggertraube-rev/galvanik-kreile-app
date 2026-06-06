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

/**
 * Service to handle marketing-related email workflows.
 * In a real production scenario, this would persist to a database table
 * and a cron job (e.g. Vercel Cron) would pick up pending emails.
 */
export const marketingEmailService = {
  /**
   * Schedules a follow-up email asking for reviews and photos.
   * Default delay is 14 days.
   */
  async scheduleFollowUpEmail(order: Order, customerName: string, delayDays: number = 14): Promise<ScheduledEmail> {
    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + delayDays);

    const emailRecord: ScheduledEmail = {
      id: `scheduled-${Date.now()}`,
      orderId: order.id,
      customerId: order.customerId,
      customerName,
      scheduledFor: scheduledDate.toISOString(),
      status: "pending",
      type: "review_request"
    };

    // Save to local storage for demo purposes
    if (typeof window !== "undefined") {
      const existingStr = localStorage.getItem("kreile_scheduled_emails");
      const existing: ScheduledEmail[] = existingStr ? JSON.parse(existingStr) : [];
      existing.push(emailRecord);
      localStorage.setItem("kreile_scheduled_emails", JSON.stringify(existing));
      window.dispatchEvent(new Event("storage"));
    }

    console.log(`[Marketing Service] Follow-Up email scheduled for order ${order.orderNumber} on ${scheduledDate.toLocaleDateString()}`);

    return emailRecord;
  },

  /**
   * Gets all scheduled emails (demo).
   */
  async getScheduledEmails(): Promise<ScheduledEmail[]> {
    if (typeof window !== "undefined") {
      const existingStr = localStorage.getItem("kreile_scheduled_emails");
      if (existingStr) {
        return JSON.parse(existingStr);
      }
    }
    return [];
  },

  /**
   * Cancels a scheduled email.
   */
  async cancelScheduledEmail(id: string): Promise<void> {
    if (typeof window !== "undefined") {
      const existingStr = localStorage.getItem("kreile_scheduled_emails");
      if (existingStr) {
        const existing: ScheduledEmail[] = JSON.parse(existingStr);
        const updated = existing.map(e => e.id === id ? { ...e, status: "cancelled" as const } : e);
        localStorage.setItem("kreile_scheduled_emails", JSON.stringify(updated));
        window.dispatchEvent(new Event("storage"));
      }
    }
  }
};
