# AvaAgent Control

Use this plugin when Codex should control the local `avaagent` CLI instead of directly re-implementing wallet or swap logic.

## Inputs and contracts

- Request schema: `../../schemas/action.schema.json`
- Response schema: `../../schemas/response.schema.json`

## Environment

- `AVA_CHAIN_ID`
- `AVA_RPC_URL`
- `AVA_WALLET_FILE`
- `AVA_0X_API_KEY`
- `AVA_WALLET_PASSWORD` for unattended local execution

## Command mapping

- `createWallet` -> `["avaagent", "create-wallet", "--json"]`
- `getAddress` -> `["avaagent", "address", "--json"]`
- `getBalance` -> `["avaagent", "balance", "<asset>", "--address", "<address>", "--json"]`
- `send` -> `["avaagent", "send", "--to", "<address>", "--amount", "<n>", "--asset", "<symbol>", "--json"]`
- `quoteSwap` -> `["avaagent", "quote-swap", "--sell-token", "<token>", "--buy-token", "<token>", "--sell-amount", "<n>", "--json"]`
- `swap` -> `["avaagent", "swap", "--sell-token", "<token>", "--buy-token", "<token>", "--sell-amount", "<n>", "--json"]`
- `runAiCommand` -> argv-style execution such as `["avaagent", "ai", "--json", "--", "<prompt>"]`

## Rules

- Keep calls deterministic and JSON-first.
- Execute every mapping as an argv array, never via shell interpolation.
- When targeting a non-mainnet network, pass the matching `--chain-id` and `--rpc-url` pair together.
- For `createWallet`, `send`, `swap`, and every `runAiCommand`, require explicit user intent before adding `--yes`.
- Treat `runAiCommand` as unsafe-by-default and require a strict read-only allowlist before dispatching any AI prompt without confirmation.
- Do not bypass local wallet encryption.
- Fail fast if `AVA_WALLET_FILE` is missing before dispatching commands that open an existing wallet.
- Fail fast if `AVA_RPC_URL` is missing before dispatching commands that touch chain state or RPC reads.
- Fail fast if `AVA_WALLET_PASSWORD` is missing before unattended wallet creation, wallet-address reads, unlock, send, swap, or any `runAiCommand`.
- Fail fast if `AVA_0X_API_KEY` is missing before dispatching quote or swap commands.
