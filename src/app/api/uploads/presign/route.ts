import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { buildKey, presignUpload } from "@/server/s3";

const ALLOWED = /^(image\/(jpeg|jpg|png|webp|heic|heif|gif)|video\/(mp4|quicktime|webm|x-m4v))$/i;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const { contentType, filename } = (body ?? {}) as { contentType?: string; filename?: string };
  if (typeof contentType !== "string" || !ALLOWED.test(contentType)) {
    return NextResponse.json({ error: "unsupported file type" }, { status: 400 });
  }

  const key = buildKey(`u/${user.id}`, typeof filename === "string" ? filename : "file");
  const url = await presignUpload(key, contentType);
  return NextResponse.json({ url, key });
}
