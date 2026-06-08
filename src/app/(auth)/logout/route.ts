import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const res = NextResponse.redirect(new URL("/login", req.url));
  for (const n of ["abode_at", "abode_rt", "abode_un", "abode_dev_user"]) res.cookies.delete(n);
  return res;
}
