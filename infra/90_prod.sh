#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=infra/lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
#
# PROD CUTOVER — run AFTER:
#   • the AWS account is on a paid plan (Aurora needs it), and
#   • the dev stack (00–05) has been provisioned.
# Adds: NAT Gateway, RDS Proxy, IAM roles, ECR image, App Runner service.
# Idempotent. Set DOMAIN=app.example.com to wire callback/CORS URLs.

: "${DOMAIN:=}"
ACCOUNT="$(account_id)"
VPC_ID="$(ssm_get vpc_id)"; [ -z "$VPC_ID" ] && die "dev stack missing — run 01–05 first"
PUB_A="$(ssm_get subnet_public_a)"; PRV_A="$(ssm_get subnet_private_a)"; PRV_B="$(ssm_get subnet_private_b)"
SG_DB="$(ssm_get sg_db)"; SG_APP="$(ssm_get sg_app)"
DB_SECRET_ARN="$(ssm_get db_secret_arn)"; DB_NAME="$(ssm_get db_name)"
CLUSTER_ID="$PREFIX"
APP_URL="${DOMAIN:+https://$DOMAIN}"; APP_URL="${APP_URL:-http://localhost:3000}"

# --- 1. Aurora: lift to a responsive floor (a proxy disables auto-pause) -------
log "Aurora → MinCapacity 0.5 (required with RDS Proxy)"
aws rds modify-db-cluster --db-cluster-identifier "$CLUSTER_ID" \
  --serverless-v2-scaling-configuration MinCapacity=0.5,MaxCapacity=4 --apply-immediately >/dev/null || true

# --- 2. NAT Gateway so App Runner VPC egress reaches Cognito/Stripe/S3 ----------
EIP_ALLOC="$(ssm_get nat_eip_alloc)"
[ -z "$EIP_ALLOC" ] && { EIP_ALLOC="$(aws ec2 allocate-address --domain vpc --query AllocationId --output text)"; ssm_put nat_eip_alloc "$EIP_ALLOC"; }
NAT_ID="$(none_to_empty "$(aws ec2 describe-nat-gateways --filter "Name=tag:Name,Values=$PREFIX-nat" "Name=state,Values=available,pending" --query 'NatGateways[0].NatGatewayId' --output text)")"
if [ -z "$NAT_ID" ]; then
  NAT_ID="$(aws ec2 create-nat-gateway --subnet-id "$PUB_A" --allocation-id "$EIP_ALLOC" --tag-specifications "$(tagspec natgateway "$PREFIX-nat")" --query 'NatGateway.NatGatewayId' --output text)"
  log "waiting for NAT gateway…"; aws ec2 wait nat-gateway-available --nat-gateway-ids "$NAT_ID"
fi
ssm_put nat_gateway_id "$NAT_ID"
PRTB="$(none_to_empty "$(aws ec2 describe-route-tables --filters "Name=tag:Name,Values=$PREFIX-private-rtb" "Name=vpc-id,Values=$VPC_ID" --query 'RouteTables[0].RouteTableId' --output text)")"
[ -z "$PRTB" ] && PRTB="$(aws ec2 create-route-table --vpc-id "$VPC_ID" --tag-specifications "$(tagspec route-table "$PREFIX-private-rtb")" --query 'RouteTable.RouteTableId' --output text)"
aws ec2 create-route --route-table-id "$PRTB" --destination-cidr-block 0.0.0.0/0 --nat-gateway-id "$NAT_ID" >/dev/null 2>&1 || true
for sn in "$PRV_A" "$PRV_B"; do aws ec2 associate-route-table --route-table-id "$PRTB" --subnet-id "$sn" >/dev/null 2>&1 || true; done
ok "NAT ready ($NAT_ID)"

# --- 3. RDS Proxy (reads the DB secret via an IAM role) ------------------------
ROLE_PROXY="$PREFIX-rdsproxy"
if ! aws iam get-role --role-name "$ROLE_PROXY" >/dev/null 2>&1; then
  aws iam create-role --role-name "$ROLE_PROXY" --assume-role-policy-document \
    '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"rds.amazonaws.com"},"Action":"sts:AssumeRole"}]}' >/dev/null
