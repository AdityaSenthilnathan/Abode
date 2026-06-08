#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

for s in 00_prereqs 01_network 02_security_groups 03_aurora 04_s3 05_cognito; do
  printf '\n\033[1;36m==== infra/%s.sh ====\033[0m\n' "$s"
  bash "$s.sh"
done

printf '\n\033[1;36m==== infra/write_env.sh ====\033[0m\n'
bash write_env.sh

printf '\n\033[1;32mAll dev infrastructure provisioned.\033[0m\n'
printf 'Next: from the repo root run  npm run db:migrate && npm run db:seed && npm run dev\n'
