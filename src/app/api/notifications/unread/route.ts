import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { unreadCount } from "@/server/services/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ count: 0 });
  try {
    return NextResponse.json({ count: await unreadCount(user.id) });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
