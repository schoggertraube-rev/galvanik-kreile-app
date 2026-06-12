import { NextResponse } from "next/server";
import { db } from "@/db";
import { customers, orders } from "@/db/schema";
import { ilike, or, eq, sql, and } from "drizzle-orm";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  try {
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
      .leftJoin(orders, eq(orders.customerId, customers.id))
      .where(
        and(
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
    console.error("Customer search error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
