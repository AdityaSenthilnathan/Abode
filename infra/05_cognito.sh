#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=infra/lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

log "Cognito — user pool, groups (owner/employee/tenant), confidential client"

POOL_NAME="$PREFIX"
POOL_ID="$(none_to_empty "$(aws cognito-idp list-user-pools --max-results 60 \
  --query "UserPools[?Name=='$POOL_NAME'].Id | [0]" --output text)")"

if [ -z "$POOL_ID" ]; then
  POOL_ID="$(aws cognito-idp create-user-pool --pool-name "$POOL_NAME" \
    --auto-verified-attributes email --username-attributes email --mfa-configuration OFF \
    --policies '{"PasswordPolicy":{"MinimumLength":8,"RequireUppercase":true,"RequireLowercase":false,"RequireNumbers":true,"RequireSymbols":false}}' \
    --query 'UserPool.Id' --output text)"
  log "created user pool $POOL_ID"
fi

for g in owner employee tenant; do
  aws cognito-idp get-group --user-pool-id "$POOL_ID" --group-name "$g" >/dev/null 2>&1 || \
    aws cognito-idp create-group --user-pool-id "$POOL_ID" --group-name "$g" --description "Abode $g role" >/dev/null
done

CLIENT_NAME="$PREFIX-web"
CLIENT_ID="$(none_to_empty "$(aws cognito-idp list-user-pool-clients --user-pool-id "$POOL_ID" --max-results 60 \
  --query "UserPoolClients[?ClientName=='$CLIENT_NAME'].ClientId | [0]" --output text)")"

if [ -z "$CLIENT_ID" ]; then
  CLIENT_ID="$(aws cognito-idp create-user-pool-client --user-pool-id "$POOL_ID" --client-name "$CLIENT_NAME" \
    --generate-secret \
    --explicit-auth-flows ALLOW_USER_SRP_AUTH ALLOW_REFRESH_TOKEN_AUTH ALLOW_USER_PASSWORD_AUTH \
    --supported-identity-providers COGNITO \
    --callback-urls "http://localhost:3000/api/auth/callback" --logout-urls "http://localhost:3000" \
    --allowed-o-auth-flows code --allowed-o-auth-scopes openid email profile \
    --allowed-o-auth-flows-user-pool-client \
    --prevent-user-existence-errors ENABLED \
    --query 'UserPoolClient.ClientId' --output text)"
  log "created app client $CLIENT_ID"
fi

CLIENT_SECRET="$(aws cognito-idp describe-user-pool-client --user-pool-id "$POOL_ID" --client-id "$CLIENT_ID" \
  --query 'UserPoolClient.ClientSecret' --output text)"

ssm_put cognito_user_pool_id "$POOL_ID"
ssm_put cognito_client_id "$CLIENT_ID"
ssm_put_secure cognito_client_secret "$CLIENT_SECRET"
ok "Cognito ready (pool=$POOL_ID client=$CLIENT_ID)."
