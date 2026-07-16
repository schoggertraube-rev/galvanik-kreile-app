import { getOperationalOrders, type OperationalOrder } from "../src/lib/server/operationalOrders";

function classify(order: OperationalOrder): string {
  const title = (order.title || "").toLowerCase();
  const customer = (order.customerName || "").toLowerCase();
  const number = (order.orderNumber || "").toLowerCase();
  if (title.includes('seed') || customer.includes('seed') || number.includes('seed')) return 'seed';
  if (title.includes('test') || customer.includes('test') || number.includes('test')) return 'test';
  if (title.includes('integration') || customer.includes('integration') || number.includes('integration')) return 'integration-test';
  return 'unklar';
}

(async () => {
  const orders = await getOperationalOrders(process.env.TENANT_ID ?? "galvanik-kreile");
  const enriched = orders.map(o => ({
    id: o.id,
    orderNumber: o.orderNumber,
    title: o.title,
    customerName: o.customerName,
    source: o.source,
    createdAt: o.createdAt,
    currentStationId: o.currentStationId,
    status: o.status,
    classification: classify(o)
  }));
  console.log(JSON.stringify({orders: enriched}, null, 2));
})();
