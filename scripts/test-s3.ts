/**
 * Live S3 presign round-trip: presign PUT → upload → presign GET → download →
 * verify → delete. Proves the bucket, creds, and presign all work.
 *   npx tsx scripts/test-s3.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const region = process.env.AWS_REGION ?? "us-west-1";
const Bucket = process.env.S3_MEDIA_BUCKET!;
const s3 = new S3Client({ region });

async function main() {
  const Key = `test/${Date.now()}.txt`;
  const putUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket, Key, ContentType: "text/plain" }),
    { expiresIn: 300 },
  );
  const put = await fetch(putUrl, { method: "PUT", headers: { "content-type": "text/plain" }, body: "hello-abode" });
  console.log("presigned PUT →", put.status);
  if (!put.ok) throw new Error(`PUT failed ${put.status}`);

  const getUrl = await getSignedUrl(s3, new GetObjectCommand({ Bucket, Key }), { expiresIn: 300 });
  const got = await fetch(getUrl);
  const text = await got.text();
  console.log("presigned GET →", got.status, JSON.stringify(text));
  if (text !== "hello-abode") throw new Error("body mismatch");

  await s3.send(new DeleteObjectCommand({ Bucket, Key }));
  console.log(`\n✅ S3 PRESIGN ROUND-TRIP PASSED (bucket=${Bucket})`);
}

main().catch((e) => {
  console.error("\n❌ S3 TEST FAILED:", e.message);
  process.exit(1);
});
