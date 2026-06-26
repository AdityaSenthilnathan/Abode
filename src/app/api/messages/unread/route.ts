import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { unreadMessageCount } from "@/server/services/messaging";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ count: 0 });
  try {
    return NextResponse.json({ count: await unreadMessageCount(user.id) });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
