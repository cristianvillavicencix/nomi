#!/usr/bin/env bash
# Bundle edge functions for MCP deploy (outputs /tmp/mcp-deploy-<name>.json)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FUNCTIONS=(
  get_public_proposal
  accept_proposal
  send_proposal
  sign_proposal_contract
  pay_proposal_deposit
  stripe-client-webhook
  process_scheduled_payments
  issue_client_invoice
  send_client_invoice
)

for fn in "${FUNCTIONS[@]}"; do
  node scripts/bundle-edge-function.mjs "$fn" | node -e "
    const b = JSON.parse(require('fs').readFileSync(0, 'utf8'));
    const out = {
      name: b.functionName,
      entrypoint_path: 'index.ts',
      verify_jwt: false,
      files: b.files,
    };
    require('fs').writeFileSync('/tmp/mcp-deploy-' + b.functionName + '.json', JSON.stringify(out));
    console.log('bundled', b.functionName, b.files.length, 'files');
  "
done
