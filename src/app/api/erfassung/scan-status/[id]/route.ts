import { NextResponse } from "next/server";
import { db } from "@/db";
import { scanUploads } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const record = await db.select().from(scanUploads).where(eq(scanUploads.id, id)).limit(1);

    if (!record || record.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(record[0]);
  } catch (error) {
    console.error("Scan status error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
