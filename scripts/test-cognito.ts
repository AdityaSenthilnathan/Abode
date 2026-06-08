/**
 * Live Cognito + DB round-trip test (standalone — no server-only imports).
 * Proves the pool/client/secret, SECRET_HASH, group assignment, login, and JWT
 * verification all work, then cleans up the temp user.
 *   npx tsx scripts/test-cognito.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createHmac } from "node:crypto";
import { Pool } from "pg";
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminAddUserToGroupCommand,
  AdminDeleteUserCommand,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { CognitoJwtVerifier } from "aws-jwt-verify";

const region = process.env.AWS_REGION ?? "us-west-1";
const poolId = process.env.COGNITO_USER_POOL_ID!;
const clientId = process.env.COGNITO_CLIENT_ID!;
const clientSecret = process.env.COGNITO_CLIENT_SECRET!;
const cog = new CognitoIdentityProviderClient({ region });
const secretHash = (u: string) => createHmac("sha256", clientSecret).update(u + clientId).digest("base64");

async function main() {
  const email = `test-owner-${Date.now()}@abode.dev`;
  const password = "Abode!Test12345";
  let sub = "";

  try {
    const created = await cog.send(
      new AdminCreateUserCommand({
        UserPoolId: poolId,
        Username: email,
        MessageAction: "SUPPRESS",
        UserAttributes: [
          { Name: "email", Value: email },
          { Name: "email_verified", Value: "true" },
          { Name: "name", Value: "Test Owner" },
        ],
      }),
    );
    await cog.send(new AdminSetUserPasswordCommand({ UserPoolId: poolId, Username: email, Password: password, Permanent: true }));
    await cog.send(new AdminAddUserToGroupCommand({ UserPoolId: poolId, Username: email, GroupName: "owner" }));
    sub = created.User?.Attributes?.find((a) => a.Name === "sub")?.Value ?? "";
    console.log("✓ admin-created + grouped:", email, "sub=" + sub.slice(0, 8) + "…");

    const auth = await cog.send(
      new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: clientId,
        AuthParameters: { USERNAME: email, PASSWORD: password, SECRET_HASH: secretHash(email) },
      }),
    );
    const at = auth.AuthenticationResult?.AccessToken;
    if (!at) throw new Error("no access token");
    console.log("✓ login ok (USER_PASSWORD_AUTH + SECRET_HASH)");

    const verifier = CognitoJwtVerifier.create({ userPoolId: poolId, tokenUse: "access", clientId });
    const payload = await verifier.verify(at);
    if (payload.sub !== sub) throw new Error("sub mismatch");
    console.log("✓ JWT verified; groups =", payload["cognito:groups"]);

    const pg = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
    });
    await pg.query("insert into users (cognito_sub, email, role, full_name) values ($1,$2,'owner',$3)", [sub, email, "Test Owner"]);
    const n = (await pg.query("select count(*)::int n from users where cognito_sub=$1", [sub])).rows[0].n;
    console.log("✓ users row created:", n === 1);
    await pg.query("delete from users where cognito_sub=$1", [sub]);
    await pg.end();

    console.log("\n✅ COGNITO + DB AUTH ROUND-TRIP PASSED");
  } finally {
    if (sub) await cog.send(new AdminDeleteUserCommand({ UserPoolId: poolId, Username: email })).catch(() => {});
  }
}

main().catch((e) => {
  console.error("\n❌ TEST FAILED:", e.name, "-", e.message);
  process.exit(1);
});
