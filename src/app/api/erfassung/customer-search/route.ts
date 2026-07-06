import { NextResponse } from "next/server";
import { db } from "@/db";
import { customers, orders } from "@/db/schema";
import { ilike, or, eq, sql, and } from "drizzle-orm";
import { resolveAuthorization } from "@/lib/server/authorization";

export async function GET(request: Request) {
  const auth = await resolveAuthorization();
  if (!auth.ok) {
    return NextResponse.json(
      { error: "Sitzung abgelaufen oder nicht angemeldet" },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const tenantId = auth.data.tenantId;
    const results = await db
      .select({
        id: customers.id,
        name: customers.name,
        companyName: customers.companyName,
        customerNumber: customers.customerNumber,
        city: customers.city,
        ordersCount: sql<number>`cast(count(${orders.id}) as integer)`,
      })
      .from(customers)
      .leftJoin(
        orders,
        and(eq(orders.customerId, customers.id), eq(orders.tenantId, tenantId)),
      )
      .where(
        and(
          eq(customers.tenantId, tenantId),
          or(
            ilike(customers.name, `%${q}%`),
            ilike(customers.companyName, `%${q}%`),
            ilike(customers.customerNumber, `%${q}%`)
          ),
          sql`coalesce(${customers.source}, '') != 'test'`,
          sql`coalesce(${customers.name}, '') NOT LIKE 'Capture%'`
        )
      )
      .groupBy(customers.id)
      .limit(5);

    return NextResponse.json(results);
  } catch (error) {
    const searchError = error as { message?: string; details?: string; hint?: string };
    console.error("Customer search error:", {
      message: searchError.message,
      details: searchError.details,
      hint: searchError.hint,
    });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
