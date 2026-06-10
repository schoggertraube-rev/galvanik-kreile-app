// src/app/api/email/send/route.ts

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) {
    return NextResponse.json({ error: "SUPABASE_URL not configured" }, { status: 500 });
  }
  const res = await fetch(`${supabaseUrl}/functions/v1/email-send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: await req.text(),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
