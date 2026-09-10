import Link from "next/link";
import { ClipboardList, PackageCheck, Users } from "lucide-react";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import { getOperationalOrders } from "@/lib/server/operationalOrders";
import type { OperationalOrder } from "@/lib/types/operationalOrder";

function dueTime(order: OperationalOrder) {
  const value = order.dueDate ? new Date(order.dueDate).getTime() : Number.POSITIVE_INFINITY;
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

export async function RolfHome({ authorization }: { authorization: AuthorizationSnapshot }) {
  let orders: OperationalOrder[] | null = null;
  try {
    orders = await getOperationalOrders(authorization);
  } catch {
    orders = null;
  }

  const priority = orders ? [...orders].sort((a, b) => dueTime(a) - dueTime(b)).slice(0, 4) : [];
  return (
    <section className="target-home" aria-labelledby="rolf-home-title">
      <header className="target-home__intro">
        <div>
          <p className="target-kicker">Der Tag</p>
          <h1 id="rolf-home-title">Guten Tag, {authorization.displayName}</h1>
          <p>Offene Arbeit aus dem tenantgebundenen Auftragsbestand.</p>
        </div>
        <Link className="target-primary-action" href="/orders">Aufträge öffnen</Link>
      </header>

      {orders === null ? (
        <div className="target-state target-state--error" role="alert">
          <strong>Tagesansicht nicht verfügbar</strong>
          <span>Es werden keine veralteten oder unvollständigen Daten angezeigt.</span>
        </div>
      ) : priority.length === 0 ? (
        <div className="target-state">
          <strong>Heute liegt kein offener Auftrag vor.</strong>
          <span>Neue Arbeit beginnt im digitalen Wareneingang.</span>
          {authorization.role !== "readonly" && <Link href="/warendurchlauf/wareneingang">Neuen Eingang erfassen</Link>}
        </div>
      ) : (
        <div className="target-day-grid">
          <div className="target-priority-list">
            <div className="target-section-heading">
              <h2>Jetzt wichtig</h2><span>{orders.length} offene Aufträge</span>
            </div>
            {priority.map((order) => (
              <Link key={order.id} href={`/orders/${encodeURIComponent(order.id)}`} className="target-priority-card">
                <span className="target-priority-card__number">{order.orderNumber}</span>
                <strong>{order.customerName ?? "Kunde nicht hinterlegt"}</strong>
                <span>{order.task || "Leistung nicht benannt"}</span>
                <span className="target-priority-card__meta">{order.station} · {order.dueLabel}: {order.dueValue}</span>
              </Link>
            ))}
          </div>
          <aside className="target-quick-grid" aria-label="Kernbereiche">
            <Link href="/warendurchlauf"><PackageCheck />Werkstatt</Link>
            <Link href="/orders"><ClipboardList />Aufträge</Link>
            <Link href="/customers"><Users />Kunden &amp; Kontakt</Link>
          </aside>
        </div>
      )}
    </section>
  );
}
