#!/usr/bin/env bash
set -uo pipefail # intentionally not -e: best-effort, continue through deletes
# shellcheck source=infra/lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

warn "This DELETES all Abode '$ENV' infra in account $(account_id) ($REGION)."
printf "Type 'destroy-%s' to confirm: " "$ENV"; read -r confirm
[ "$confirm" = "destroy-$ENV" ] || die "aborted"

CLUSTER_ID="$PREFIX"; INSTANCE_ID="$PREFIX-1"; SUBNET_GROUP="$PREFIX-dbsubnets"

# --- Cognito ---
POOL_ID="$(ssm_get cognito_user_pool_id)"; CLIENT_ID="$(ssm_get cognito_client_id)"
[ -n "$POOL_ID" ] && [ -n "$CLIENT_ID" ] && aws cognito-idp delete-user-pool-client --user-pool-id "$POOL_ID" --client-id "$CLIENT_ID" 2>/dev/null || true
[ -n "$POOL_ID" ] && aws cognito-idp delete-user-pool --user-pool-id "$POOL_ID" 2>/dev/null || true
log "cognito removed"

# --- S3 ---
BUCKET="$(ssm_get s3_media_bucket)"
if [ -n "$BUCKET" ]; then
  aws s3 rm "s3://$BUCKET" --recursive 2>/dev/null || true
  aws s3api delete-bucket --bucket "$BUCKET" 2>/dev/null || true
  log "s3 bucket removed"
fi

# --- RDS (instance → cluster → subnet group). Managed master secret auto-deletes. ---
aws rds delete-db-instance --db-instance-identifier "$INSTANCE_ID" --skip-final-snapshot --delete-automated-backups 2>/dev/null || true
log "waiting for DB instance deletion …"
aws rds wait db-instance-deleted --db-instance-identifier "$INSTANCE_ID" 2>/dev/null || true
aws rds delete-db-cluster --db-cluster-identifier "$CLUSTER_ID" --skip-final-snapshot 2>/dev/null || true
for _ in $(seq 1 60); do aws rds describe-db-clusters --db-cluster-identifier "$CLUSTER_ID" >/dev/null 2>&1 || break; sleep 10; done
aws rds delete-db-subnet-group --db-subnet-group-name "$SUBNET_GROUP" 2>/dev/null || true
log "rds removed"

# --- Network ---
SG_DB="$(ssm_get sg_db)"; SG_APP="$(ssm_get sg_app)"
VPC_ID="$(ssm_get vpc_id)"; IGW_ID="$(ssm_get igw_id)"; RTB_ID="$(ssm_get public_rtb_id)"
[ -n "$SG_DB" ] && aws ec2 delete-security-group --group-id "$SG_DB" 2>/dev/null || true
[ -n "$SG_APP" ] && aws ec2 delete-security-group --group-id "$SG_APP" 2>/dev/null || true
if [ -n "$IGW_ID" ] && [ -n "$VPC_ID" ]; then
  aws ec2 detach-internet-gateway --internet-gateway-id "$IGW_ID" --vpc-id "$VPC_ID" 2>/dev/null || true
  aws ec2 delete-internet-gateway --internet-gateway-id "$IGW_ID" 2>/dev/null || true
fi
for key in subnet_public_a subnet_public_b subnet_private_a subnet_private_b; do
  sn="$(ssm_get "$key")"; [ -n "$sn" ] && aws ec2 delete-subnet --subnet-id "$sn" 2>/dev/null || true
done
[ -n "$RTB_ID" ] && aws ec2 delete-route-table --route-table-id "$RTB_ID" 2>/dev/null || true
[ -n "$VPC_ID" ] && aws ec2 delete-vpc --vpc-id "$VPC_ID" 2>/dev/null || true
log "network removed"

# --- SSM params ---
for n in $(aws ssm get-parameters-by-path --path "$SSM_ROOT" --recursive --query 'Parameters[].Name' --output text 2>/dev/null); do
  aws ssm delete-parameter --name "$n" 2>/dev/null || true
done

ok "Teardown complete for ENV=$ENV."
