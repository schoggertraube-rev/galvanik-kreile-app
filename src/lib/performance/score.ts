import { ordersRepository } from "../repositories/ordersRepository";
import { eventsRepository } from "../repositories/eventsRepository";
import { complaintsRepository } from "../repositories/complaintsRepository";

const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));

export async function calculateWorkshopHealthScore(): Promise<{
  score: number;
  details: {
    onTimeRate: number;
    avgCycleTimeIndex: number;
    criticalOrders: number;
    complaintRate: number;
    reworkRate: number;
  }
}> {
  const [orders, events, complaints] = await Promise.all([
    ordersRepository.getAll(),
    eventsRepository.getAll(),
    complaintsRepository.getAll()
  ]);

  const totalOrders = orders.length || 1;
  const completedOrders = orders.filter(o => o.status === "completed" || o.status === "done" || o.status === "shipped").length;
  
  // Zeit-Metriken
  const greenOrders = orders.filter(o => o.risk === "green").length;
  const rawOnTimeRate = totalOrders > 0 ? greenOrders / totalOrders : 1.0;
  
  const totalDelayParts = orders
    .filter(o => o.risk !== "green")
    .reduce((sum, o) => sum + (o.parts?.length || 0), 0);
  
  const baseDurchlaufzeit = 3.2; 
  const dynamicDurchlaufzeit = baseDurchlaufzeit + (totalDelayParts * 0.15);
  const avgCycleTimeIndex = dynamicDurchlaufzeit / 4.0;
  
  const criticalOrders = orders.filter(o => o.risk === "red" || o.risk === "orange").length;

  // Rekla-Quote aus echtem Repository
  const complaintRate = (completedOrders > 0) ? (complaints.length / completedOrders) : (complaints.length / totalOrders);

  // Nacharbeits-Quote aus Events (REWORK_STARTED)
  const reworkEvents = events.filter(e => e.eventType === "REWORK_STARTED").length;
  const reworkRate = (completedOrders > 0) ? (reworkEvents / completedOrders) : (reworkEvents / totalOrders);

  // Score Berechnung
  const onTime     = clamp(rawOnTimeRate * 100, 0, 100);
  const cycle      = clamp(100 - (avgCycleTimeIndex - 1) * 50, 0, 100); 
  const critical   = clamp(100 - criticalOrders * 15, 0, 100);          
  const complaintsScore = clamp(100 - complaintRate * 100 * 5, 0, 100); // 5x Multiplikator fÃ¼r Reklas
  const reworkScore = clamp(100 - reworkRate * 100 * 3, 0, 100);        // 3x Multiplikator fÃ¼r interne Nacharbeit

  const score = Math.round(
    onTime     * 0.25 +
    cycle      * 0.20 +
    critical   * 0.20 +
    complaintsScore * 0.20 +
    reworkScore * 0.15
  );

  return {
    score: clamp(score, 0, 100),
    details: {
      onTimeRate: rawOnTimeRate,
      avgCycleTimeIndex,
      criticalOrders,
      complaintRate,
      reworkRate
    }
  };
}
