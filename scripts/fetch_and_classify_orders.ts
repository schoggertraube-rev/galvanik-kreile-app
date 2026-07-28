import { getOperationalOrders } from "../src/lib/server/operationalOrders";

type OperationalOrder = Awaited<ReturnType<typeof getOperationalOrders>>[number];

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
  const tenantId = process.env.KREILE_TENANT_ID;
  if (!tenantId) {
    throw new Error("KREILE_TENANT_ID is required; this diagnostic script must not choose a tenant implicitly.");
  }
  const orders = await getOperationalOrders(tenantId);
  const enriched = orders.map(o => ({
    id: o.id,
    orderNumber: o.orderNumber,
    title: o.title,
    customerName: o.customerName,
    createdAt: o.createdAt,
    currentStationId: o.currentStationId,
    status: o.status,
    classification: classify(o)
  }));
  console.log(JSON.stringify({orders: enriched}, null, 2));
})();
