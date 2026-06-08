#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=infra/lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

log "Network — VPC + subnets + IGW (no NAT in dev)"

OCT="$(echo "$VPC_CIDR" | cut -d. -f1-2)" # e.g. "10.20"
PUB1_CIDR="$OCT.0.0/24"; PUB2_CIDR="$OCT.1.0/24"
PRV1_CIDR="$OCT.10.0/24"; PRV2_CIDR="$OCT.11.0/24"

AZ1="$(aws ec2 describe-availability-zones --query 'AvailabilityZones[0].ZoneName' --output text)"
AZ2="$(aws ec2 describe-availability-zones --query 'AvailabilityZones[1].ZoneName' --output text)"

# ---- VPC ----
VPC_ID="$(none_to_empty "$(aws ec2 describe-vpcs --filters "Name=tag:Name,Values=$PREFIX-vpc" --query 'Vpcs[0].VpcId' --output text)")"
if [ -z "$VPC_ID" ]; then
  VPC_ID="$(aws ec2 create-vpc --cidr-block "$VPC_CIDR" --tag-specifications "$(tagspec vpc "$PREFIX-vpc")" --query 'Vpc.VpcId' --output text)"
  log "created VPC $VPC_ID"
fi
aws ec2 modify-vpc-attribute --vpc-id "$VPC_ID" --enable-dns-hostnames >/dev/null
aws ec2 modify-vpc-attribute --vpc-id "$VPC_ID" --enable-dns-support >/dev/null
ssm_put vpc_id "$VPC_ID"

ensure_subnet() { # <name> <cidr> <az> <public?>
  local name="$1" cidr="$2" az="$3" public="$4" id
  id="$(none_to_empty "$(aws ec2 describe-subnets --filters "Name=tag:Name,Values=$name" "Name=vpc-id,Values=$VPC_ID" --query 'Subnets[0].SubnetId' --output text)")"
  if [ -z "$id" ]; then
    id="$(aws ec2 create-subnet --vpc-id "$VPC_ID" --cidr-block "$cidr" --availability-zone "$az" --tag-specifications "$(tagspec subnet "$name")" --query 'Subnet.SubnetId' --output text)"
  fi
  [ "$public" = "true" ] && aws ec2 modify-subnet-attribute --subnet-id "$id" --map-public-ip-on-launch >/dev/null || true
  echo "$id"
}

PUB1="$(ensure_subnet "$PREFIX-public-a" "$PUB1_CIDR" "$AZ1" true)"
PUB2="$(ensure_subnet "$PREFIX-public-b" "$PUB2_CIDR" "$AZ2" true)"
PRV1="$(ensure_subnet "$PREFIX-private-a" "$PRV1_CIDR" "$AZ1" false)"
PRV2="$(ensure_subnet "$PREFIX-private-b" "$PRV2_CIDR" "$AZ2" false)"
ssm_put subnet_public_a "$PUB1"; ssm_put subnet_public_b "$PUB2"
ssm_put subnet_private_a "$PRV1"; ssm_put subnet_private_b "$PRV2"
log "subnets: public[$PUB1,$PUB2] private[$PRV1,$PRV2]"

# ---- Internet Gateway ----
IGW_ID="$(none_to_empty "$(aws ec2 describe-internet-gateways --filters "Name=tag:Name,Values=$PREFIX-igw" --query 'InternetGateways[0].InternetGatewayId' --output text)")"
if [ -z "$IGW_ID" ]; then
  IGW_ID="$(aws ec2 create-internet-gateway --tag-specifications "$(tagspec internet-gateway "$PREFIX-igw")" --query 'InternetGateway.InternetGatewayId' --output text)"
fi
ATTACHED_TO="$(none_to_empty "$(aws ec2 describe-internet-gateways --internet-gateway-ids "$IGW_ID" --query 'InternetGateways[0].Attachments[0].VpcId' --output text)")"
[ "$ATTACHED_TO" = "$VPC_ID" ] || aws ec2 attach-internet-gateway --internet-gateway-id "$IGW_ID" --vpc-id "$VPC_ID"
ssm_put igw_id "$IGW_ID"

# ---- Public route table ----
RTB_ID="$(none_to_empty "$(aws ec2 describe-route-tables --filters "Name=tag:Name,Values=$PREFIX-public-rtb" "Name=vpc-id,Values=$VPC_ID" --query 'RouteTables[0].RouteTableId' --output text)")"
if [ -z "$RTB_ID" ]; then
  RTB_ID="$(aws ec2 create-route-table --vpc-id "$VPC_ID" --tag-specifications "$(tagspec route-table "$PREFIX-public-rtb")" --query 'RouteTable.RouteTableId' --output text)"
fi
aws ec2 create-route --route-table-id "$RTB_ID" --destination-cidr-block 0.0.0.0/0 --gateway-id "$IGW_ID" >/dev/null 2>&1 || true

assoc_rtb() { # <subnetId>
  local sn="$1" existing
  existing="$(none_to_empty "$(aws ec2 describe-route-tables --route-table-ids "$RTB_ID" --query "RouteTables[0].Associations[?SubnetId=='$sn'].RouteTableAssociationId | [0]" --output text)")"
  [ -z "$existing" ] && aws ec2 associate-route-table --route-table-id "$RTB_ID" --subnet-id "$sn" >/dev/null || true
}
assoc_rtb "$PUB1"; assoc_rtb "$PUB2"
ssm_put public_rtb_id "$RTB_ID"

ok "Network ready (VPC $VPC_ID)."