fi
aws iam put-role-policy --role-name "$ROLE_PROXY" --policy-name read-secret --policy-document \
  '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["secretsmanager:GetSecretValue","secretsmanager:DescribeSecret"],"Resource":"'"$DB_SECRET_ARN"'"},{"Effect":"Allow","Action":"kms:Decrypt","Resource":"*","Condition":{"StringEquals":{"kms:ViaService":"secretsmanager.'"$REGION"'.amazonaws.com"}}}]}' >/dev/null
ROLE_PROXY_ARN="$(aws iam get-role --role-name "$ROLE_PROXY" --query 'Role.Arn' --output text)"
if ! aws rds describe-db-proxies --db-proxy-name "$PREFIX" >/dev/null 2>&1; then
  aws rds create-db-proxy --db-proxy-name "$PREFIX" --engine-family POSTGRESQL --role-arn "$ROLE_PROXY_ARN" \
    --vpc-subnet-ids "$PRV_A" "$PRV_B" --vpc-security-group-ids "$SG_DB" --require-tls \
    --auth '[{"AuthScheme":"SECRETS","SecretArn":"'"$DB_SECRET_ARN"'","ClientPasswordAuthType":"POSTGRES_SCRAM_SHA_256"}]' >/dev/null
  log "registering proxy target…"
fi
aws rds register-db-proxy-targets --db-proxy-name "$PREFIX" --target-group-name default --db-cluster-identifiers "$CLUSTER_ID" >/dev/null 2>&1 || true
for _ in $(seq 1 30); do
  PROXY_EP="$(none_to_empty "$(aws rds describe-db-proxies --db-proxy-name "$PREFIX" --query 'DBProxies[0].Endpoint' --output text)")"
  [ -n "$PROXY_EP" ] && break; sleep 10
done
ssm_put db_proxy_endpoint "$PROXY_EP"
ok "RDS Proxy at $PROXY_EP"

# --- 4. App IAM roles ----------------------------------------------------------
APP_ROLE="$PREFIX-app"; ACCESS_ROLE="$PREFIX-apprunner-ecr"
if ! aws iam get-role --role-name "$APP_ROLE" >/dev/null 2>&1; then
  aws iam create-role --role-name "$APP_ROLE" --assume-role-policy-document \
    '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"tasks.apprunner.amazonaws.com"},"Action":"sts:AssumeRole"}]}' >/dev/null
fi
aws iam put-role-policy --role-name "$APP_ROLE" --policy-name app --policy-document \
  '{"Version":"2012-10-17","Statement":[
     {"Effect":"Allow","Action":["s3:PutObject","s3:GetObject","s3:DeleteObject"],"Resource":"arn:aws:s3:::'"$(ssm_get s3_media_bucket)"'/*"},
     {"Effect":"Allow","Action":["cognito-idp:AdminCreateUser","cognito-idp:AdminSetUserPassword","cognito-idp:AdminAddUserToGroup","cognito-idp:AdminGetUser","cognito-idp:InitiateAuth"],"Resource":"arn:aws:cognito-idp:'"$REGION"':'"$ACCOUNT"':userpool/'"$(ssm_get cognito_user_pool_id)"'"},
     {"Effect":"Allow","Action":["ssm:GetParameter","ssm:GetParametersByPath"],"Resource":"arn:aws:ssm:'"$REGION"':'"$ACCOUNT"':parameter'"$SSM_ROOT"'/*"}
   ]}' >/dev/null
if ! aws iam get-role --role-name "$ACCESS_ROLE" >/dev/null 2>&1; then
  aws iam create-role --role-name "$ACCESS_ROLE" --assume-role-policy-document \
    '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"build.apprunner.amazonaws.com"},"Action":"sts:AssumeRole"}]}' >/dev/null
  aws iam attach-role-policy --role-name "$ACCESS_ROLE" --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess >/dev/null
