# CLI

The package exposes the `avaagent` binary.

## Commands

- `create-wallet`
- `address`
- `balance`
- `send`
- `quote-swap`
- `swap`
- `ai`

## Examples

```bash
avaagent create-wallet --yes
avaagent balance USDC --json
avaagent send --to 0xabc... --amount 25 --asset USDC --yes --json
avaagent quote-swap --sell-token WAVAX --buy-token USDC --sell-amount 1
avaagent ai "send 0.2 AVAX to 0xabc..." --yes --json
```

## Confirmation model

- read-only commands run directly
- mutating commands require `--yes` unless `AVA_REQUIRE_CONFIRMATION=false`
