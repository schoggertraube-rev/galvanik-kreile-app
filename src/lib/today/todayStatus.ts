import { ordersRepository } from "../repositories/ordersRepository";

export async function computeTodayStatus(): Promise<"critical" | "watch" | "ok"> {
  const orders = await ordersRepository.getAll();
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  let hasCritical = false;
  let hasWatch = false;

  for (const o of orders) {
    if (o.status === "completed" || o.status === "shipped") continue;
    if (!o.dueDate) continue;
    
    const due = new Date(o.dueDate);
    if (isNaN(due.getTime())) continue;

    const diffTime = due.getTime() - now.getTime();
    const diffHours = diffTime / (1000 * 60 * 60);

    if (diffHours < 0) {
      hasCritical = true;
    } else if (diffHours < 24) {
      hasWatch = true;
    }
  }

  if (hasCritical) return "critical";
  if (hasWatch) return "watch";
  return "ok";
}