fi
APP_ROLE_ARN="$(aws iam get-role --role-name "$APP_ROLE" --query 'Role.Arn' --output text)"
ACCESS_ROLE_ARN="$(aws iam get-role --role-name "$ACCESS_ROLE" --query 'Role.Arn' --output text)"

# --- 5. Build + push image to ECR ---------------------------------------------
ECR_URI="$(none_to_empty "$(aws ecr describe-repositories --repository-names "$PREFIX-web" --query 'repositories[0].repositoryUri' --output text 2>/dev/null)")"
[ -z "$ECR_URI" ] && ECR_URI="$(aws ecr create-repository --repository-name "$PREFIX-web" --image-scanning-configuration scanOnPush=true --query 'repository.repositoryUri' --output text)"
aws ecr get-login-password | docker login --username AWS --password-stdin "${ECR_URI%/*}"
( cd "$(dirname "${BASH_SOURCE[0]}")/.." && docker build --platform linux/amd64 -t "$ECR_URI:latest" . )
docker push "$ECR_URI:latest"
ssm_put ecr_uri "$ECR_URI"

# --- 6. App Runner (VPC connector → private subnets) ---------------------------
VPC_CONN_ARN="$(none_to_empty "$(aws apprunner list-vpc-connectors --query "VpcConnectors[?VpcConnectorName=='$PREFIX'].VpcConnectorArn | [0]" --output text)")"
[ -z "$VPC_CONN_ARN" ] && VPC_CONN_ARN="$(aws apprunner create-vpc-connector --vpc-connector-name "$PREFIX" --subnets "$PRV_A" "$PRV_B" --security-groups "$SG_APP" --query 'VpcConnector.VpcConnectorArn' --output text)"

# App reads DB via the proxy with IAM/SCRAM; env passed at runtime. Store the prod DATABASE_URL in Secrets Manager and reference it, or inject via App Runner env.
SRC_CFG='{"AuthenticationConfiguration":{"AccessRoleArn":"'"$ACCESS_ROLE_ARN"'"},"AutoDeploymentsEnabled":true,"ImageRepository":{"ImageIdentifier":"'"$ECR_URI"':latest","ImageRepositoryType":"ECR","ImageConfiguration":{"Port":"3000","RuntimeEnvironmentVariables":{"NODE_ENV":"production","AWS_REGION":"'"$REGION"'","APP_URL":"'"$APP_URL"'","COGNITO_USER_POOL_ID":"'"$(ssm_get cognito_user_pool_id)"'","COGNITO_CLIENT_ID":"'"$(ssm_get cognito_client_id)"'","S3_MEDIA_BUCKET":"'"$(ssm_get s3_media_bucket)"'"}}}}'
NET_CFG='{"EgressConfiguration":{"EgressType":"VPC","VpcConnectorArn":"'"$VPC_CONN_ARN"'"}}'
INST_CFG='{"Cpu":"1 vCPU","Memory":"2 GB","InstanceRoleArn":"'"$APP_ROLE_ARN"'"}'
HEALTH='{"Protocol":"HTTP","Path":"/api/health","Interval":10,"Timeout":5,"HealthyThreshold":1,"UnhealthyThreshold":5}'
if aws apprunner list-services --query "ServiceSummaryList[?ServiceName=='$PREFIX-web']" --output text | grep -q .; then
  warn "App Runner service exists — push to ECR :latest triggers auto-deploy."
else
  aws apprunner create-service --service-name "$PREFIX-web" \
    --source-configuration "$SRC_CFG" --instance-configuration "$INST_CFG" \
    --network-configuration "$NET_CFG" --health-check-configuration "$HEALTH" >/dev/null
fi

ok "Prod cutover complete."
warn "Still to do by hand: set COGNITO_CLIENT_SECRET + DATABASE_URL (proxy endpoint) + Stripe keys as App Runner secrets;"
warn "update the Cognito app-client callback/logout URLs and the S3 CORS origin to $APP_URL; point your domain at the App Runner URL."
