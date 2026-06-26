import { NextResponse } from "next/server";
import { db } from "@/db";
import { scanUploads } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { resolveAuthorization } from "@/lib/server/authorization";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await resolveAuthorization();
    if (!auth.ok) {
      return NextResponse.json({ error: "Sitzung abgelaufen oder nicht angemeldet" }, { status: 401 });
    }

    const { id } = await context.params;
    const record = await db.select()
      .from(scanUploads)
      .where(and(eq(scanUploads.id, id), eq(scanUploads.tenantId, auth.data.tenantId)))
      .limit(1);

    if (!record || record.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(record[0]);
  } catch (error) {
    console.error("Scan status error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
