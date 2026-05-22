# Security

## Current controls

- private keys are encrypted at rest in `wallet.json`
- chain ID is verified before wallet operations
- mutating CLI actions require explicit confirmation by default
- native AVAX transfers can be capped with `AVA_MAX_NATIVE_TRANSFER_AVAX`
- swaps can be capped with `AVA_MAX_SWAP_SELL_AMOUNT`
- supported chain IDs are restricted to Avalanche mainnet and Fuji
- wallet passwords are blocked on argv by default and are passed through env/prompt flows instead
- ERC20 approvals default to exact amounts unless `AVA_APPROVAL_MODE=infinite` is explicitly chosen
- swap approvals are limited to the 0x AllowanceHolder flow

## Still true

- do not trust raw AI text without parsing and validation
- do not keep plaintext keys in the repo
- use a low-value wallet first
- test with a small amount before larger swaps

## Real risks

- prompt mistakes can still produce valid but unwanted transfers
- a wrong token symbol or address can route value incorrectly
- explicit opt-in to infinite approvals still increases approval exposure
- 0x API availability is an external dependency for quote and swap flows
