import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  (await cookies()).delete("abode_dev_user");
  return NextResponse.redirect(new URL("/login", req.url));
}
