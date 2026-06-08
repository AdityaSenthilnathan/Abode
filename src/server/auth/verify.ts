import "server-only";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { requireEnv } from "@/server/config";

// Module-scoped singleton — caches the pool JWKS; do not recreate per request.
let _verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

function verifier() {
  if (!_verifier) {
    _verifier = CognitoJwtVerifier.create({
      userPoolId: requireEnv("COGNITO_USER_POOL_ID"),
      tokenUse: "access",
      clientId: requireEnv("COGNITO_CLIENT_ID"),
    });
  }
  return _verifier;
}

export interface AccessClaims {
  sub: string;
  groups: string[];
  username: string;
}

/** Cryptographically verify a Cognito access token; throws if invalid/expired. */
export async function verifyAccessToken(token: string): Promise<AccessClaims> {
  const payload = await verifier().verify(token);
  return {
    sub: payload.sub,
    groups: (payload["cognito:groups"] as string[] | undefined) ?? [],
    username: (payload.username as string | undefined) ?? "",
  };
}
