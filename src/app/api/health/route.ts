import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Liveness probe — used by App Runner health checks in prod. */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "abode",
    time: new Date().toISOString(),
  });
}
