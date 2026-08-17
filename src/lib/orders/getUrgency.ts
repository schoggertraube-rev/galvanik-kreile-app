export type Urgency = "kritisch" | "gefaehrdet" | "im_plan" | "unknown";

export function getUrgency(dueDate: Date | string | null | undefined, now = new Date()): Urgency {
  if (dueDate === null || dueDate === undefined || (typeof dueDate === "string" && !dueDate.trim())) return "unknown";

  const due = new Date(dueDate);
  if (isNaN(due.getTime())) return "unknown";

  // Normalize 'now' to start of day for comparison
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);

  if (dueDay < today) {
    return "kritisch";
  } else if (dueDay <= tomorrow) {
    return "gefaehrdet";
  } else {
    return "im_plan";
  }
}
