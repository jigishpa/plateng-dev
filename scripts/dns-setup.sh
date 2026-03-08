#!/usr/bin/env bash
#
# Creates Route53 A records pointing a domain to GitHub Pages.
# These records are static and independent of any Kubernetes cluster.
#
# Usage:
#   AWS_PROFILE=<profile> ./scripts/dns-setup.sh <domain>
#   AWS_PROFILE=<profile> ./scripts/dns-setup.sh <domain> delete
#
# Example:
#   AWS_PROFILE=mcp-infrastructure ./scripts/dns-setup.sh plateng.dev
#   AWS_PROFILE=mcp-infrastructure ./scripts/dns-setup.sh plateng.dev delete
#
# Prerequisites:
#   - AWS CLI configured
#   - AWS_PROFILE set to a profile with Route53 write access
#   - A Route53 hosted zone for the domain must exist
#
set -euo pipefail

if [[ -z "${AWS_PROFILE:-}" ]]; then
  echo "Error: AWS_PROFILE must be set" >&2
  exit 1
fi

DOMAIN="${1:-}"
if [[ -z "${DOMAIN}" ]]; then
  echo "Usage: AWS_PROFILE=<profile> $0 <domain> [delete]" >&2
  exit 1
fi

ACTION="UPSERT"
if [[ "${2:-}" == "delete" ]]; then
  ACTION="DELETE"
fi

TTL=300

# GitHub Pages IP addresses
# https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site
GITHUB_PAGES_IPS=(
  "185.199.108.153"
  "185.199.109.153"
  "185.199.110.153"
  "185.199.111.153"
)

# Look up hosted zone ID dynamically
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
  --dns-name "${DOMAIN}" --max-items 1 --output json \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['HostedZones'][0]['Id'].split('/')[-1])")

if [[ -z "${HOSTED_ZONE_ID}" ]]; then
  echo "Error: Could not find hosted zone for ${DOMAIN}" >&2
  exit 1
fi

# Build resource records array
RECORDS=""
for ip in "${GITHUB_PAGES_IPS[@]}"; do
  RECORDS="${RECORDS}{\"Value\": \"${ip}\"},"
done
RECORDS="[${RECORDS%,}]"

CHANGE_BATCH=$(cat <<EOF
{
  "Comment": "GitHub Pages A records for ${DOMAIN}",
  "Changes": [
    {
      "Action": "${ACTION}",
      "ResourceRecordSet": {
        "Name": "${DOMAIN}",
        "Type": "A",
        "TTL": ${TTL},
        "ResourceRecords": ${RECORDS}
      }
    }
  ]
}
EOF
)

echo "Route53: ${ACTION} A records for ${DOMAIN}"
echo "  IPs: ${GITHUB_PAGES_IPS[*]}"
echo "  TTL: ${TTL}s"
echo "  Zone: ${HOSTED_ZONE_ID}"
echo ""

aws route53 change-resource-record-sets \
  --hosted-zone-id "${HOSTED_ZONE_ID}" \
  --change-batch "${CHANGE_BATCH}" \
  --output json

echo ""
echo "Done. Verify with: dig +short ${DOMAIN} A"
