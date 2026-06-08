import "server-only";
import { randomUUID } from "node:crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config, requireEnv } from "@/server/config";

// v3 generates a regional virtual-hosted URL → avoids the global-endpoint 307/CORS trap.
const s3 = new S3Client({ region: config.aws.region });

export function buildKey(prefix: string, filename: string): string {
  const ext = filename.includes(".")
    ? filename.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5)
    : "bin";
  return `${prefix}/${randomUUID()}.${ext || "bin"}`;
}

/** Presigned PUT for a direct browser upload (5-min expiry). */
export function presignUpload(key: string, contentType: string): Promise<string> {
  return getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: requireEnv("S3_MEDIA_BUCKET"), Key: key, ContentType: contentType }),
    { expiresIn: 300 },
  );
}

/** Presigned GET to view a private object (1-hour expiry). */
export function presignView(key: string): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: requireEnv("S3_MEDIA_BUCKET"), Key: key }), {
    expiresIn: 3600,
  });
}
