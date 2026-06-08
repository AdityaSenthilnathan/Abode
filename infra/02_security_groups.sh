#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=infra/lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

log "Security groups — DB (your IP) + App (for prod App Runner)"

VPC_ID="$(ssm_get vpc_id)"
[ -z "$VPC_ID" ] && die "VPC not found — run 01_network.sh first"

ensure_sg() { # <name> <desc>
  local name="$1" desc="$2" id
  id="$(none_to_empty "$(aws ec2 describe-security-groups --filters "Name=group-name,Values=$name" "Name=vpc-id,Values=$VPC_ID" --query 'SecurityGroups[0].GroupId' --output text)")"
  if [ -z "$id" ]; then
    id="$(aws ec2 create-security-group --group-name "$name" --description "$desc" --vpc-id "$VPC_ID" --tag-specifications "$(tagspec security-group "$name")" --query 'GroupId' --output text)"
  fi
  echo "$id"
}

SG_DB="$(ensure_sg "$PREFIX-db" "Abode $ENV Postgres")"
SG_APP="$(ensure_sg "$PREFIX-app" "Abode $ENV app egress")"
ssm_put sg_db "$SG_DB"; ssm_put sg_app "$SG_APP"

# Dev: open 5432 to your current public IP only.
MYIP="$(curl -s https://checkip.amazonaws.com | tr -d '[:space:]')"
[ -z "$MYIP" ] && die "could not determine your public IP"
aws ec2 authorize-security-group-ingress --group-id "$SG_DB" --protocol tcp --port 5432 --cidr "$MYIP/32" >/dev/null 2>&1 \
  && log "allowed 5432 from $MYIP/32" || log "5432 from $MYIP/32 already allowed"
ssm_put dev_client_ip "$MYIP"

# Allow the app SG → DB (used in prod; harmless in dev).
aws ec2 authorize-security-group-ingress --group-id "$SG_DB" \
  --ip-permissions "IpProtocol=tcp,FromPort=5432,ToPort=5432,UserIdGroupPairs=[{GroupId=$SG_APP}]" >/dev/null 2>&1 \
  && log "allowed 5432 from app SG" || true

ok "Security groups ready (db=$SG_DB app=$SG_APP)."
