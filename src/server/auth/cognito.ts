import "server-only";
import { createHmac } from "node:crypto";
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminAddUserToGroupCommand,
  InitiateAuthCommand,
  type AuthenticationResultType,
} from "@aws-sdk/client-cognito-identity-provider";
import { config, requireEnv } from "@/server/config";
import type { Role } from "./session";

const client = new CognitoIdentityProviderClient({ region: config.aws.region });

const poolId = () => requireEnv("COGNITO_USER_POOL_ID");
const clientId = () => requireEnv("COGNITO_CLIENT_ID");
const clientSecret = () => requireEnv("COGNITO_CLIENT_SECRET");

/** Cognito confidential-client SECRET_HASH = base64(HMAC-SHA256(username + clientId, clientSecret)). */
function secretHash(username: string): string {
  return createHmac("sha256", clientSecret())
    .update(username + clientId())
    .digest("base64");
}

/**
 * Admin-create a confirmed Cognito user (no email round-trip), set a permanent
 * password, and add them to their role group. Returns the Cognito `sub`.
 * For production you'd switch to self-service SignUp + email verification.
 */
export async function cognitoCreateUser(
  email: string,
  password: string,
  fullName: string | null,
  group: Role,
): Promise<string> {
  const created = await client.send(
    new AdminCreateUserCommand({
      UserPoolId: poolId(),
      Username: email,
      MessageAction: "SUPPRESS",
      UserAttributes: [
        { Name: "email", Value: email },
        { Name: "email_verified", Value: "true" },
        ...(fullName ? [{ Name: "name", Value: fullName }] : []),
      ],
    }),
  );
  await client.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: poolId(),
      Username: email,
      Password: password,
      Permanent: true,
    }),
  );
  await client.send(
    new AdminAddUserToGroupCommand({ UserPoolId: poolId(), Username: email, GroupName: group }),
  );
  const sub = created.User?.Attributes?.find((a) => a.Name === "sub")?.Value;
  if (!sub) throw new Error("Cognito did not return a sub for the new user");
  return sub;
}

/** Email/password login → tokens (USER_PASSWORD_AUTH). */
export async function cognitoLogin(email: string, password: string): Promise<AuthenticationResultType> {
  const res = await client.send(
    new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: clientId(),
      AuthParameters: { USERNAME: email, PASSWORD: password, SECRET_HASH: secretHash(email) },
    }),
  );
  if (!res.AuthenticationResult) throw new Error("Login failed");
  return res.AuthenticationResult;
}

/** Exchange a refresh token for fresh access/id tokens. */
export async function cognitoRefresh(refreshToken: string, username: string) {
  const res = await client.send(
    new InitiateAuthCommand({
      AuthFlow: "REFRESH_TOKEN_AUTH",
      ClientId: clientId(),
      AuthParameters: { REFRESH_TOKEN: refreshToken, SECRET_HASH: secretHash(username) },
    }),
  );
  return res.AuthenticationResult ?? null;
}
