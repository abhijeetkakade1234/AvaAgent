# AvaAgent

`AvaAgent` is now a real local-first Avalanche wallet toolkit instead of just a concept doc set.

It ships as:

- an npm package
- a CLI tool
- a small JavaScript SDK
- a callable Codex plugin backed by MCP over stdio
- GitHub Actions CI plus Husky guardrails

## What it does

- creates and encrypts a local wallet
- reads AVAX or ERC20 balances
- sends AVAX or ERC20 transfers
- parses a small set of natural-language wallet commands
- quotes real Avalanche swaps through the 0x Swap API
- executes real Avalanche swaps from the local wallet

## Install

```bash
npm install
```

Husky hooks are installed through `npm install` via the `prepare` script.

## Configure

Copy `.env.example` to `.env` and set:

- `AVA_CHAIN_ID`
- `AVA_RPC_URL`
- `AVA_WALLET_FILE`
- `AVA_0X_API_KEY`
- `AVA_APPROVAL_MODE`
- optional safety caps such as `AVA_MAX_NATIVE_TRANSFER_AVAX`

## CLI

```bash
avaagent create-wallet --yes
avaagent address --json
avaagent balance AVAX --json
avaagent send --to 0xabc... --amount 0.1 --asset AVAX --yes --json
avaagent quote-swap --sell-token AVAX --buy-token USDC --sell-amount 0.1
avaagent swap --sell-token AVAX --buy-token USDC --sell-amount 0.1 --yes --json
avaagent ai "swap 0.1 AVAX to USDC" --yes --json
```

For Fuji, pass both the testnet RPC and chain ID together:

```bash
avaagent --chain-id 43113 --rpc-url https://api.avax-test.network/ext/bc/C/rpc balance AVAX --address 0xabc... --json
```

## Codex plugin

The repo-local plugin lives at `plugins/avaagent/.codex-plugin/plugin.json`.

The MCP registration lives at `plugins/avaagent/.mcp.json`.

The MCP server lives at `plugins/avaagent/mcp/server.js`.

The action and response schemas live in:

- `plugins/avaagent/schemas/action.schema.json`
- `plugins/avaagent/schemas/response.schema.json`

The plugin tools route through the local `avaagent` CLI so the same wallet and swap logic can be controlled consistently.

Available MCP tools:

- `avaagent_get_address`
- `avaagent_get_balance`
- `avaagent_create_wallet`
- `avaagent_send`
- `avaagent_quote_swap`
- `avaagent_swap`

## Notes

- Swaps require a valid 0x API key.
- Wallet secrets stay local in `wallet.json`.
- Wallet passwords are read from an interactive prompt or `AVA_WALLET_PASSWORD`; passing `--password` is blocked by default because argv leaks too easily.
- By default, state-changing commands require confirmation unless `--yes` is passed or `AVA_REQUIRE_CONFIRMATION=false` is set.
- Interactive `send`, `swap`, and AI-triggered value-moving commands now print a resolved preflight summary and require typing `YES` before execution.
- Value-moving operations only allow the built-in known token set for the active supported chain.
- Supported chains are limited to Avalanche mainnet (`43114`) and Fuji (`43113`).
- ERC20 approvals default to `exact`; use `AVA_APPROVAL_MODE=infinite` or `--approval-mode infinite` only if you explicitly want persistent allowance exposure.
- Non-default 0x base URLs are blocked unless `AVA_ALLOW_UNSAFE_0X_BASE_URL=true` is explicitly set.

## Repo quality gates

- `npm run lint`
- `npm test`
- `npm run pack:check`

Local hooks:

- pre-commit -> lint
- pre-push -> test
