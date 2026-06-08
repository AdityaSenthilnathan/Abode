#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=infra/lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

log "Aurora PostgreSQL Serverless v2 (Min=0 auto-pause, no proxy — dev)"

SG_DB="$(ssm_get sg_db)";       [ -z "$SG_DB" ] && die "run 02_security_groups.sh first"
PUB_A="$(ssm_get subnet_public_a)"; PUB_B="$(ssm_get subnet_public_b)"
[ -z "$PUB_A" ] && die "run 01_network.sh first"
ENGINE_VER="$(ssm_get engine_version)"; [ -z "$ENGINE_VER" ] && ENGINE_VER="16.6"

CLUSTER_ID="$PREFIX"
INSTANCE_ID="$PREFIX-1"
SUBNET_GROUP="$PREFIX-dbsubnets"

# Dev DB is publicly accessible (IP-locked via SG) → subnet group uses PUBLIC subnets.
if ! aws rds describe-db-subnet-groups --db-subnet-group-name "$SUBNET_GROUP" >/dev/null 2>&1; then
  aws rds create-db-subnet-group --db-subnet-group-name "$SUBNET_GROUP" \
    --db-subnet-group-description "Abode $ENV (public, dev)" --subnet-ids "$PUB_A" "$PUB_B" \
    --tags Key=Project,Value="$PROJECT" Key=Env,Value="$ENV" >/dev/null
  log "created subnet group $SUBNET_GROUP"
fi

if ! aws rds describe-db-clusters --db-cluster-identifier "$CLUSTER_ID" >/dev/null 2>&1; then
  aws rds create-db-cluster \
    --db-cluster-identifier "$CLUSTER_ID" \
    --engine aurora-postgresql --engine-version "$ENGINE_VER" \
    --serverless-v2-scaling-configuration "MinCapacity=0,MaxCapacity=4,SecondsUntilAutoPause=300" \
    --database-name "$DB_NAME" \
    --master-username "$MASTER_USERNAME" --manage-master-user-password \
    --db-subnet-group-name "$SUBNET_GROUP" \
    --vpc-security-group-ids "$SG_DB" \
    --storage-encrypted --backup-retention-period 1 \
    --tags Key=Project,Value="$PROJECT" Key=Env,Value="$ENV" >/dev/null
  log "creating cluster $CLUSTER_ID …"
fi

if ! aws rds describe-db-instances --db-instance-identifier "$INSTANCE_ID" >/dev/null 2>&1; then
  aws rds create-db-instance \
    --db-instance-identifier "$INSTANCE_ID" \
    --db-cluster-identifier "$CLUSTER_ID" \
    --engine aurora-postgresql --db-instance-class db.serverless \
    --publicly-accessible \
    --tags Key=Project,Value="$PROJECT" Key=Env,Value="$ENV" >/dev/null
  log "creating instance $INSTANCE_ID (5–10 min) …"
fi

log "waiting for DB instance to become available …"
aws rds wait db-instance-available --db-instance-identifier "$INSTANCE_ID"

ENDPOINT="$(aws rds describe-db-clusters --db-cluster-identifier "$CLUSTER_ID" --query 'DBClusters[0].Endpoint' --output text)"
SECRET_ARN="$(aws rds describe-db-clusters --db-cluster-identifier "$CLUSTER_ID" --query 'DBClusters[0].MasterUserSecret.SecretArn' --output text)"
ssm_put db_endpoint "$ENDPOINT"
ssm_put db_secret_arn "$SECRET_ARN"
ssm_put db_name "$DB_NAME"

ok "Aurora ready at $ENDPOINT (db=$DB_NAME). Master secret in Secrets Manager."
warn "Dev DB is publicly accessible but locked to your IP. Prod (90_*) moves it private behind RDS Proxy."
