export type Urgency = "kritisch" | "gefaehrdet" | "im_plan" | "unbekannt";

export function getUrgency(dueDate: Date | string | null | undefined, now = new Date()): Urgency {
  if (!dueDate) return "unbekannt";

  const due = new Date(dueDate);
  if (isNaN(due.getTime())) return "unbekannt";

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
