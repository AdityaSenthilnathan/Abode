#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=infra/lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

log "Prereqs — ENV=$ENV REGION=$REGION PROFILE=$AWS_PROFILE"
require_cmd aws
require_cmd curl

if ! aws sts get-caller-identity >/dev/null 2>&1; then
  die "AWS auth failed. Did you run: aws configure --profile $AWS_PROFILE ?  (Do NOT use the leaked key.)"
fi
ok "Authenticated to account $(account_id)"

ENGINE_VER="$(aws rds describe-db-engine-versions --engine aurora-postgresql \
  --query 'DBEngineVersions[?starts_with(EngineVersion, `16.`) && !contains(EngineVersion, `limitless`)].EngineVersion | [-1]' --output text)"
[ -z "$ENGINE_VER" ] || [ "$ENGINE_VER" = "None" ] && ENGINE_VER="16.6"
ssm_put engine_version "$ENGINE_VER"
ok "Aurora PostgreSQL engine version: $ENGINE_VER"

ok "Prereqs OK."
