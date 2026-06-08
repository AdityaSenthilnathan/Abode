# shellcheck shell=bash
# infra/lib.sh — shared helpers. `source` this from each script; do not run directly.
#
# Conventions:
#   * Every AWS call goes through the `aws` wrapper → injects --profile/--region.
#   * Resource IDs are persisted to SSM Parameter Store under /abode/$ENV/* so
#     re-runs are idempotent and other scripts (and the app) can read them.
#   * Everything is tagged Project=abode, Env=$ENV.

_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Optional local overrides (copy abode.env.example → abode.env).
# shellcheck disable=SC1091
[ -f "$_LIB_DIR/abode.env" ] && source "$_LIB_DIR/abode.env"

: "${ENV:=dev}"
: "${AWS_PROFILE:=abode}"
: "${REGION:=us-east-1}"
: "${VPC_CIDR:=10.20.0.0/16}"
: "${DB_NAME:=abode}"
: "${MASTER_USERNAME:=abode_admin}"
export AWS_PROFILE

PROJECT="abode"
PREFIX="$PROJECT-$ENV"
SSM_ROOT="/$PROJECT/$ENV"

log()  { printf '\033[1;34m▸ %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*" >&2; }
die()  { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# AWS wrapper — always uses the chosen profile + region.
aws() { command aws --profile "$AWS_PROFILE" --region "$REGION" "$@"; }

require_cmd() { command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"; }

# Tag spec string for `--tag-specifications`.
tagspec() { # <resourceType> <Name>
  echo "ResourceType=$1,Tags=[{Key=Name,Value=$2},{Key=Project,Value=$PROJECT},{Key=Env,Value=$ENV}]"
}

# SSM Parameter Store (plain String).
ssm_put() { aws ssm put-parameter --name "$SSM_ROOT/$1" --value "$2" --type String --overwrite >/dev/null; }
ssm_put_secure() { aws ssm put-parameter --name "$SSM_ROOT/$1" --value "$2" --type SecureString --overwrite >/dev/null; }
ssm_get() { aws ssm get-parameter --name "$SSM_ROOT/$1" --with-decryption --query 'Parameter.Value' --output text 2>/dev/null || true; }

# Treat the literal "None" (CLI text output for null) as empty.
none_to_empty() { local v="$1"; [ "$v" = "None" ] && echo "" || echo "$v"; }

account_id() { aws sts get-caller-identity --query Account --output text; }
